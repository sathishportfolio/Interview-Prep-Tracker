// @ts-check
/**
 * sync/bins.js — per-bin sync engine. JSONBin's free tier caps a single bin's size, and the
 * default behavior (everything in one shared bin, switched via the File Switcher) is what most
 * users want — but a file can be moved or copied to a bin of its own when the default bin is
 * getting full, or just because the user prefers isolating it. This module is the only place that
 * knows how to read/write a *bin's* contents (a small subset schema: just the files that live
 * there, plus the app-level singletons — globalToggles/activeQuestion/timer — carried only by the
 * default bin); autoPush.js/manualPull.js/syncConfig.js all go through it rather than talking to
 * jsonbin.js directly.
 *
 * Every write here is pull-merge-push, never a blind overwrite: a bin may hold files from other
 * devices this device hasn't loaded locally, and PUT replaces a bin's entire content, so clobbering
 * would silently destroy that data. The one exception is the explicit, deliberate "flush" step
 * (dropping specific file ids) used when a file is moved OUT of a bin.
 * @typedef {import('../types.js').FileRecord} FileRecord
 * @typedef {import('../types.js').BinInfo} BinInfo
 */
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { gzipToBase64, gunzipFromBase64 } from "./gzip.js";
import { pushToBin, pullFromBin, createBin as createBinRemote } from "./jsonbin.js";

/** @param {FileRecord} file @returns {string|null} The bin this file actually lives in. */
export function resolveBinId(file) {
  return file.binId || appState.sync.defaultBinId || null;
}

/** @returns {Array<{id: string, label: string, isDefault: boolean}>} Every bin the app knows about. */
export function listBins() {
  const defaultBinId = appState.sync.defaultBinId;
  /** @type {Array<{id: string, label: string, isDefault: boolean}>} */
  const bins = [];
  if (defaultBinId) bins.push({ id: defaultBinId, label: "Default bin", isDefault: true });
  for (const b of appState.sync.knownBins || []) {
    if (b.id === defaultBinId) continue;
    bins.push({ id: b.id, label: b.label || b.id, isDefault: false });
  }
  return bins;
}

/** Groups currently-loaded local files by the bin they resolve to. @returns {Map<string, FileRecord[]>} */
export function groupLocalFilesByBin() {
  /** @type {Map<string, FileRecord[]>} */
  const map = new Map();
  for (const f of appState.files) {
    const bin = resolveBinId(f);
    if (!bin) continue;
    if (!map.has(bin)) map.set(bin, []);
    /** @type {FileRecord[]} */ (map.get(bin)).push(f);
  }
  return map;
}

/**
 * @param {FileRecord[]} files
 * @param {boolean} includeAppMeta Only the default bin carries these app-level singletons.
 */
function serializeBinPayload(files, includeAppMeta) {
  const payload = { schemaVersion: 1, files };
  if (includeAppMeta) {
    Object.assign(payload, {
      globalToggles: appState.toggles,
      activeQuestion: appState.activeQuestion,
      timer: appState.timer,
    });
  }
  return JSON.stringify(payload);
}

/**
 * Fetches a bin's raw contents without touching local state — the read half of pull, exposed so
 * autoPull.js can peek at `updatedAt` before deciding whether a full local-state merge is worth
 * doing (see applyBinToLocalState).
 * @param {string} binId
 * @returns {Promise<{ok: boolean, files: FileRecord[], globalToggles?: any, activeQuestion?: any, timer?: any, updatedAt: number|null, error?: string}>}
 */
export async function pullBinRaw(binId) {
  const masterKey = appState.sync.masterKey;
  if (!masterKey) return { ok: false, files: [], updatedAt: null, error: "No Master Key configured." };
  const result = await pullFromBin({ masterKey, binId });
  if (!result.ok) return { ok: false, files: [], updatedAt: null, error: result.error };
  if (!result.payload) return { ok: true, files: [], updatedAt: result.updatedAt };
  try {
    const json = await gunzipFromBase64(result.payload);
    const parsed = JSON.parse(json);
    return {
      ok: true,
      files: Array.isArray(parsed.files) ? parsed.files : [],
      globalToggles: parsed.globalToggles,
      activeQuestion: parsed.activeQuestion,
      timer: parsed.timer,
      updatedAt: result.updatedAt,
    };
  } catch {
    return { ok: false, files: [], updatedAt: null, error: "Could not read bin data." };
  }
}

/**
 * Pull-merge-push: fetches the bin's current remote files, upserts every locally-loaded file that
 * resolves to this bin (local edits win for files this device knows about), optionally drops
 * `removeFileIds` (the flush step), then pushes the merged set back. Remote-only files this device
 * never loaded are left untouched.
 * @param {string} binId
 * @param {{removeFileIds?: string[]}} [options]
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function pushBin(binId, options = {}) {
  const masterKey = appState.sync.masterKey;
  if (!masterKey) return { ok: false, error: "No Master Key configured." };

  const remote = await pullBinRaw(binId);
  /** @type {Map<string, FileRecord>} */
  const merged = new Map((remote.files || []).map((f) => [f.id, f]));
  for (const id of options.removeFileIds || []) merged.delete(id);

  const localFilesHere = groupLocalFilesByBin().get(binId) || [];
  for (const f of localFilesHere) merged.set(f.id, f);

  const includeAppMeta = binId === appState.sync.defaultBinId;
  const json = serializeBinPayload([...merged.values()], includeAppMeta);
  const compressed = await gzipToBase64(json);
  const result = await pushToBin({ masterKey, binId, payload: compressed });
  if (result.ok) appState.sync = { ...appState.sync, lastPushAt: Date.now() };
  return result;
}

