// @ts-check
/**
 * types.js — JSDoc-only typedefs for the whole app. No runtime code.
 *
 * These types are the reviewable contract against feature.md before any other code is written.
 *
 * CSV columns (feature.md "CSV Upload"):
 *   Required: Subject, Topic, SubTopic, Question, Answer, Done, ReviewLater
 *   Optional: Duplicate, LessImportant, Starred, Failed, Order, SubjectOrder, TopicOrder, SubTopicOrder
 *
 * Six status flags (feature.md "Status Flags"): Done, ReviewLater, Duplicate, LessImportant, Starred, Failed.
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
 * @property {boolean} failed
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
 * @property {"OR"|"AND"} [statusMode] default "OR" — how multiple entries in `statuses` combine:
 *   "OR" matches a question against ANY selected status, "AND" requires ALL of them (see
 *   data/filter.js's matchesStatus). Missing/undefined on older persisted filters is treated as
 *   "OR", preserving their previous behavior.
 */

/**
 * "dueForReview" is not a real boolean field on Question — it's a computed match against
 * `srsDue` vs today, handled as a special case in data/filter.js's matchesStatus. "hasAnswer"/
 * "noAnswer" are likewise computed (from whether `answer` is non-blank), not stored booleans.
 * "unmarked" is also computed — none of the three tri-state review flags (done/failed/reviewLater)
 * are set, i.e. a question that hasn't been reviewed at all yet.
 * @typedef {"done"|"reviewLater"|"duplicate"|"lessImportant"|"starred"|"failed"|"dueForReview"|"hasAnswer"|"noAnswer"|"unmarked"} StatusFilterKey
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
 * @property {string|null} gistFileName   This file's own blob name within the single shared sync
 *   gist (SyncConfig.configGistId) — e.g. "My CSV.json", sanitized/deduped from fileName (see
 *   sync/gists.js's assignGistFilenames). null until the file's first successful push, which assigns
 *   it. Every file shares the same gist; this is just which blob inside it is this file's own.
 * @property {string|null} lastPushedHash   Hash of this file's content as of its last successful
 *   push (sync/gists.js's pushAllChangedFiles) — lets an unchanged file be skipped on the next push
 *   instead of burning a Gist API request on a no-op PATCH.
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
 * @property {boolean} [filterCardOpen] default false — whether the Filters card body is expanded;
 *   synced like every other toggle here so the open/closed state carries across devices.
 * @property {boolean} [statsProgressVisible] default false — whether the Stats dropdown's
 *   Done/Review/Failed breakdown progress bar is shown; synced like every other toggle here so it
 *   carries across devices (see render/statsBadges.js's renderStatsProgress).
 */

/**
 * @typedef {Object} ActiveQuestionPointer
 * @property {string} fileId
 * @property {string} questionId
 */

/**
 * Cross-Device Sync config. `githubToken` is a GitHub Personal Access Token (fine-grained, `gist`
 * scope recommended) — account-wide, works against any gist under that account. `configGistId`
 * points at the single shared gist EVERYTHING syncs through: every CSV file's own content blob plus
 * one meta blob for the app-level singletons (globalToggles/activeQuestion/timer/device-tracking
 * meta) all live inside this one gist (see sync/gists.js) — there's no separate per-file gist and no
 * separate pointer/manifest gist. Sync timestamps (`lastPushAt`/`lastPullAt`/
 * `lastKnownRemoteUpdatedAt`) are set by sync/gists.js on manual push/pull (see sync/manualPush.js,
 * sync/manualPull.js) and persisted like the rest of this config.
 * @typedef {Object} SyncConfig
 * @property {string|null} githubToken
 * @property {string|null} configGistId
 * @property {number|null} lastPushAt
 * @property {number|null} lastPullAt
 * @property {number|null} lastKnownRemoteUpdatedAt
 * @property {number} [knownVersion] This device's last-known remote version number (the meta blob's
 *   `version` field — see sync/gists.js). A push is blocked if the remote's real version is ahead of
 *   this, meaning some other device pushed since this device last pulled (see
 *   pushAllChangedFiles' pre-push validation). 0 until the first successful push/pull.
 * @property {string|null} [lastMetaPushedHash] Hash of this device's last-pushed meta-blob content
 *   (sync/gists.js's pushAllChangedFiles) — lets a repeated push with no new meta changes skip
 *   re-sending that blob instead of burning API bandwidth on a no-op.
 * @property {string|null} [lastRemoteActiveDevice] Device ID (see sync/device.js) of whichever
 *   device most recently completed a successful write (the meta blob's `lastWriter` field) — purely
 *   informational/display (the "Synced at ... from ..." label), NOT the same thing as the meta
 *   blob's `activeDevice` write-lock field, which is transient and normally null.
 * @property {string|null} [lastRemoteUpdateTimestamp] IST-formatted ("MMM dd, yyyy HH:mm:ss") wall-
 *   clock time of that same last write — shown in the Auto-Pull-on-Login toast (see app.js).
 * @property {boolean} enabled false = auto-push paused; Manual Push/Pull remain available
 *   regardless. Defaults true (see persistence/schema.js's emptySchema) — auto-sync is on by default
 *   once a gist is connected.
 * @property {boolean} [pullOnly] default false — blocks ALL pushing (both the Manual Push button
 *   and the auto-push backstop, regardless of `enabled`) while leaving Manual Pull fully working.
 *   For orgs that block/monitor outbound writes to GitHub Gist — see sync/manualPush.js and
 *   sync/autoPush.js, the two places this is enforced.
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
