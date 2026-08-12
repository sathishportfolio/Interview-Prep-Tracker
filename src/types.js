// @ts-check
/**
 * types.js — JSDoc-only typedefs for the whole app. No runtime code.
 *
 * These types are the reviewable contract against feature.md before any other code is written.
 *
 * CSV columns (feature.md "CSV Upload"):
 *   Required: Subject, Topic, SubTopic, Question, Answer, Done, ReviewLater
 *   Optional: Duplicate, LessImportant, Starred, Order, SubjectOrder, TopicOrder, SubTopicOrder
 *
 * Five status flags (feature.md "Status Flags"): Done, ReviewLater, Duplicate, LessImportant, Starred.
 */

/**
 * @typedef {Object} Question
 * @property {string} id            Stable internal ID, assigned once at CSV import time. Never a CSV column.
 * @property {string} subject
 * @property {string} topic
 * @property {string} subTopic
 * @property {string} question
 * @property {string} answer        HTML-supporting rich text.
 * @property {boolean} done
 * @property {boolean} reviewLater
 * @property {boolean} duplicate
 * @property {boolean} lessImportant
 * @property {boolean} starred
 * @property {number} order          Position within its SubTopic (post-tiering tie-break).
 * @property {number} subjectOrder
 * @property {number} topicOrder
 * @property {number} subTopicOrder
 * @property {string|null} [srsDue]     Spaced-repetition: ISO date (YYYY-MM-DD) this question is next due for review, or null/undefined if never scheduled.
 * @property {number} [srsStreak]       Spaced-repetition: consecutive "remembered" reviews, used to pick the next interval (see data/mutations.js scheduleReview).
 */

/**
 * A placeholder group with zero questions. Tracked separately from `rawData` (README-AI gotcha #6).
 * @typedef {Object} EmptyGroup
 * @property {string} subject
 * @property {string|null} topic       null = a Subject-level empty marker.
 * @property {string|null} subTopic    null = a Subject- or Topic-level empty marker.
 * @property {number} createdOrder     Preserves creation order among placeholders.
 */

/**
 * @typedef {Object} FilterState
 * @property {string[]} subjects
 * @property {string[]} topics
 * @property {string[]} subTopics
 * @property {StatusFilterKey[]} statuses
 */

/**
 * "dueForReview" is not a real boolean field on Question — it's a computed match against
 * `srsDue` vs today, handled as a special case in data/filter.js's matchesStatus.
 * @typedef {"done"|"reviewLater"|"duplicate"|"lessImportant"|"starred"|"dueForReview"} StatusFilterKey
 */

/**
 * @typedef {Object} FileRecord
 * @property {string} id
 * @property {string} fileName
 * @property {Question[]} rawData
 * @property {EmptyGroup[]} emptyGroups
 * @property {FilterState} filters
 * @property {string|null} lastExportVersion   e.g. "v003"
 * @property {string|null} lastExportDate      e.g. "Aug07" (matches export filename token)
 * @property {string|null} binId   Sync bin this file lives in. null = the current bin
 *   (SyncConfig.currentBinId) — most files stay null; only set when a file has been moved/copied
 *   to a bin of its own (e.g. to keep it out of a bin that's near the free-tier size cap).
 */

/**
 * @typedef {Object} GlobalToggles
 * @property {boolean} flatGroupView
 * @property {boolean} dragDropOn     default true
 * @property {boolean} editModeOn
 * @property {boolean} tempMode
 * @property {boolean} autoExpandChildrenOn default false — opening a Subject/Topic also opens its
 *   first Topic/SubTopic in the same click (see features/autoExpand.js); never cascades to Questions.
 * @property {boolean} themeDark default true — see features/theme.js.
 * @property {boolean} [autoDownloadOn] default false — periodic CSV auto-download backstop, synced
 *   like every other toggle here (see features/autoDownload.js).
 */

/**
 * @typedef {Object} ActiveQuestionPointer
 * @property {string} fileId
 * @property {string} questionId
 */

