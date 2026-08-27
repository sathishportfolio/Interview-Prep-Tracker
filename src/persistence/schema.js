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
    // Which file to load first on every app open, on every device, regardless of load order or
    // which file was last active locally — set via sync/syncConfig.js's Cross-Device Sync manager
    // and synced through the meta blob (see sync/gists.js) so it's the same on every device.
    primaryFileId: null,
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
      youtubeAutoplayOn: false,
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
    // Directed tag -> related-tags map (see features/tags.js's Manage Tags popup): assigning a tag
    // to a question auto-applies every tag it's mapped to here too (data/mutations.js's
    // toggleQuestionTag).
    globalTagRelations: {},
    // Per-tag display metadata (custom FA icon class) set from the Manage Tags popup — see
    // data/tagIcon.js's pickDisplayTagIcon, which shows a question's FIRST tag's icon (if it has
    // one) before its text.
    globalTagMeta: {},
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
    primaryFileId: raw.primaryFileId ?? base.primaryFileId,
    globalToggles: { ...base.globalToggles, ...(raw.globalToggles || {}) },
    activeQuestion: raw.activeQuestion ?? base.activeQuestion,
    sync: coerceSync(raw.sync),
    timer: { ...base.timer, ...(raw.timer || {}) },
    globalTags: Array.isArray(raw.globalTags) ? raw.globalTags : base.globalTags,
    globalTagRelations: raw.globalTagRelations && typeof raw.globalTagRelations === "object" ? raw.globalTagRelations : base.globalTagRelations,
    globalTagMeta: raw.globalTagMeta && typeof raw.globalTagMeta === "object" ? raw.globalTagMeta : base.globalTagMeta,
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
