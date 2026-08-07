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

/** @typedef {"done"|"reviewLater"|"duplicate"|"lessImportant"|"starred"} StatusFilterKey */

/**
 * @typedef {Object} FileRecord
 * @property {string} id
 * @property {string} fileName
 * @property {Question[]} rawData
 * @property {EmptyGroup[]} emptyGroups
 * @property {FilterState} filters
 * @property {string|null} lastExportVersion   e.g. "v003"
 * @property {string|null} lastExportDate      e.g. "Aug07" (matches export filename token)
 */

/**
 * @typedef {Object} GlobalToggles
 * @property {boolean} flatGroupView
 * @property {boolean} dragDropOn     default true
 * @property {boolean} editModeOn
 * @property {boolean} tempMode
 */

/**
 * @typedef {Object} ActiveQuestionPointer
 * @property {string} fileId
 * @property {string} questionId
 */

/**
 * @typedef {Object} SyncConfig
 * @property {string|null} masterKey
 * @property {string|null} binId
 * @property {number|null} lastPushAt
 * @property {number|null} lastPullAt
 * @property {number|null} lastKnownRemoteUpdatedAt
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
