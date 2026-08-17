// @ts-check
/**
 * sync/gists.js — the sync engine, single shared gist. Every CSV file and the app-level singletons
 * (`globalToggles`/`activeQuestion`/`timer`/device-tracking meta) all live as separate FILES inside
 * one gist (`appState.sync.configGistId`) — not one gist per CSV. This means there's no separate
 * "manifest" pointer list to go stale or point at the wrong place (an earlier per-file-gist design
 * had exactly that bug: a wrong gist id could get wired up as the pointer target and corrupt
 * whatever it actually pointed at). Everything needed to reconstruct local state — every file's own
 * `id`/`fileName`/content — is self-contained in that one file's own JSON blob, discovered simply by
 * enumerating the gist's `files` object on pull.
 *
 * Each CSV file's blob is named after its own `fileName` (sanitized, deduped — see
 * assignGistFilenames) rather than a generic "data.json", so the gist reads legibly on
 * gist.github.com. The one meta blob is named META_FILENAME and its presence is what distinguishes
 * "this is actually the sync gist" from a stray/wrong gist id (see applyRemotePullResult).
 * @typedef {import('../types.js').FileRecord} FileRecord
 */
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { createGist, pushToGist, pullFromGist, usageAgainstSafeCeiling } from "./github.js";
import { getDeviceId, formatIST } from "./device.js";

const META_FILENAME = "_sync-meta.json";

/**
 * Cheap non-cryptographic string hash (djb2) — only used to notice "did this content change since
 * it was last pushed" for duplicate-push protection, never for anything security-sensitive.
 * @param {string} str
 * @returns {string}
 */
function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/** @param {FileRecord} file @returns {string} JSON content this file's gist blob should hold. */
function serializeFileContent(file) {
  const { id, fileName, rawData, emptyGroups, filters, lastExportVersion, lastExportDate } = file;
  return JSON.stringify({ id, fileName, rawData, emptyGroups, filters, lastExportVersion, lastExportDate });
}

/** @returns {string} */
function serializeMetaContent() {
  return JSON.stringify({
    schemaVersion: 1,
    globalToggles: appState.toggles,
    activeQuestion: appState.activeQuestion,
    timer: appState.timer,
    activeDevice: getDeviceId(),
    isUpdated: true,
    updateTimestamp: formatIST(Date.now()),
  });
}

/** @param {string} str @returns {number} rough UTF-8 byte size of a string, for the safe-ceiling check. */
function byteLength(str) {
  return new Blob([str]).size;
}

/**
 * Informational only (Gist has no hard per-file cap like JSONBin's bin-size cap) — used by
 * syncConfig.js to flag a file nearing the practical ~1MB/file safe ceiling.
 * @param {FileRecord} file
 * @returns {{percent: number, overCap: boolean}}
 */
export function computeFileUsage(file) {
  return usageAgainstSafeCeiling(byteLength(serializeFileContent(file)));
}

/** @param {string} fileName @returns {string} */
function sanitizeBase(fileName) {
  return (fileName || "file").trim().replace(/[^\w.\- ]+/g, "_") || "file";
}

/**
 * Assigns a stable, unique gist filename to every file that doesn't already have one — mutates
 * `file.gistFileName` in place. Existing assignments are never changed (fileNames are immutable once
 * a file is created, so a name assigned on first push stays correct forever); only newly-loaded files
 * get a name computed here. Two different fileNames can in rare cases sanitize to the same base
 * string (e.g. "My File!" and "My File?") — disambiguated with a " (2)", " (3)", ... suffix so they
 * never silently collide and overwrite each other's blob.
 * @param {FileRecord[]} files
 */