/**
 * Pushes every bin that currently has at least one locally-loaded file (the autosave path).
 * @returns {Promise<boolean>} true if at least one bin pushed successfully
 */
export async function pushAllLocalBins() {
  const targetBins = [...groupLocalFilesByBin().keys()];
  let anyOk = false;
  for (const binId of targetBins) {
    const result = await pushBin(binId);
    if (result.ok) anyOk = true;
  }
  return anyOk;
}

/**
 * Applies an already-fetched bin payload (from pullBinRaw) to local state: files from this bin
 * upserted by id, app-level meta applied only if this is the default bin. Split out from
 * pullBinIntoLocalState so autoPull.js can peek at `updatedAt` (via pullBinRaw) and skip this
 * merge/persist entirely when nothing's actually newer.
 * @param {string} binId
 * @param {{files: FileRecord[], globalToggles?: any, activeQuestion?: any, timer?: any, updatedAt: number|null}} remote
 */
export function applyBinToLocalState(binId, remote) {
  const byId = new Map(appState.files.map((f) => [f.id, f]));
  for (const f of remote.files) byId.set(f.id, { ...f, binId: f.binId ?? null });
  appState.files = [...byId.values()];

  if (binId === appState.sync.defaultBinId) {
    if (remote.globalToggles) appState.toggles = remote.globalToggles;
    if (remote.activeQuestion !== undefined) appState.activeQuestion = remote.activeQuestion;
    if (remote.timer) appState.timer = remote.timer;
  }

  appState.sync = { ...appState.sync, lastPullAt: Date.now(), lastKnownRemoteUpdatedAt: remote.updatedAt };
  store.writeFiles(appState.files);
  store.writeGlobalToggles(appState.toggles);
  store.writeActiveQuestion(appState.activeQuestion);
  store.writeTimer(appState.timer);
  store.writeSync(appState.sync);
}

/**
 * Pulls one bin and applies it to local state. Used by the Manual Pull button (default bin only)
 * and fetchAllBins.
 * @param {string} binId
 * @returns {Promise<{ok: boolean, changed: boolean, error?: string}>}
 */
export async function pullBinIntoLocalState(binId) {
  const remote = await pullBinRaw(binId);
  if (!remote.ok) return { ok: false, changed: false, error: remote.error };
  applyBinToLocalState(binId, remote);
  return { ok: true, changed: true };
}

/** Pulls every known bin (default + registry) and merges them all into local state. */
export async function fetchAllBins() {
  const bins = listBins();
  if (bins.length === 0) return { ok: false, error: "No bins configured yet." };
  let anyOk = false;
  for (const b of bins) {
    const result = await pullBinIntoLocalState(b.id);
    if (result.ok) anyOk = true;
  }
  return { ok: anyOk };
}

/**
 * Creates a brand-new empty bin on JSONBin and registers it locally so it shows up as an option
 * everywhere a bin can be picked.
 * @param {string} label
 * @returns {Promise<{ok: boolean, binId?: string, error?: string}>}
 */
export async function createNewBin(label) {
  const masterKey = appState.sync.masterKey;
  if (!masterKey) return { ok: false, error: "No Master Key configured." };
  const payload = await gzipToBase64(serializeBinPayload([], false));
  const result = await createBinRemote({ masterKey, payload, label });
  if (!result.ok) return result;
  registerKnownBin(result.binId, label);
  return { ok: true, binId: result.binId };
}

/** @param {string} binId @param {string} label */
export function registerKnownBin(binId, label) {
  const existing = appState.sync.knownBins || [];
  if (existing.some((b) => b.id === binId)) return;
  appState.sync = { ...appState.sync, knownBins: [...existing, { id: binId, label: label || binId }] };
  store.writeSync(appState.sync);
}

/**
 * Moves a file to a different bin: pushes it into the target bin (merge-safe) then flushes it out
 * of its old bin (explicit removal, since the old bin's remote copy is otherwise never touched by
 * files this device no longer considers local to it).
 * @param {string} fileId
 * @param {string} targetBinId
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function moveFileToBin(fileId, targetBinId) {
  const file = appState.files.find((f) => f.id === fileId);
  if (!file) return { ok: false, error: "File not found." };
  const sourceBinId = resolveBinId(file);
  if (sourceBinId === targetBinId) return { ok: true };

  file.binId = targetBinId === appState.sync.defaultBinId ? null : targetBinId;
  store.writeFiles(appState.files);

  const pushResult = await pushBin(targetBinId);
  if (!pushResult.ok) return pushResult;
  if (sourceBinId) await pushBin(sourceBinId, { removeFileIds: [fileId] });
  return { ok: true };
}

/**
 * Copies a file's current snapshot into another bin as a one-off duplicate — the file's "home"
 * bin (where future autosaves keep pushing it) is unchanged.
 * @param {string} fileId
 * @param {string} targetBinId
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function copyFileToBin(fileId, targetBinId) {
  const file = appState.files.find((f) => f.id === fileId);
  if (!file) return { ok: false, error: "File not found." };

  const masterKey = appState.sync.masterKey;
  if (!masterKey) return { ok: false, error: "No Master Key configured." };

  const remote = await pullBinRaw(targetBinId);
  const merged = new Map((remote.files || []).map((f) => [f.id, f]));
  merged.set(file.id, file);

  const includeAppMeta = targetBinId === appState.sync.defaultBinId;
  const json = serializeBinPayload([...merged.values()], includeAppMeta);
  const compressed = await gzipToBase64(json);
  return pushToBin({ masterKey, binId: targetBinId, payload: compressed });
}
