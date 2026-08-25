// @ts-check
/**
 * features/bulkSelection.js — Bulk Selection & Bulk Actions across every level: Subjects, Topics,
 * SubTopics, and Questions can all be selected simultaneously and acted on together (Move/Delete)
 * via the floating bulk-action bar (#bulkSelectionBar).
 *
 * Selection has two independent layers:
 *  - `appState.selectedGroupKeys` / `selectedQuestionIds` — WHAT is selected (a flat set of group
 *    keys "level::subject::topic::subTopic" plus a flat set of question ids). Selecting a whole
 *    Subject/Topic/SubTopic implies everything nested inside it for bulk actions, without needing to
 *    separately list every descendant.
 *  - `appState.childSelectModeKeys` — WHERE checkboxes are currently visible. Each Subject/Topic/
 *    SubTopic's own "select mode" toggle is SCOPED to that one instance: turning it on for one Topic
 *    reveals checkboxes on that Topic's own SubTopics only, independent of every other Topic. The one
 *    exception is Subjects themselves — with no parent container to scope a drill-down from,
 *    selecting SUBJECTS is a single global toggle (`select-subject-on` body class, see
 *    enableSubjectSelectMode), not tracked in childSelectModeKeys.
 */
import { deleteGroupCascade, deleteQuestions, moveGroup, moveQuestions, countQuestionsIn } from "../data/mutations.js";
import { groupKey, parseGroupKey } from "../data/selectionKeys.js";
import { applyDataChange, repaint } from "./refresh.js";
import { appState } from "../state/appState.js";
import { showToast, confirmAction } from "./toast.js";

/** @typedef {import("../data/selectionKeys.js").GroupLevel} GroupLevel */
/** @typedef {import("../data/selectionKeys.js").GroupScope} GroupScope */

/** Global toggle: reveals a checkbox on every Subject header, for selecting whole Subjects — see module doc comment for why this one level is global, not scoped. Does NOT auto-select every Subject; the user picks specific ones via their own checkboxes. */
export function enableSubjectSelectMode() {
  document.body.classList.add("select-subject-on");
  updateSelectionBar();
}

/**
 * Scoped per-instance "select mode": turns on/off checkbox visibility for ONE container's own
 * direct children (Subject -> its Topics, Topic -> its SubTopics, SubTopic -> its Questions).
 * @param {GroupLevel} parentLevel
 * @param {GroupScope} parentScope
 */
export function toggleChildSelectMode(parentLevel, parentScope) {
  const key = groupKey(parentLevel, parentScope);
  const active = appState.childSelectModeKeys.has(key);
  if (active) {
    appState.childSelectModeKeys.delete(key);
    clearChildSelections(parentLevel, parentScope);
  } else {
    appState.childSelectModeKeys.add(key);
  }
  updateSelectionBar();
}

/** @param {GroupLevel} parentLevel @param {GroupScope} parentScope */
function clearChildSelections(parentLevel, parentScope) {
  if (parentLevel === "subject") {
    const prefix = `topic::${parentScope.subject}::`;
    appState.selectedGroupKeys = new Set([...appState.selectedGroupKeys].filter((k) => !k.startsWith(prefix)));
  } else if (parentLevel === "topic") {
    const prefix = `subTopic::${parentScope.subject}::${parentScope.topic}::`;
    appState.selectedGroupKeys = new Set([...appState.selectedGroupKeys].filter((k) => !k.startsWith(prefix)));
  } else {
    // Full rawData here (not the filtered tree) is deliberate — clearing should drop every
    // selection under this parent, including any question a filter change since selecting it may
    // have hidden, not just whatever's currently visible.
    const idsHere = new Set(
      appState.rawData
        .filter((q) => q.subject === parentScope.subject && q.topic === parentScope.topic && q.subTopic === parentScope.subTopic)
        .map((q) => q.id)
    );
    appState.selectedQuestionIds = new Set([...appState.selectedQuestionIds].filter((id) => !idsHere.has(id)));
  }
}

/**
 * Every direct child key/id of one container — the set the accordion-level "Select All" button
 * (see selectAllChildren) selects or deselects. Scoped to the currently FILTERED tree (appState.
 * grouped), not the full unfiltered dataset — with no filters active the two are identical, but
 * with a filter on, only what's actually visible on screen gets selected.
 * @param {GroupLevel} parentLevel
 * @param {GroupScope} parentScope
 * @returns {{groupKeys: string[], questionIds: string[]}}
 */
