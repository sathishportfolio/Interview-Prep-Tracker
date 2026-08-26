// @ts-check
/**
 * types.js — JSDoc-only typedefs for the whole app. No runtime code.
 *
 * These types are the reviewable contract against feature.md before any other code is written.
 *
 * CSV columns (feature.md "CSV Upload"):
 *   Required: Subject, Topic, SubTopic, Question, Answer, Done, ReviewLater
 *   Optional: Duplicate, NotImportant, Starred, Failed, Difficulty, Order, SubjectOrder, TopicOrder, SubTopicOrder
 *   `NotImportant` was previously named `LessImportant` — parsers accept either column name on
 *   import for backward compatibility with older exports, but always serialize `NotImportant`.
 *
 * Six status flags (feature.md "Status Flags"): Done, ReviewLater, Duplicate, NotImportant, Starred, Failed.
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
 * @property {boolean} notImportant  Never affects sort order — a label only (see data/group.js). Can
 *   also be set at the Subject/Topic/SubTopic level (see data/mutations.js's setGroupNotImportant),
 *   which cascades this same field down onto every descendant question.
 * @property {boolean} starred
 * @property {boolean} failed
 * @property {boolean} [visited]     Independent boolean, same shape as starred — manually toggled
 *   from the status-icon-row, never set automatically by opening/viewing a question.
 * @property {"easy"|"medium"|"hard"|null} [difficulty]
 * @property {number} order          Position within its SubTopic.
 * @property {number} subjectOrder
 * @property {number} topicOrder
 * @property {number} subTopicOrder
 * @property {string|null} [srsDue]     Spaced-repetition: ISO date (YYYY-MM-DD) this question is next due for review, or null/undefined if never scheduled.
 * @property {number} [srsStreak]       Spaced-repetition: consecutive "remembered" reviews, used to pick the next interval (see data/mutations.js scheduleReview).
 * @property {number} [doneCount]       Times this question has been marked Done via the Done menu
 *   (see data/mutations.js markStatus) — never decremented, only reset to 0 by resetTriStateHistory.
 * @property {{ts: number, note?: string}[]} [doneHistory]  Timestamped log of every "Mark Done"/
 *   "Mark Done with Notes" click, most-recent last — see data/mutations.js markStatus/resetTriStateHistory.
 * @property {number} [failedCount]     Same as doneCount, for the Failed button's own menu.
 * @property {{ts: number, note?: string}[]} [failedHistory]  Same as doneHistory, for Failed.
 * @property {number} [reviewLaterCount] Same as doneCount, for the Review Later button's own menu.
 * @property {{ts: number, note?: string}[]} [reviewLaterHistory]  Same as doneHistory, for Review Later.
 * @property {string[]} [tags]          Names from the app-wide tag registry (StorageSchemaV1.globalTags)
 *   this question has been tagged with — see data/mutations.js toggleQuestionTag.
 * @property {QuestionLink[]} [links]    Related articles/resources for this question, user-ordered
 *   (see data/mutations.js's addQuestionLink/updateQuestionLink/removeQuestionLink/
 *   reorderQuestionLinks). Rides inside rawData like every other question field — no separate sync
 *   handling needed (data/syncMerge.js's per-question updatedAt-wins merge already covers it).
 * @property {number} [updatedAt]        Date.now()-based, bumped by every data/mutations.js call that
 *   changes this question's fields. Used ONLY by sync/gists.js's per-question merge (data/syncMerge.js)
 *   to decide which side of a pull wins on conflicting edits — never rendered/exported as a
 *   user-facing field beyond the CSV UpdatedAt column (see data/csv/mainCsv.js). Optional so older
 *   in-memory/test objects still typecheck; data/mutations.js's backfillUpdatedAt migration
 *   guarantees every persisted question has one after the first load post-upgrade.
 */

/**
 * A single related-article/resource link attached to a Question, always opened in a new tab.
 * @typedef {Object} QuestionLink
 * @property {string} id      Stable id, assigned once at creation (data/id.js's newLinkId) — used
 *   for edit/remove/reorder targeting, never a display value.
 * @property {string} label   Short user-facing text for the link (e.g. "MDN: Closures").
 * @property {string} url     Full URL, opened via target="_blank" rel="noopener noreferrer".
 */

