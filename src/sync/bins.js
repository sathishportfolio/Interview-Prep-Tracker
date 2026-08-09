// @ts-check
/**
 * sync/bins.js — per-bin sync engine. Everything syncs through exactly one "current" bin at a
 * time (`appState.sync.currentBinId`) — the File Switcher only ever shows files that resolve to it
 * (see resolveBinId), and Push/Pull/usage-% all target it exclusively (see manualPush.js,
 * manualPull.js, autoPush.js). JSONBin's free tier caps a single bin's size, so a file can still be
 * moved or copied to a bin of its own when the current bin is getting full, or the user just wants
 * to isolate it — switching which bin is current (setCurrentBin) is how you then bring that file's
 * bin back into view. This module is the only place that knows how to read/write a *bin's* contents
 * (a small subset schema: just the files that live there, plus the app-level singletons —
 * globalToggles/activeQuestion/timer — carried only by the current bin); manualPush.js/
 * manualPull.js/autoPush.js/syncConfig.js all go through it rather than talking to jsonbin.js
 * directly.
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
import { pushToBin, pullFromBin, createBin as createBinRemote, usageAgainstFreeTierCap } from "./jsonbin.js";

/** @param {FileRecord} file @returns {string|null} The bin this file actually lives in. */
export function resolveBinId(file) {
  return file.binId || appState.sync.currentBinId || null;
}

/**
 * @returns {Array<{id: string, label: string, description: string, isCurrent: boolean}>} Every bin
 * the app knows about. The current bin's label prefers a real name from knownBins (the user may
 * have named it via "+ New Bin" or "+ Register Bin") over the generic "Current bin" fallback, so a
 * named bin shows its actual name instead of being masked by isCurrent.
 */