function directChildren(parentLevel, parentScope) {
  if (parentLevel === "subject") {
    return { groupKeys: topicsUnder(parentScope.subject).map((topic) => groupKey("topic", { subject: parentScope.subject, topic })), questionIds: [] };
  }
  if (parentLevel === "topic") {
    const subTopics = subTopicsUnder(parentScope.subject, /** @type {string} */ (parentScope.topic));
    return { groupKeys: subTopics.map((subTopic) => groupKey("subTopic", { subject: parentScope.subject, topic: parentScope.topic, subTopic })), questionIds: [] };
  }
  const questionIds = questionIdsUnder(parentScope.subject, /** @type {string} */ (parentScope.topic), /** @type {string} */ (parentScope.subTopic));
  return { groupKeys: [], questionIds };
}

/**
 * Turns on ONE container's own child-select-mode (if not already on) and toggles every one of its
 * direct children's selection together — the accordion-level "Select All" button. A single click
 * selects everything under this container; if everything under it is already selected, the same
 * click clears just this container's children back out (mirrors the floating bar's
 * toggleSelectAllInActiveGroups, scoped to one container instead of every active group).
 * @param {GroupLevel} parentLevel
 * @param {GroupScope} parentScope
 */
export function selectAllChildren(parentLevel, parentScope) {
  appState.childSelectModeKeys.add(groupKey(parentLevel, parentScope));
  const { groupKeys, questionIds } = directChildren(parentLevel, parentScope);
  const hasChildren = groupKeys.length > 0 || questionIds.length > 0;
  const allSelected = hasChildren && groupKeys.every((k) => appState.selectedGroupKeys.has(k)) && questionIds.every((id) => appState.selectedQuestionIds.has(id));
  if (allSelected) {
    for (const k of groupKeys) appState.selectedGroupKeys.delete(k);
    for (const id of questionIds) appState.selectedQuestionIds.delete(id);
  } else {
    for (const k of groupKeys) appState.selectedGroupKeys.add(k);
    for (const id of questionIds) appState.selectedQuestionIds.add(id);
  }
  updateSelectionBar();
}

/**
 * @returns {{groupKeys: string[], questionIds: string[]}} Every key/id that "Select All" would
 * select — Subjects (if the global toggle is on) plus everything under every Subject/Topic/SubTopic
 * whose own child-select-mode is currently on. Scoped to whatever select mode the user has already
 * turned on, rather than blindly the entire tree.
 */
function activeGroupSelectionTargets() {
  const groupKeys = [];
  const questionIds = [];
  if (document.body.classList.contains("select-subject-on")) {
    for (const subject of subjectsInTree()) groupKeys.push(groupKey("subject", { subject }));
  }
  for (const key of appState.childSelectModeKeys) {
    const { level, scope } = parseGroupKey(key);
    if (level === "subject") {
      for (const topic of topicsUnder(scope.subject)) groupKeys.push(groupKey("topic", { subject: scope.subject, topic }));
    } else if (level === "topic") {
      for (const subTopic of subTopicsUnder(scope.subject, /** @type {string} */ (scope.topic))) {
        groupKeys.push(groupKey("subTopic", { subject: scope.subject, topic: scope.topic, subTopic }));
      }
    } else {
      questionIds.push(...questionIdsUnder(scope.subject, /** @type {string} */ (scope.topic), /** @type {string} */ (scope.subTopic)));
    }
  }
  return { groupKeys, questionIds };
}

/**
 * The floating bar's "Select All" button: one click selects everything within every currently-active
 * select-mode container; if that's already fully selected, the same click clears it back out instead
 * — a single toggle for both check-all and uncheck-all, rather than needing the separate Clear
 * button for the common "selected everything, now deselect everything" round trip.
 */
export function toggleSelectAllInActiveGroups() {
  const { groupKeys, questionIds } = activeGroupSelectionTargets();
  const hasTargets = groupKeys.length > 0 || questionIds.length > 0;
  const allSelected = hasTargets && groupKeys.every((k) => appState.selectedGroupKeys.has(k)) && questionIds.every((id) => appState.selectedQuestionIds.has(id));
  if (allSelected) {
    for (const k of groupKeys) appState.selectedGroupKeys.delete(k);
    for (const id of questionIds) appState.selectedQuestionIds.delete(id);
  } else {
    for (const k of groupKeys) appState.selectedGroupKeys.add(k);
    for (const id of questionIds) appState.selectedQuestionIds.add(id);
  }
  updateSelectionBar();
}