/**
 * Related Links attached to a Subject/Topic/SubTopic itself (not to any one question underneath
 * it) — see data/groupLinks.js. Tracked as its own flat array, keyed by scope the same way
 * EmptyGroup is (`topic`/`subTopic` null = a Subject-/Topic-level entry), since a group has no
 * question row of its own to carry a `links` array on.
 * @typedef {Object} GroupLinkEntry
 * @property {string} subject
 * @property {string|null} topic
 * @property {string|null} subTopic
 * @property {QuestionLink[]} links
 */

/**
 * A per-file record of a deleted question id, so a pull-merge can distinguish "never existed on
 * this device" from "existed here but was deleted elsewhere" — without this, a device that never
 * saw the delete would resurrect the question on its next sync. See data/syncMerge.js.
 * @typedef {Object} Tombstone
 * @property {string} id          The deleted question's former id.
 * @property {number} deletedAt   Date.now() at time of deletion.
 */

/**
 * A placeholder group with zero questions. Tracked separately from `rawData` (README-AI gotcha #6).
 * @typedef {Object} EmptyGroup
 * @property {string} subject
 * @property {string|null} topic       null = a Subject-level empty marker.
 * @property {string|null} subTopic    null = a Subject- or Topic-level empty marker.
 * @property {number} createdOrder     Preserves creation order among placeholders.
 * @property {boolean} [notImportant]  default false — see Question.notImportant; lets an empty
 *   (zero-question) group still carry a Not Important mark.
 */

/**
 * @typedef {Object} FilterState
 * @property {string[]} subjects
 * @property {string[]} topics
 * @property {string[]} subTopics
 * @property {StatusFilterKey[]} statuses
 * @property {"OR"|"AND"|"NOT"} [statusMode] default "OR" — how multiple entries in `statuses`
 *   combine: "OR" matches a question against ANY selected status, "AND" requires ALL of them, "NOT"
 *   excludes a question matching ANY of them (see data/filter.js's matchesStatus).
 *   Missing/undefined on older persisted filters is treated as "OR", preserving their previous
 *   behavior.
 * @property {string[]} tags Selected tag names (see StorageSchemaV1.globalTags) — a question passes
 *   if it carries ANY of these (OR), same additive feel as `statuses`. Empty = no tag narrowing.
 */

/**
 * "hasAnswer"/"noAnswer" are computed (from whether `answer` is non-blank), not stored booleans.
 * "unmarked" is also computed — none of the three tri-state review flags (done/failed/reviewLater)
 * are set, i.e. a question that hasn't been reviewed at all yet. "difficultyEasy"/"difficultyMedium"/
 * "difficultyHard"/"noDifficulty" are likewise computed, from `Question.difficulty` (`noDifficulty`
 * = unset). "notVisited" is the negation of the stored `visited` boolean.
 * @typedef {"done"|"reviewLater"|"duplicate"|"notImportant"|"starred"|"failed"|"visited"|"notVisited"|"hasAnswer"|"noAnswer"|"unmarked"|"difficultyEasy"|"difficultyMedium"|"difficultyHard"|"noDifficulty"} StatusFilterKey
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
 * @property {Tombstone[]} tombstones   Deleted question ids for this file, each with a deletedAt
 *   timestamp — see data/mutations.js's deleteQuestion/deleteQuestions/deleteGroupCascade (the only
 *   writers) and data/syncMerge.js (the only reader, on pull-merge).
 * @property {GroupLinkEntry[]} [groupLinks]   Related Links scoped to a Subject/Topic/SubTopic
 *   itself — see data/groupLinks.js. Optional so older persisted files (from before this existed)
 *   still typecheck/load; every reader defaults a missing value to `[]`. Synced the same
 *   remote-replaces-local way as `emptyGroups`/`filters` (see sync/gists.js's serializeFileContent) —
 *   no per-link merge attempted.
 */

