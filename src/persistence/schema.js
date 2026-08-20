// @ts-check
/**
 * persistence/schema.js — SCHEMA_VERSION + single root localStorage key. One envelope, not
 * scattered keys. Zero DOM logic beyond the key name itself (actual localStorage I/O lives in
 * store.js).
 * @typedef {import('../types.js').StorageSchemaV1} StorageSchemaV1
 */

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = "iqv:v1";

/**
 * @returns {StorageSchemaV1}
 */
export function emptySchema() {
  return {
    schemaVersion: SCHEMA_VERSION,
    files: [],
    activeFileId: null,
    globalToggles: {
      flatGroupView: false,
      dragDropOn: true,
      editModeOn: true,
      tempMode: false,
      autoExpandChildrenOn: true,
      themeDark: true,
      autoDownloadOn: false,
      filterCardOpen: false,
      statsProgressVisible: false,
    },
    activeQuestion: null,
    sync: {
      githubToken: null,
      configGistId: null,
      lastPushAt: null,
      lastPullAt: null,
      lastKnownRemoteUpdatedAt: null,
      knownVersion: 0,
      lastMetaPushedHash: null,
      lastRemoteActiveDevice: null,
      lastRemoteUpdateTimestamp: null,
      // Auto-sync defaults ON: once a gist is connected, edits push automatically without an extra
      // opt-in step (Gist's limits are generous enough to afford this — see sync/autoPush.js).
      enabled: true,
      // Pull Only defaults OFF — pushing works normally unless explicitly opted out of (see
      // sync/manualPush.js and sync/autoPush.js).
      pullOnly: false,
    },
    timer: {
      running: false,
      elapsedMs: 0,
      startedAt: null,
    },
    globalTags: [],
  };
}

/**
 * Validates/coerces a parsed JSON value into a StorageSchemaV1 shape, filling in any missing
 * fields with defaults (forward-compatible with older/partial saved states).
 * @param {any} raw
 * @returns {StorageSchemaV1}
 */
export function coerceSchema(raw) {
  const base = emptySchema();
  if (!raw || typeof raw !== "object") return base;
  return {
    schemaVersion: SCHEMA_VERSION,
    files: Array.isArray(raw.files) ? raw.files.map((f) => ({ gistFileName: null, lastPushedHash: null, tombstones: [], ...f })) : base.files,
    activeFileId: raw.activeFileId ?? base.activeFileId,
    globalToggles: { ...base.globalToggles, ...(raw.globalToggles || {}) },
    activeQuestion: raw.activeQuestion ?? base.activeQuestion,
    sync: coerceSync(raw.sync),
    timer: { ...base.timer, ...(raw.timer || {}) },
    globalTags: Array.isArray(raw.globalTags) ? raw.globalTags : base.globalTags,
  };
}

/**
 * Sync-specific coercion. No migration from the old JSONBin fields (`masterKey`/`currentBinId`/
 * `knownBins`/`binId`) — a JSONBin master key and bin id have no meaningful mapping onto a GitHub
 * token and gist id, so a pre-Gist-migration schema simply comes back unconfigured here and the user
 * reconnects via the setup wizard (see app.js's one-shot "reconnect" toast, which detects a legacy
 * `masterKey` field before this function drops it).
 * @param {any} rawSync
 */
function coerceSync(rawSync) {
  const base = emptySchema().sync;
  if (!rawSync || typeof rawSync !== "object") return base;
  return {
    githubToken: typeof rawSync.githubToken === "string" ? rawSync.githubToken : base.githubToken,
    configGistId: typeof rawSync.configGistId === "string" ? rawSync.configGistId : base.configGistId,
    lastPushAt: rawSync.lastPushAt ?? base.lastPushAt,
    lastPullAt: rawSync.lastPullAt ?? base.lastPullAt,
    lastKnownRemoteUpdatedAt: rawSync.lastKnownRemoteUpdatedAt ?? base.lastKnownRemoteUpdatedAt,
    knownVersion: typeof rawSync.knownVersion === "number" ? rawSync.knownVersion : base.knownVersion,
    lastMetaPushedHash: rawSync.lastMetaPushedHash ?? base.lastMetaPushedHash,
    lastRemoteActiveDevice: rawSync.lastRemoteActiveDevice ?? base.lastRemoteActiveDevice,
    lastRemoteUpdateTimestamp: rawSync.lastRemoteUpdateTimestamp ?? base.lastRemoteUpdateTimestamp,
    // Auto-sync defaults ON (base.enabled is true) — an explicit persisted value always wins, so a
    // user who deliberately paused it stays paused across reloads.
    enabled: rawSync.enabled ?? base.enabled,
    pullOnly: rawSync.pullOnly ?? base.pullOnly,
  };
}