/**
 * Tree-wide shortcut: turns on EVERY existing container's own child-select-mode for one level at
 * once, instead of clicking each accordion's "Select mode" button individually — e.g.
 * enableSelectModeEverywhere("subTopic") reveals every Topic's SubTopic checkboxes, tree-wide.
 * @param {"topic"|"subTopic"|"question"} revealLevel Which checkboxes become visible.
 */
export function enableSelectModeEverywhere(revealLevel) {
  if (revealLevel === "topic") {
    for (const subject of subjectsInTree()) appState.childSelectModeKeys.add(groupKey("subject", { subject }));
  } else if (revealLevel === "subTopic") {
    for (const subject of subjectsInTree()) {
      for (const topic of topicsUnder(subject)) appState.childSelectModeKeys.add(groupKey("topic", { subject, topic }));
    }
  } else {
    for (const subject of subjectsInTree()) {
      for (const topic of topicsUnder(subject)) {
        for (const subTopic of subTopicsUnder(subject, topic)) {
          appState.childSelectModeKeys.add(groupKey("subTopic", { subject, topic, subTopic }));
        }
      }
    }
  }
  updateSelectionBar();
}

/**
 * @returns {string[]} Every distinct Subject in the currently FILTERED tree (appState.grouped),
 * including empty-group-only placeholders that survive the filter. Select All/Select-mode-everywhere
 * scope to this — not the full unfiltered rawData/emptyGroups — so with a filter active only what's
 * actually visible gets selected; with no filters active this is identical to the full tree.
 */
function subjectsInTree() {
  return appState.grouped.subjects.map((s) => s.subject);
}

/** @param {string} subject @returns {string[]} Every distinct Topic under this Subject in the filtered tree. */
function topicsUnder(subject) {
  const s = appState.grouped.subjects.find((s) => s.subject === subject);
  return s ? s.topics.map((t) => t.topic) : [];
}

/** @param {string} subject @param {string} topic @returns {string[]} Every distinct SubTopic under this Topic in the filtered tree. */
function subTopicsUnder(subject, topic) {
  const t = appState.grouped.subjects.find((s) => s.subject === subject)?.topics.find((t) => t.topic === topic);
  return t ? t.subTopics.map((st) => st.subTopic) : [];
}

/** @param {string} subject @param {string} topic @param {string} subTopic @returns {string[]} Every question id in this SubTopic in the filtered tree. */
function questionIdsUnder(subject, topic, subTopic) {
  const st = appState.grouped.subjects
    .find((s) => s.subject === subject)
    ?.topics.find((t) => t.topic === topic)
    ?.subTopics.find((st) => st.subTopic === subTopic);
  return st ? st.questions.map((q) => q.id) : [];
}

/** @param {GroupLevel} level @param {GroupScope} scope */
export function toggleGroupSelect(level, scope) {
  const key = groupKey(level, scope);
  if (appState.selectedGroupKeys.has(key)) appState.selectedGroupKeys.delete(key);
  else appState.selectedGroupKeys.add(key);
  updateSelectionBar();
}

/** @param {string} questionId */
export function toggleSelectQuestion(questionId) {
  if (appState.selectedQuestionIds.has(questionId)) appState.selectedQuestionIds.delete(questionId);
  else appState.selectedQuestionIds.add(questionId);
  updateSelectionBar();
}

export function clearAllSelections() {
  appState.selectedGroupKeys = new Set();
  appState.selectedQuestionIds = new Set();
  appState.childSelectModeKeys = new Set();
  document.body.classList.remove("select-subject-on");
  updateSelectionBar();
}

const LEVEL_LABELS = { subject: "Subject", topic: "Topic", subTopic: "SubTopic" };

/** @returns {{groups: {level: GroupLevel, scope: GroupScope}[], questionIds: string[]}} Everything currently selected, in the shape moveForm/bulk actions consume. */
export function getSelection() {
  return { groups: [...appState.selectedGroupKeys].map(parseGroupKey), questionIds: [...appState.selectedQuestionIds] };
}

/**
 * "2 Topics, 5 Questions" style summary — counts by level, only non-zero ones shown, in hierarchy order.
 * @param {{level: GroupLevel, scope: GroupScope}[]} groups
 * @param {string[]} questionIds
 * @returns {string}
 */
