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
    },
    activeQuestion: null,
    sync: {
      masterKey: null,
      binId: null,
      lastPushAt: null,
      lastPullAt: null,
      lastKnownRemoteUpdatedAt: null,
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
    files: Array.isArray(raw.files) ? raw.files : base.files,
    activeFileId: raw.activeFileId ?? base.activeFileId,
    globalToggles: { ...base.globalToggles, ...(raw.globalToggles || {}) },
    activeQuestion: raw.activeQuestion ?? base.activeQuestion,
    sync: { ...base.sync, ...(raw.sync || {}) },
    timer: { ...base.timer, ...(raw.timer || {}) },
  };
}