/**
 * @typedef {Object} BinInfo
 * @property {string} id
 * @property {string} label   User-facing nickname, e.g. "Overflow bin" — the id itself is the
 *   only thing that matters functionally, this is just so the manager UI is legible.
 * @property {string} [description]   Optional longer note, e.g. "Archived questions from 2023" —
 *   most users skip this entirely (see sync/syncConfig.js's Edit Bin dialog); never required to
 *   create or rename a bin.
 */

/**
 * Cross-Device Sync config. JSONBin's Master Key is account-wide (works against any bin under
 * that account), so there's exactly one masterKey but potentially many bins: `currentBinId` is the
 * ONE bin everything syncs through — the File Switcher only ever shows files that resolve to it
 * (see sync/bins.js's resolveBinId), and Push/Pull/usage-% all target it exclusively. `knownBins`
 * is the registry of every other bin the user has created/used (for switching which bin is current,
 * and the "move/copy file to a bin" UI in sync/syncConfig.js's manager). Sync timestamps
 * (`lastPushAt`/`lastPullAt`/`lastKnownRemoteUpdatedAt`) are set by sync/bins.js on manual push/pull
 * (see sync/manualPush.js, sync/manualPull.js) and persisted like the rest of this config.
 * @typedef {Object} SyncConfig
 * @property {string|null} masterKey
 * @property {string|null} currentBinId
 * @property {BinInfo[]} knownBins
 * @property {number|null} lastPushAt
 * @property {number|null} lastPullAt
 * @property {number|null} lastKnownRemoteUpdatedAt
 * @property {string|null} [lastPushedPayloadHash] Hash of this device's last-pushed bin content
 *   (sync/bins.js's pushCurrentBinIfChanged) — lets a repeated Push with no new edits be detected
 *   and skipped (Duplicate Push Protection) instead of burning a JSONBin request.
 * @property {string|null} [lastRemoteActiveDevice] Device ID (see sync/device.js) that made the
 *   most recently pulled/pushed bin's last write — purely informational/display, not used for any
 *   sync decision.
 * @property {string|null} [lastRemoteUpdateTimestamp] IST-formatted ("MMM dd, yyyy HH:mm:ss") wall-
 *   clock time of that same last write — shown in the Auto-Pull-on-Login toast (see app.js).
 * @property {boolean} enabled false = auto-push backstop paused (conserves JSONBin API usage);
 *   Manual Push/Pull remain available regardless. Defaults false on fresh installs, true for
 *   pre-existing configured installs (see persistence/schema.js's coerceSync).
 */

/**
 * @typedef {Object} TimerState
 * @property {boolean} running
 * @property {number} elapsedMs        Accumulated elapsed time while not running.
 * @property {number|null} startedAt   Timestamp (Date.now()) when currently-running segment started; null if paused.
 */

/**
 * Root persisted object, single localStorage key `iqv:v1`.
 * @typedef {Object} StorageSchemaV1
 * @property {number} schemaVersion
 * @property {FileRecord[]} files
 * @property {string|null} activeFileId
 * @property {GlobalToggles} globalToggles
 * @property {ActiveQuestionPointer|null} activeQuestion
 * @property {SyncConfig} sync
 * @property {TimerState} timer
 */

/**
 * Grouped tree shape produced by data/group.js.
 * @typedef {Object} GroupedTree
 * @property {SubjectGroup[]} subjects
 */

/**
 * @typedef {Object} SubjectGroup
 * @property {string} subject
 * @property {boolean} isEmpty
 * @property {number} order
 * @property {TopicGroup[]} topics
 */

/**
 * @typedef {Object} TopicGroup
 * @property {string} subject
 * @property {string} topic
 * @property {boolean} isEmpty
 * @property {number} order
 * @property {SubTopicGroup[]} subTopics
 */

/**
 * @typedef {Object} SubTopicGroup
 * @property {string} subject
 * @property {string} topic
 * @property {string} subTopic
 * @property {boolean} isEmpty
 * @property {number} order
 * @property {Question[]} questions   Already tiered/sorted: starred first, normal, lessImportant last.
 */

/**
 * @typedef {Object} CopyFormatResult
 * @property {string} text
 */

export {};