export function listBins() {
  const currentBinId = appState.sync.currentBinId;
  /** @type {Array<{id: string, label: string, description: string, isCurrent: boolean}>} */
  const bins = [];
  if (currentBinId) {
    const known = (appState.sync.knownBins || []).find((b) => b.id === currentBinId);
    bins.push({ id: currentBinId, label: (known && known.label) || "Current bin", description: (known && known.description) || "", isCurrent: true });
  }
  for (const b of appState.sync.knownBins || []) {
    if (b.id === currentBinId) continue;
    bins.push({ id: b.id, label: b.label || b.id, description: b.description || "", isCurrent: false });
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
 * @param {boolean} includeAppMeta Only the current bin carries these app-level singletons.
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
 * Gzipped size of the current bin's local files against the free-tier cap, computed from local
 * state alone (no network call) — matches what a push would actually send (see serializeBinPayload)
 * so the usage badge reflects reality even before anything's been pushed this session.
 * @returns {Promise<{percent: number, overCap: boolean}>}
 */
export async function computeCurrentBinUsage() {
  const currentBinId = appState.sync.currentBinId;
  if (!currentBinId) return { percent: 0, overCap: false };
  const files = groupLocalFilesByBin().get(currentBinId) || [];
  const compressed = await gzipToBase64(serializeBinPayload(files, true));
  return usageAgainstFreeTierCap(compressed.length);
}

/**
 * Fetches a bin's raw contents without touching local state — the read half of pull. Used
 * internally by pushBin (to merge in files from other devices before writing back) and exposed for
 * anything else that needs to peek at a bin's `updatedAt`/files without applying it to local state
 * (see applyBinToLocalState for the part that does).
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

  const includeAppMeta = binId === appState.sync.currentBinId;
  const json = serializeBinPayload([...merged.values()], includeAppMeta);
  const compressed = await gzipToBase64(json);
  const result = await pushToBin({ masterKey, binId, payload: compressed });
  if (result.ok) {
    appState.sync = { ...appState.sync, lastPushAt: Date.now(), lastKnownRemoteUpdatedAt: Date.now() };
    store.writeSync(appState.sync);
  }
  return result;
}

/**
 * Pushes the current bin only — the sole bin regular Push (manualPush.js) and auto-push
 * (autoPush.js) ever target, matching Pull's already-current-bin-only scope.
 * @returns {Promise<boolean>} true if it pushed successfully
 */
export async function pushCurrentBin() {
  const currentBinId = appState.sync.currentBinId;
  if (!currentBinId) return false;
  const result = await pushBin(currentBinId);
  return result.ok;
}

/**
 * Applies an already-fetched bin payload (from pullBinRaw) to local state: files from this bin
 * upserted by id, app-level meta applied only if this is the current bin. Split out from
 * pullBinIntoLocalState as its own step so callers that already have a fetched payload (e.g.
 * fetchAllBins) can apply it without a redundant re-fetch.
 * @param {string} binId
 * @param {{files: FileRecord[], globalToggles?: any, activeQuestion?: any, timer?: any, updatedAt: number|null}} remote
 */
export function applyBinToLocalState(binId, remote) {
  const byId = new Map(appState.files.map((f) => [f.id, f]));
  for (const f of remote.files) byId.set(f.id, { ...f, binId: f.binId ?? null });
  appState.files = [...byId.values()];

  if (binId === appState.sync.currentBinId) {
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
 * Pulls one bin and applies it to local state. Used by the Manual Pull button (current bin only)
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

/** Pulls every known bin (current + registry) and merges them all into local state. */
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

/** @param {string} binId @param {string} label @param {string} [description] */
export function registerKnownBin(binId, label, description) {
  const existing = appState.sync.knownBins || [];
  if (existing.some((b) => b.id === binId)) return;
  const entry = { id: binId, label: label || binId };
  if (description && description.trim()) entry.description = description.trim();
  appState.sync = { ...appState.sync, knownBins: [...existing, entry] };
  store.writeSync(appState.sync);
}

/**
 * Renames a bin's local label and/or description (never touches anything on JSONBin itself) —
 * works for the current bin too, upserting it into knownBins if it isn't already there (the
 * current bin otherwise has no knownBins entry at all, see listBins). Description is optional and
 * left untouched when omitted — most users only ever set a name, never a description.
 * @param {string} binId
 * @param {string} label
 * @param {string} [description]
 */
export function renameKnownBin(binId, label, description) {
  const trimmedLabel = (label || "").trim();
  if (!trimmedLabel) return;
  const existing = appState.sync.knownBins || [];
  const idx = existing.findIndex((b) => b.id === binId);
  const trimmedDescription = description === undefined ? undefined : description.trim();
  const knownBins =
    idx === -1
      ? [...existing, { id: binId, label: trimmedLabel, ...(trimmedDescription ? { description: trimmedDescription } : {}) }]
      : existing.map((b, i) => (i === idx ? { ...b, label: trimmedLabel, ...(trimmedDescription !== undefined ? { description: trimmedDescription || undefined } : {}) } : b));
  appState.sync = { ...appState.sync, knownBins };
  store.writeSync(appState.sync);
}

/**
 * Removes a bin from this device's local registry only — never deletes anything on JSONBin itself.
 * Deleting the CURRENT bin promotes another known bin to current (just repoints `currentBinId`, no
 * auto-pull — Pull afterward to fetch its latest data); if there's no other known bin, `currentBinId`
 * goes back to null and the Sync modal falls back to the setup wizard's Bin step, with the Master
 * Key already filled in (never forgotten, only the bin choice). Any local file explicitly assigned
 * to the removed bin falls back to floating with whatever bin ends up current (binId: null) instead
 * of being left pointing at a bin this device no longer lists anywhere.
 * @param {string} binId
 * @returns {{ok: boolean}}
 */
export function deleteKnownBin(binId) {
  const wasCurrent = binId === appState.sync.currentBinId;
  const knownBins = (appState.sync.knownBins || []).filter((b) => b.id !== binId);
  const currentBinId = wasCurrent ? (knownBins.length > 0 ? knownBins[0].id : null) : appState.sync.currentBinId;

  appState.sync = { ...appState.sync, knownBins, currentBinId };
  store.writeSync(appState.sync);

  const reassigned = appState.files.some((f) => f.binId === binId);
  if (reassigned) {
    appState.files = appState.files.map((f) => (f.binId === binId ? { ...f, binId: null } : f));
    store.writeFiles(appState.files);
  }
  return { ok: true };
}

/**
 * Switches which bin is "current" — the one the File Switcher scopes to (see resolveBinId), that
 * every unassigned local file resolves to, and the only one that carries app-level
 * globalToggles/Active Question/timer on push (see serializeBinPayload/applyBinToLocalState). The
 * bin that WAS current gets registered into knownBins under its current label first (it otherwise
 * has no knownBins entry at all while it's still current — see listBins), so it doesn't disappear
 * from the bin list once it's no longer current.
 *
 * Switching bins is a hard reset, not a merge: local files are pushed to the outgoing bin (so
 * nothing unpushed is lost — this includes any "floating"/unpinned files, since resolveBinId still
 * treats them as belonging to the OLD bin at this point), then wiped from local state entirely,
 * then the new bin is pulled in fresh. applyBinToLocalState only ever upserts remote files into
 * appState.files and never removes stale ones on its own, so without wiping first, switching to an
 * empty bin would still show the previous bin's questions locally.
 * @param {string} binId
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function setCurrentBin(binId) {
  const masterKey = appState.sync.masterKey;
  if (!masterKey) return { ok: false, error: "No Master Key configured." };
  if (binId === appState.sync.currentBinId) return { ok: true };

  const oldCurrentId = appState.sync.currentBinId;
  const oldCurrentLabel = listBins().find((b) => b.id === oldCurrentId)?.label;

  if (oldCurrentId) {
    const pushResult = await pushBin(oldCurrentId);
    if (!pushResult.ok) {
      return { ok: false, error: `Could not save the current bin's changes before switching: ${pushResult.error || "push failed"}` };
    }
  }

  appState.files = [];
  store.writeFiles(appState.files);

  appState.sync = { ...appState.sync, currentBinId: binId };
  store.writeSync(appState.sync);
  if (oldCurrentId) registerKnownBin(oldCurrentId, oldCurrentLabel || oldCurrentId);

  const result = await pullBinIntoLocalState(binId);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
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

  file.binId = targetBinId === appState.sync.currentBinId ? null : targetBinId;
  store.writeFiles(appState.files);

  const pushResult = await pushBin(targetBinId);
  if (!pushResult.ok) return pushResult;
  if (sourceBinId) await pushBin(sourceBinId, { removeFileIds: [fileId] });
  return { ok: true };
}

/**
 * Removes a file from whichever bin it currently resolves to — the remote-only half of a full file
 * delete (see features/fileManager.js's deleteFile for the local-storage half; sync/syncConfig.js's
 * buildFileRow calls both). No-ops successfully if sync isn't configured or the file isn't resolved
 * to any bin, since there's nothing remote to clean up in that case.
 * @param {string} fileId
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function removeFileFromBin(fileId) {
  const masterKey = appState.sync.masterKey;
  if (!masterKey) return { ok: true };
  const file = appState.files.find((f) => f.id === fileId);
  if (!file) return { ok: true };
  const binId = resolveBinId(file);
  if (!binId) return { ok: true };
  return pushBin(binId, { removeFileIds: [fileId] });
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

  const includeAppMeta = targetBinId === appState.sync.currentBinId;
  const json = serializeBinPayload([...merged.values()], includeAppMeta);
  const compressed = await gzipToBase64(json);
  return pushToBin({ masterKey, binId: targetBinId, payload: compressed });
}
