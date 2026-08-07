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
  },

  /** @type {TimerState} */
  timer: { running: false, elapsedMs: 0, startedAt: null },

  /** @type {import('../types.js').SyncConfig} */
  sync: { masterKey: null, defaultBinId: null, knownBins: [], lastPushAt: null, lastPullAt: null, lastKnownRemoteUpdatedAt: null },

  // --- Transient (never persisted) UI state ---
  /** @type {Set<string>} question IDs currently bulk-selected (per active SubTopic selection UI) */
  selectedQuestionIds: new Set(),
  /** @type {Set<string>} "Subject::name" / "Topic::subj::topic" / "SubTopic::..." selected group keys */
  selectedGroupKeys: new Set(),
  /** @type {string|null} */
  pendingFocusQid: null,
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