export function formatSelectionSummary(groups, questionIds) {
  const counts = { subject: 0, topic: 0, subTopic: 0 };
  for (const g of groups) counts[g.level] += 1;
  const parts = [];
  for (const level of /** @type {GroupLevel[]} */ (["subject", "topic", "subTopic"])) {
    if (counts[level] > 0) parts.push(`${counts[level]} ${LEVEL_LABELS[level]}${counts[level] !== 1 ? "s" : ""}`);
  }
  if (questionIds.length > 0) parts.push(`${questionIds.length} Question${questionIds.length !== 1 ? "s" : ""}`);
  return parts.join(", ");
}

/** @returns {boolean} Whether any select-mode checkbox is currently showing anywhere — Subjects globally, or a Topic/SubTopic/Question container's own scoped toggle. */
function isSelectModeActive() {
  return document.body.classList.contains("select-subject-on") || appState.childSelectModeKeys.size > 0;
}

/**
 * Keeps the floating bulkSelectionBar in sync. Shown not just once something is actually selected,
 * but as soon as select mode is turned on anywhere (Subjects globally, or any Topic/SubTopic/
 * Question container) — so the bar (and its "Select All") is available right away instead of only
 * appearing after the user has already hand-picked something.
 */
export function updateSelectionBar() {
  const bar = document.getElementById("bulkSelectionBar");
  const countEl = document.getElementById("bulkSelectionCount");
  if (!bar || !countEl) return;
  const { groups, questionIds } = getSelection();
  const hasSelection = groups.length > 0 || questionIds.length > 0;
  const selectModeActive = isSelectModeActive();
  bar.hidden = !hasSelection && !selectModeActive;
  countEl.textContent = hasSelection
    ? `${formatSelectionSummary(groups, questionIds)} Selected`
    : selectModeActive
      ? "Select mode on — nothing selected yet"
      : "";
  document.body.classList.toggle("bulk-bar-visible", !bar.hidden);
  const moveBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById("bulkMoveSelectedBtn"));
  const deleteBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById("bulkDeleteSelectedBtn"));
  if (moveBtn) moveBtn.disabled = !hasSelection;
  if (deleteBtn) deleteBtn.disabled = !hasSelection;
  repaint();
}

/** Delete every currently-selected Subject/Topic/SubTopic (cascading — see deleteGroupCascade) and every selected question, in one confirmed action. */
export function bulkDeleteSelected() {
  const { groups, questionIds } = getSelection();
  if (groups.length === 0 && questionIds.length === 0) return;

  const nestedQuestionTotal = groups.reduce((sum, g) => sum + countQuestionsIn(appState.rawData, g.level, g.scope), 0);
  const summary = formatSelectionSummary(groups, questionIds);
  const nestedNote = nestedQuestionTotal > 0 ? ` This includes ${nestedQuestionTotal} question${nestedQuestionTotal !== 1 ? "s" : ""} nested inside the selected group(s).` : "";
  if (!confirmAction(`Delete ${summary}?${nestedNote} This cannot be undone here, but Undo will still work.`)) return;

  let data = { rawData: appState.rawData, emptyGroups: appState.emptyGroups, tombstones: appState.tombstones };
  for (const g of groups) data = deleteGroupCascade(data, g.level, g.scope);
  if (questionIds.length > 0) data = deleteQuestions(data, questionIds);

  clearAllSelections();
  applyDataChange(data);
  showToast(`Deleted ${summary}.`, "success");
}

/**
 * Moves every currently-selected Subject/Topic/SubTopic/Question to one chosen destination — see
 * features/moveForm.js's 3-column picker, which calls this shape back on save.
 * @param {{groups: {level: GroupLevel, scope: GroupScope}[], questionIds: string[]}} selection
 * @param {{subject: string, topic?: string, subTopic?: string}} destination
 */
export function applySelectionMove(selection, destination) {
  let data = { rawData: appState.rawData, emptyGroups: appState.emptyGroups };
  for (const g of selection.groups) {
    const dest = g.level === "subTopic" ? { subject: destination.subject, topic: destination.topic } : { subject: destination.subject };
    data = moveGroup(data, g.level, g.scope, dest);
  }
  if (selection.questionIds.length > 0) {
    data = moveQuestions(data, selection.questionIds, /** @type {any} */ (destination));
  }
  clearAllSelections();
  applyDataChange(data);
}