function assignGistFilenames(files) {
  const used = new Set(files.map((f) => f.gistFileName).filter(Boolean));
  for (const file of files) {
    if (file.gistFileName) continue;
    const base = sanitizeBase(file.fileName);
    let candidate = `${base}.json`;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${base} (${n}).json`;
      n++;
    }
    file.gistFileName = candidate;
    used.add(candidate);
  }
}

/**
 * Applies an already-fetched gist payload (from pullFromGist) to local state. Validates the meta
 * blob is present first — a genuine sync gist is ALWAYS created with META_FILENAME (see
 * createNewSyncGist/pushAllChangedFiles), so its absence means this gist id isn't actually the sync
 * gist (most likely a stray/wrong id), and applying it as if it were would silently lose data.
 * @param {{files: Record<string, {content: string}>, updatedAt: number|null}} result
 * @returns {{ok: boolean, error?: string, failures?: Array<{fileName: string, error: string}>}}
 */
function applyRemotePullResult(result) {
  const metaRaw = result.files[META_FILENAME]?.content;
  if (!metaRaw) return { ok: false, error: `This gist has no "${META_FILENAME}" file — it isn't the sync gist (maybe the wrong gist id was pasted?).` };
  let meta;
  try {
    meta = JSON.parse(metaRaw);
  } catch {
    return { ok: false, error: "Could not read the sync gist's settings file." };
  }

  const byId = new Map(appState.files.map((f) => [f.id, f]));
  /** @type {Array<{fileName: string, error: string}>} */
  const failures = [];
  for (const [filename, f] of Object.entries(result.files)) {
    if (filename === META_FILENAME) continue;
    try {
      const content = JSON.parse(f.content);
      byId.set(content.id, {
        ...content,
        gistFileName: filename,
        lastPushedHash: hashString(JSON.stringify(content)),
      });
    } catch (e) {
      failures.push({ fileName: filename, error: "Could not parse this file's content." });
      console.error(`Cross-Device Sync: failed to parse "${filename}" from the sync gist: ${e}`);
    }
  }
  appState.files = [...byId.values()];

  if (meta.globalToggles) appState.toggles = meta.globalToggles;
  if (meta.activeQuestion !== undefined) appState.activeQuestion = meta.activeQuestion;
  if (meta.timer) appState.timer = meta.timer;

  appState.sync = {
    ...appState.sync,
    lastPullAt: Date.now(),
    lastKnownRemoteUpdatedAt: result.updatedAt,
    lastRemoteActiveDevice: meta.activeDevice ?? appState.sync.lastRemoteActiveDevice,
    lastRemoteUpdateTimestamp: meta.updateTimestamp ?? appState.sync.lastRemoteUpdateTimestamp,
  };
  store.writeFiles(appState.files);
  store.writeGlobalToggles(appState.toggles);
  store.writeActiveQuestion(appState.activeQuestion);
  store.writeTimer(appState.timer);
  store.writeSync(appState.sync);
  return { ok: true, failures: failures.length > 0 ? failures : undefined };
}

/**
 * Pushes every locally-changed file (new content or never-pushed) plus the meta blob (if the
 * app-level singletons changed) to the shared sync gist in a single PATCH. Duplicate Push Protection:
 * a file/meta blob with unchanged content is skipped entirely, so a push with nothing new to say is a
 * no-op — no request sent at all.
 * @returns {Promise<{ok: boolean, error?: string, skipped?: boolean}>}
 */
export async function pushAllChangedFiles() {
  const token = appState.sync.githubToken;
  const configGistId = appState.sync.configGistId;
  if (!token || !configGistId) return { ok: false, error: "Cross-Device Sync isn't configured." };

  assignGistFilenames(appState.files);

  /** @type {Record<string, {content: string}>} */
  const patch = {};
  let anyFileChanged = false;
  for (const file of appState.files) {
    const content = serializeFileContent(file);
    const hash = hashString(content);
    if (file.lastPushedHash === hash) continue;
    patch[/** @type {string} */ (file.gistFileName)] = { content };
    file.lastPushedHash = hash;
    anyFileChanged = true;
  }

  const metaContent = serializeMetaContent();
  const metaHash = hashString(metaContent);
  const metaChanged = metaHash !== appState.sync.lastMetaPushedHash;
  if (metaChanged) patch[META_FILENAME] = { content: metaContent };

  if (!anyFileChanged && !metaChanged) return { ok: true, skipped: true };

  const result = await pushToGist({ token, gistId: configGistId, files: patch });
  if (!result.ok) return { ok: false, error: result.error };

  if (anyFileChanged) store.writeFiles(appState.files);
  appState.sync = {
    ...appState.sync,
    lastPushAt: Date.now(),
    lastKnownRemoteUpdatedAt: Date.now(),
    ...(metaChanged ? { lastMetaPushedHash: metaHash } : {}),
  };
  store.writeSync(appState.sync);
  return { ok: true, skipped: false };
}

/**
 * Pulls the whole sync gist and applies it to local state unconditionally.
 * @returns {Promise<{ok: boolean, error?: string, failures?: Array<{fileName: string, error: string}>}>}
 */
export async function pullAllFiles() {
  const token = appState.sync.githubToken;
  const configGistId = appState.sync.configGistId;
  if (!token || !configGistId) return { ok: false, error: "Cross-Device Sync isn't configured." };
  const result = await pullFromGist({ token, gistId: configGistId });
  if (!result.ok) return { ok: false, error: result.error };
  return applyRemotePullResult(result);
}

/**
 * Fetches the sync gist and applies it ONLY if its `updated_at` is newer than what this device last
 * knew — used by the silent session-start pull (app.js), which shouldn't clobber local state with a
 * fetch that turns out to be no newer than what's already here. Costs the same single request as
 * pullAllFiles either way (there's no cheaper "metadata only" endpoint for a gist's contents), so
 * this simply decides whether to apply what was already fetched.
 * @returns {Promise<{ok: boolean, applied: boolean, error?: string, failures?: Array<{fileName: string, error: string}>, activeDevice?: string, updateTimestamp?: string}>}
 */
export async function pullIfRemoteNewer() {
  const token = appState.sync.githubToken;
  const configGistId = appState.sync.configGistId;
  if (!token || !configGistId) return { ok: false, applied: false };
  const result = await pullFromGist({ token, gistId: configGistId });
  if (!result.ok) return { ok: false, applied: false, error: result.error };

  const isNewer = result.updatedAt != null && (!appState.sync.lastKnownRemoteUpdatedAt || result.updatedAt > appState.sync.lastKnownRemoteUpdatedAt);
  if (!isNewer) return { ok: true, applied: false };

  let meta;
  try {
    meta = JSON.parse(result.files[META_FILENAME]?.content || "{}");
  } catch {
    meta = {};
  }
  const applied = applyRemotePullResult(result);
  return { ok: applied.ok, applied: applied.ok, error: applied.error, failures: applied.failures, activeDevice: meta.activeDevice, updateTimestamp: meta.updateTimestamp };
}

/**
 * Deletes a file's blob from the shared sync gist (one PATCH, setting its filename to `null` per the
 * Gist API's delete-a-file convention) and removes it from this device's local storage's own record.
 * No-ops successfully if sync isn't configured or the file was never pushed, since there's nothing
 * remote to clean up in that case.
 * @param {string} fileId
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function deleteFileFromGist(fileId) {
  const token = appState.sync.githubToken;
  const configGistId = appState.sync.configGistId;
  if (!token || !configGistId) return { ok: true };
  const file = appState.files.find((f) => f.id === fileId);
  if (!file || !file.gistFileName) return { ok: true };
  return pushToGist({ token, gistId: configGistId, files: { [file.gistFileName]: null } });
}

/**
 * Creates a brand-new sync gist holding the meta blob plus every currently-loaded local file, and
 * connects to it — the setup wizard's "Create new" path. Unlike the old per-file-gist design, this
 * pushes everything already loaded locally right away instead of leaving files stranded until the
 * next auto-push.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function createNewSyncGist() {
  const token = appState.sync.githubToken;
  if (!token) return { ok: false, error: "No GitHub token configured." };

  assignGistFilenames(appState.files);
  /** @type {Record<string, {content: string}>} */
  const files = { [META_FILENAME]: { content: serializeMetaContent() } };
  for (const file of appState.files) {
    files[/** @type {string} */ (file.gistFileName)] = { content: serializeFileContent(file) };
  }

  const result = await createGist({ token, files, description: "Interview Prep Tracker — sync" });
  if (!result.ok) return { ok: false, error: result.error };

  for (const file of appState.files) file.lastPushedHash = hashString(serializeFileContent(file));
  appState.sync = { ...appState.sync, configGistId: result.gistId, lastMetaPushedHash: hashString(serializeMetaContent()) };
  store.writeFiles(appState.files);
  store.writeSync(appState.sync);
  return { ok: true };
}

/**
 * Connects to an existing sync gist id and immediately pulls whatever it already holds — the setup
 * wizard's "Connect existing" path. Validates the id by actually pulling from it BEFORE persisting it
 * as configGistId: if it turns out not to be a real sync gist (see applyRemotePullResult's meta-blob
 * check), the in-memory value is rolled back and nothing is written to storage — otherwise a wrong id
 * would get wired up as the auto-push target and corrupt whatever gist it actually points at.
 * @param {string} configGistId
 * @returns {Promise<{ok: boolean, error?: string, failures?: Array<{fileName: string, error: string}>}>}
 */
export async function connectExistingSyncGist(configGistId) {
  const previousConfigGistId = appState.sync.configGistId;
  appState.sync = { ...appState.sync, configGistId };
  const result = await pullAllFiles();
  if (!result.ok) {
    appState.sync = { ...appState.sync, configGistId: previousConfigGistId };
    return result;
  }
  return result;
}