/**
 * @typedef {Object} GlobalToggles
 * @property {boolean} flatGroupView
 * @property {boolean} dragDropOn     default true
 * @property {boolean} editModeOn
 * @property {boolean} tempMode
 * @property {boolean} autoExpandChildrenOn default true, independent of Edit Mode (on or off) —
 *   opening a Subject/Topic also opens its first Topic/SubTopic in the same click (see
 *   features/autoExpand.js); never cascades to Questions.
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
 * @property {string|null} primaryFileId  Which file loads first on every app open, on every device
 *   (see features/fileManager.js's bootstrapFromStorage and togglePrimaryFile) — set via the
 *   Cross-Device Sync manager and synced through the meta blob (see sync/gists.js) so every device
 *   agrees on it.
 * @property {GlobalToggles} globalToggles
 * @property {ActiveQuestionPointer|null} activeQuestion
 * @property {SyncConfig} sync
 * @property {TimerState} timer
 * @property {string[]} globalTags App-wide tag registry (feature "Tags") — every tag name ever
 *   created, independent of which questions currently carry it, so a tag stays pickable even after
 *   being removed from every question. Mirrored onto appState.globalTags at bootstrap (see
 *   features/fileManager.js) and written via persistence/store.js's writeGlobalTags.
 * @property {Record<string, string[]>} globalTagRelations Directed tag -> related-tags map (Manage
 *   Tags popup, features/tags.js) — assigning a tag to a question auto-applies every tag it maps to
 *   here too (data/mutations.js's toggleQuestionTag). Mirrored onto appState.globalTagRelations at
 *   bootstrap and written via persistence/store.js's writeGlobalTagRelations.
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
 * @property {boolean} notImportant  Derived: true iff every Topic under this Subject is notImportant
 *   (or, for a childless placeholder, its EmptyGroup marker's own notImportant). Display-only, never
 *   affects order/visibility — see data/group.js.
 * @property {number} completePercent  Derived, read-only, 0-100: % of this Subject's child Topics
 *   that are themselves fully done (NOT a raw question-done fraction — see TopicGroup.completePercent
 *   for that). Drives the pie-chart progress circle in the accordion header — purely a readout, never
 *   settable by clicking it; a question's `done` flag is only ever changed via its own action buttons
 *   (see data/group.js, render/groupCompleteButton.js).
 * @property {number} doneCount  Raw count behind completePercent — number of fully-done child Topics
 *   (NOT questions — see completePercent above).
 * @property {number} totalCount  Raw count behind completePercent — total child Topics.
 * @property {number} ignoredCount  Informational only (Subject's own percent is Topic-based, not
 *   question-based) — total Not Important questions across every Topic underneath.
 * @property {number} order
 * @property {TopicGroup[]} topics
 */

/**
 * @typedef {Object} TopicGroup
 * @property {string} subject
 * @property {string} topic
 * @property {boolean} isEmpty
 * @property {boolean} notImportant  Derived — see SubjectGroup.notImportant.
 * @property {number} completePercent  Derived, read-only, 0-100: % of every question under this Topic
 *   (across all its SubTopics) that has `done` set — unlike SubjectGroup.completePercent, this IS a
 *   raw question-done fraction, not a count of fully-done child SubTopics. Not Important questions are
 *   excluded from both the numerator and denominator (see data/group.js).
 * @property {number} doneCount  Raw count behind completePercent — Done, non-Not-Important questions.
 * @property {number} totalCount  Raw count behind completePercent — non-Not-Important questions.
 * @property {number} ignoredCount  Not Important questions excluded from completePercent's fraction.
 * @property {number} order
 * @property {SubTopicGroup[]} subTopics
 */

/**
 * @typedef {Object} SubTopicGroup
 * @property {string} subject
 * @property {string} topic
 * @property {string} subTopic
 * @property {boolean} isEmpty
 * @property {boolean} notImportant  Derived — see SubjectGroup.notImportant.
 * @property {number} completePercent  Derived, read-only, 0-100: % of this SubTopic's own questions
 *   with `done` set — same leaf-level fraction TopicGroup.completePercent aggregates across SubTopics.
 *   Not Important questions are excluded from both the numerator and denominator (see data/group.js).
 * @property {number} doneCount  Raw count behind completePercent — Done, non-Not-Important questions.
 * @property {number} totalCount  Raw count behind completePercent — non-Not-Important questions.
 * @property {number} ignoredCount  Not Important questions excluded from completePercent's fraction.
 * @property {number} order
 * @property {Question[]} questions   Sorted by persisted `order` only — notImportant/difficulty are
 *   labels, never tiering (see data/group.js).
 */

/**
 * @typedef {Object} CopyFormatResult
 * @property {string} text
 */

export {};
