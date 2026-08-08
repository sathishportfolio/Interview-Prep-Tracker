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
    const idsHere = new Set(
      appState.rawData
        .filter((q) => q.subject === parentScope.subject && q.topic === parentScope.topic && q.subTopic === parentScope.subTopic)
        .map((q) => q.id)
    );
    appState.selectedQuestionIds = new Set([...appState.selectedQuestionIds].filter((id) => !idsHere.has(id)));
  }
}

/**
 * Turns on ONE container's own child-select-mode (if not already on) AND selects every one of its
 * direct children in the same action — the accordion-level "Select All" button.
 * @param {GroupLevel} parentLevel
 * @param {GroupScope} parentScope
 */
export function selectAllChildren(parentLevel, parentScope) {
  appState.childSelectModeKeys.add(groupKey(parentLevel, parentScope));
  if (parentLevel === "subject") {
    for (const topic of topicsUnder(parentScope.subject)) {
      appState.selectedGroupKeys.add(groupKey("topic", { subject: parentScope.subject, topic }));
    }
  } else if (parentLevel === "topic") {
    for (const subTopic of subTopicsUnder(parentScope.subject, /** @type {string} */ (parentScope.topic))) {
      appState.selectedGroupKeys.add(groupKey("subTopic", { subject: parentScope.subject, topic: parentScope.topic, subTopic }));
    }
  } else {
    for (const q of appState.rawData) {
      if (q.subject === parentScope.subject && q.topic === parentScope.topic && q.subTopic === parentScope.subTopic) {
        appState.selectedQuestionIds.add(q.id);
      }
    }
  }
  updateSelectionBar();
}

/**
 * Selects everything within every currently-active select-mode container — Subjects (if the global
 * toggle is on) plus every Subject/Topic/SubTopic whose own child-select-mode is on. This is the
 * floating bar's "Select All" shortcut: scoped to whatever select mode the user has already turned
 * on, rather than blindly selecting the entire tree.
 */
export function selectAllInActiveGroups() {
  if (document.body.classList.contains("select-subject-on")) {
    for (const subject of subjectsInTree()) appState.selectedGroupKeys.add(groupKey("subject", { subject }));
  }
  for (const key of appState.childSelectModeKeys) {
    const { level, scope } = parseGroupKey(key);
    if (level === "subject") {
      for (const topic of topicsUnder(scope.subject)) appState.selectedGroupKeys.add(groupKey("topic", { subject: scope.subject, topic }));
    } else if (level === "topic") {
      for (const subTopic of subTopicsUnder(scope.subject, /** @type {string} */ (scope.topic))) {
        appState.selectedGroupKeys.add(groupKey("subTopic", { subject: scope.subject, topic: scope.topic, subTopic }));
      }
    } else {
      for (const q of appState.rawData) {
        if (q.subject === scope.subject && q.topic === scope.topic && q.subTopic === scope.subTopic) appState.selectedQuestionIds.add(q.id);
      }
    }
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

/** @returns {string[]} Every distinct Subject, including empty-group-only placeholders. */
function subjectsInTree() {
  return [...new Set([...appState.rawData.map((q) => q.subject), ...appState.emptyGroups.map((eg) => eg.subject)])];
}

/** @param {string} subject @returns {string[]} Every distinct Topic under this Subject, including empty-group-only placeholders. */
function topicsUnder(subject) {
  const fromRows = appState.rawData.filter((q) => q.subject === subject).map((q) => q.topic);
  const fromEmpty = appState.emptyGroups.filter((eg) => eg.subject === subject && eg.topic != null).map((eg) => /** @type {string} */ (eg.topic));
  return [...new Set([...fromRows, ...fromEmpty])];
}

/** @param {string} subject @param {string} topic @returns {string[]} Every distinct SubTopic under this Topic, including empty-group-only placeholders. */
function subTopicsUnder(subject, topic) {
  const fromRows = appState.rawData.filter((q) => q.subject === subject && q.topic === topic).map((q) => q.subTopic);
  const fromEmpty = appState.emptyGroups
    .filter((eg) => eg.subject === subject && eg.topic === topic && eg.subTopic != null)
    .map((eg) => /** @type {string} */ (eg.subTopic));
  return [...new Set([...fromRows, ...fromEmpty])];
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

export function updateSelectionBar() {
  const bar = document.getElementById("bulkSelectionBar");
  const countEl = document.getElementById("bulkSelectionCount");
  if (!bar || !countEl) return;
  const { groups, questionIds } = getSelection();
  bar.hidden = groups.length === 0 && questionIds.length === 0;
  countEl.textContent = bar.hidden ? "" : `${formatSelectionSummary(groups, questionIds)} Selected`;
  document.body.classList.toggle("bulk-bar-visible", !bar.hidden);
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

  let data = { rawData: appState.rawData, emptyGroups: appState.emptyGroups };
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
