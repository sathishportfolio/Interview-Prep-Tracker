// @ts-check
/**
 * persistence/store.js — typed read/write of the single StorageSchemaV1 envelope. Emits an
 * "iqv:persisted" DOM CustomEvent on every successful write — the explicit hook `sync/autoPush.js`
 * subscribes to (not a monkey-patched `localStorage.setItem`), not to push on every edit, but as
 * the dirty-tracking signal for its 1-minute-unpushed backstop and close-tab warning. The actual
 * storage backend is pluggable (see setBackend) so tempMode.js can redirect writes to an in-memory
 * Map without this module needing to know about "temp mode" as a concept itself.
 * @typedef {import('../types.js').StorageSchemaV1} StorageSchemaV1
 * @typedef {import('../types.js').FileRecord} FileRecord
 * @typedef {import('../types.js').GlobalToggles} GlobalToggles
 * @typedef {import('../types.js').ActiveQuestionPointer} ActiveQuestionPointer
 * @typedef {import('../types.js').SyncConfig} SyncConfig
 * @typedef {import('../types.js').TimerState} TimerState
 */
import { STORAGE_KEY, emptySchema, coerceSchema } from "./schema.js";

/**
 * @typedef {Object} StorageBackend
 * @property {() => string|null} getItem
 * @property {(value: string) => void} setItem
 */

/** @type {StorageBackend} */
let backend = {
  getItem: () => {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  setItem: (value) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // storage full/unavailable — swallow, caller can't do much about it here
    }
  },
};

/**
 * Swaps the storage backend (used by tempMode.js to redirect to an in-memory Map).
 * @param {StorageBackend} newBackend
 */
export function setBackend(newBackend) {
  backend = newBackend;
}

/**
 * Event target "iqv:persisted" is dispatched on. Defaults to `document`; overridable for
 * `node --test` (no DOM present) via setEventTarget.
 * @type {{dispatchEvent: (e: any) => void}}
 */
let eventTarget = typeof document !== "undefined" ? document : { dispatchEvent: () => {} };

/** @param {{dispatchEvent: (e: any) => void}} target */
export function setEventTarget(target) {
  eventTarget = target;
}

/** @returns {StorageSchemaV1} */
export function readSchema() {
  const raw = backend.getItem();
  if (!raw) return emptySchema();
  try {
    return coerceSchema(JSON.parse(raw));
  } catch {
    return emptySchema();
  }
}

/**
 * Writes the full schema and emits "iqv:persisted".
 * @param {StorageSchemaV1} schema
 */
export function writeSchema(schema) {
  backend.setItem(JSON.stringify(schema));
  eventTarget.dispatchEvent(new CustomEvent("iqv:persisted", { detail: { schema } }));
}

/** @param {FileRecord[]} files */
export function writeFiles(files) {
  const schema = readSchema();
  writeSchema({ ...schema, files });
}

/** @param {string|null} activeFileId */
export function writeActiveFileId(activeFileId) {
  const schema = readSchema();
  writeSchema({ ...schema, activeFileId });
}

/** @param {string|null} primaryFileId */
export function writePrimaryFileId(primaryFileId) {
  const schema = readSchema();
  writeSchema({ ...schema, primaryFileId });
}

/** @param {GlobalToggles} globalToggles */
export function writeGlobalToggles(globalToggles) {
  const schema = readSchema();
  writeSchema({ ...schema, globalToggles });
}

/** @param {ActiveQuestionPointer|null} activeQuestion */
export function writeActiveQuestion(activeQuestion) {
  const schema = readSchema();
  writeSchema({ ...schema, activeQuestion });
}

/** @param {SyncConfig} sync */
export function writeSync(sync) {
  const schema = readSchema();
  writeSchema({ ...schema, sync });
}

/** @param {TimerState} timer */
export function writeTimer(timer) {
  const schema = readSchema();
  writeSchema({ ...schema, timer });
}

/** @param {string[]} globalTags */
export function writeGlobalTags(globalTags) {
  const schema = readSchema();
  writeSchema({ ...schema, globalTags });
}

/** @param {Record<string, string[]>} globalTagRelations */
export function writeGlobalTagRelations(globalTagRelations) {
  const schema = readSchema();
  writeSchema({ ...schema, globalTagRelations });
}

/** Wipes all persisted data (Reset All Data). */
export function clearAll() {
  writeSchema(emptySchema());
}
