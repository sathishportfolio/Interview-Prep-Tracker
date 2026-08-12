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
      autoExpandChildrenOn: false,
      themeDark: true,
      autoDownloadOn: false,
    },
    activeQuestion: null,
    sync: {
      masterKey: null,
      currentBinId: null,
      knownBins: [],
      lastPushAt: null,
      lastPullAt: null,
      lastKnownRemoteUpdatedAt: null,
      lastPushedPayloadHash: null,
      lastRemoteActiveDevice: null,
      lastRemoteUpdateTimestamp: null,
      enabled: false,
    },
    timer: {
      running: false,
      elapsedMs: 0,
      startedAt: null,
    },
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
    files: Array.isArray(raw.files) ? raw.files.map((f) => ({ binId: null, ...f })) : base.files,
    activeFileId: raw.activeFileId ?? base.activeFileId,
    globalToggles: { ...base.globalToggles, ...(raw.globalToggles || {}) },
    activeQuestion: raw.activeQuestion ?? base.activeQuestion,
    sync: coerceSync(raw.sync),
    timer: { ...base.timer, ...(raw.timer || {}) },
  };
}

/**
 * Sync-specific coercion: also migrates older shapes into `currentBinId` — the pre-multi-bin
 * single `binId` field, then the later `defaultBinId` field (renamed once "default bin" became
 * "current bin" everywhere, since only one bin is ever synced at a time) — so older
 * persisted/pulled schemas keep working unchanged.
 * @param {any} rawSync
 */
function coerceSync(rawSync) {
  const base = emptySchema().sync;
  if (!rawSync || typeof rawSync !== "object") return base;
  return {
    ...base,
    ...rawSync,
    currentBinId: rawSync.currentBinId ?? rawSync.defaultBinId ?? rawSync.binId ?? base.currentBinId,
    knownBins: Array.isArray(rawSync.knownBins) ? rawSync.knownBins : base.knownBins,
    // Pre-existing configured schemas (from before this field existed) infer `enabled: true` so
    // upgrading doesn't silently pause a working sync setup; brand-new schemas keep `base`'s false.
    // An explicit persisted value (either true or false) always wins over the inference.
    enabled: rawSync.enabled ?? !!(rawSync.masterKey && (rawSync.currentBinId || rawSync.defaultBinId || rawSync.binId)),
  };
}
