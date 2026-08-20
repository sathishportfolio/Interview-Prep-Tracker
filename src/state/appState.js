// @ts-check
/**
 * state/appState.js — runtime singleton. The one mutable object every render/feature module reads
 * from and writes to. Not persisted directly (persistence/store.js owns the durable schema);
 * appState is the in-memory working copy plus purely-transient UI state (open nodes, selection
 * sets) that never touches localStorage at all.
 * @typedef {import('../types.js').Question} Question
 * @typedef {import('../types.js').EmptyGroup} EmptyGroup
 * @typedef {import('../types.js').FilterState} FilterState
 * @typedef {import('../types.js').GroupedTree} GroupedTree
 * @typedef {import('../types.js').FileRecord} FileRecord
 * @typedef {import('../types.js').GlobalToggles} GlobalToggles
 * @typedef {import('../types.js').ActiveQuestionPointer} ActiveQuestionPointer
 * @typedef {import('../types.js').TimerState} TimerState
 */
import { emptyFilterState } from "../data/filter.js";

export const appState = {
  /** @type {FileRecord[]} */
  files: [],
  /** @type {string|null} */
  activeFileId: null,

  /** @type {Question[]} rawData of the active file (mirrors the active FileRecord.rawData) */
  rawData: [],
  /** @type {EmptyGroup[]} */
  emptyGroups: [],
  /** @type {FilterState} */
  filterState: emptyFilterState(),
  /** @type {GroupedTree} last computed grouped+filtered tree (render engine reads this) */
  grouped: { subjects: [] },
  /** @type {GroupedTree} grouped but NOT status-filtered (used to compute filter dropdown options) */
  groupedUnfiltered: { subjects: [] },

  /** @type {Set<string>} first-class expand/collapse state — never scraped from the DOM */
  openNodeKeys: new Set(),

  /** @type {ActiveQuestionPointer|null} */
  activeQuestion: null,

  /** @type {GlobalToggles} */
  toggles: {
    flatGroupView: false,
    dragDropOn: true,
    editModeOn: true,
    tempMode: false,
    autoExpandChildrenOn: true,
    themeDark: true,
    autoDownloadOn: false,
  },

  /** @type {TimerState} */
  timer: { running: false, elapsedMs: 0, startedAt: null },

  /** @type {import('../types.js').SyncConfig} */
  sync: { githubToken: null, configGistId: null, lastPushAt: null, lastPullAt: null, lastKnownRemoteUpdatedAt: null, knownVersion: 0, lastMetaPushedHash: null, lastRemoteActiveDevice: null, lastRemoteUpdateTimestamp: null, enabled: true, pullOnly: false },

  /** @type {string[]} App-wide tag registry — see types.js's StorageSchemaV1.globalTags. */
  globalTags: [],

  // --- Transient (never persisted) UI state ---
  /** @type {Set<string>} question IDs currently bulk-selected */
  selectedQuestionIds: new Set(),
  /** @type {Set<string>} "subject::name" / "topic::subj::topic" / "subTopic::..." selected group keys —
   *  a Subject/Topic/SubTopic selected as a WHOLE UNIT for bulk move/delete (its own children are
   *  implied, not separately listed here). */
  selectedGroupKeys: new Set(),
  /** @type {Set<string>} Which specific Subject/Topic/SubTopic containers currently have their OWN
   *  "select mode" turned on — scoped per instance, not a single global on/off. Turning select mode
   *  on for one Topic reveals checkboxes on THAT Topic's own SubTopics only, independent of every
   *  other Topic's select mode. Keyed the same way as selectedGroupKeys (e.g. "topic::S1::T1").
   *  Subject-level selection is the one exception — see enableSubjectSelectMode in bulkSelection.js:
   *  Subjects have no parent container to scope a drill-down from, so selecting SUBJECTS themselves
   *  is a single global toggle (`select-subject-on` body class), not tracked in this set. */
  childSelectModeKeys: new Set(),
  /** @type {string|null} */
  pendingFocusQid: null,
  /** @type {{childLevel: "subject"|"topic"|"subTopic"|"question", parentScope: {subject?: string, topic?: string, subTopic?: string}, selections: string[]}|null}
   *  Click-to-number Reorder mode session — see features/reorderMode.js. `selections` holds sibling
   *  identity (Subject/Topic/SubTopic name, or Question id) in click order; null when no Reorder
   *  session is active anywhere. */
  reorderMode: null,
};

/**
 * Replaces the active-file-scoped slice of appState (called by fileManager on file switch/load).
 * @param {FileRecord} file
 */
export function loadFileIntoState(file) {
  appState.activeFileId = file.id;
  appState.rawData = file.rawData;
  appState.emptyGroups = file.emptyGroups;
  appState.filterState = file.filters;
  appState.openNodeKeys = new Set();
  appState.selectedQuestionIds = new Set();
  appState.selectedGroupKeys = new Set();
  appState.childSelectModeKeys = new Set();
  appState.reorderMode = null;
}

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isNodeOpen(key) {
  return appState.openNodeKeys.has(key);
}

/** @param {string} key */
export function toggleNodeOpen(key) {
  if (appState.openNodeKeys.has(key)) appState.openNodeKeys.delete(key);
  else appState.openNodeKeys.add(key);
}

/**
 * @param {string} key
 * @returns {string[]} Other currently-open keys at the same accordion level ("S::", "subj::T::",
 *   "subj::topic::ST::") and same parent as `key`. Questions (`Q::`) are exclusive globally (across
 *   the whole app, flat view included) rather than scoped to a parent SubTopic, since flat view lists
 *   questions without any Subject/Topic/SubTopic grouping to scope by.
 */
function siblingOpenKeysAtSameLevel(key) {
  if (key.startsWith("Q::")) return [...appState.openNodeKeys].filter((k) => k.startsWith("Q::") && k !== key);
  let prefix;
  if (key.startsWith("S::")) {
    prefix = "S::";
  } else {
    const parts = key.split("::");
    if (parts.length === 3 && parts[1] === "T") prefix = `${parts[0]}::T::`;
    else if (parts.length === 4 && parts[2] === "ST") prefix = `${parts[0]}::${parts[1]}::ST::`;
    else return [];
  }
  return [...appState.openNodeKeys].filter((k) => k.startsWith(prefix) && k !== key);
}

/**
 * Opens `key`, first closing any other Subject/Topic/SubTopic open at the same level under the same
 * parent — keeps only one Subject/Topic/SubTopic accordion active at a time. For Question keys
 * (`Q::`), closes every other open question globally instead — only one question's answer body can
 * be expanded at once, in both tree and flat view.
 * @param {string} key
 */
export function openNodeExclusive(key) {
  for (const sibling of siblingOpenKeysAtSameLevel(key)) appState.openNodeKeys.delete(sibling);
  appState.openNodeKeys.add(key);
}

/** Toggles `key` open/closed; opening applies the same single-open exclusivity as openNodeExclusive. @param {string} key */
export function toggleNodeOpenExclusive(key) {
  if (appState.openNodeKeys.has(key)) appState.openNodeKeys.delete(key);
  else openNodeExclusive(key);
}

/** @param {string} key */
export function setNodeOpen(key, open) {
  if (open) appState.openNodeKeys.add(key);
  else appState.openNodeKeys.delete(key);
}

/** Closes every open node (Close All Accordions). */
export function closeAllNodes() {
  appState.openNodeKeys.clear();
}

/**
 * Opens every ancestor key needed to reveal a given SubTopic/Question chain.
 * @param {string} subject
 * @param {string} topic
 * @param {string} subTopic
 * @param {string} [questionId]
 */
export function expandChain(subject, topic, subTopic, questionId) {
  appState.openNodeKeys.add(`S::${subject}`);
  appState.openNodeKeys.add(`${subject}::T::${topic}`);
  appState.openNodeKeys.add(`${subject}::${topic}::ST::${subTopic}`);
  if (questionId) appState.openNodeKeys.add(`Q::${questionId}`);
}
