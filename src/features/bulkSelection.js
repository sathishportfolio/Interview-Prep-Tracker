// @ts-check
/**
 * features/bulkSelection.js — Bulk Selection & Bulk Delete: "Select" mode at Subject/Topic/
 * SubTopic levels (check multiple items, live count bar, delete all selected-and-empty in one
 * action, skip+report non-empty ones) and question-level selection (feeds Move Selected / bulk
 * drag-move, wired in moveForm.js/dragDrop.js).
 */
import { deleteGroup as deleteGroupMutation } from "../data/mutations.js";
import { applyDataChange, repaint } from "./refresh.js";
import { appState } from "../state/appState.js";
import { showToast } from "./toast.js";

/** @param {"subject"|"topic"|"subTopic"} level */
export function toggleGroupSelectMode(level) {
  const cls = `select-${level.toLowerCase()}-on`;
  document.body.classList.toggle(cls);
  if (!document.body.classList.contains(cls)) {
    appState.selectedGroupKeys = new Set([...appState.selectedGroupKeys].filter((k) => !k.startsWith(`${level}::`)));
  }
  updateSelectionBar();
}

/**
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 */
export function toggleGroupSelect(level, scope) {
  const key = `${level}::${scope.subject}::${scope.topic || ""}::${scope.subTopic || ""}`;
  if (appState.selectedGroupKeys.has(key)) appState.selectedGroupKeys.delete(key);
  else appState.selectedGroupKeys.add(key);
  updateSelectionBar();
}

export function bulkDeleteSelectedGroups() {
  let data = { rawData: appState.rawData, emptyGroups: appState.emptyGroups };
  let deleted = 0;
  let skipped = 0;
  for (const key of appState.selectedGroupKeys) {
    const [level, subject, topic, subTopic] = key.split("::");
    const scope = { subject, topic: topic || undefined, subTopic: subTopic || undefined };
    const result = deleteGroupMutation(data, /** @type {any} */ (level), scope);
    if (result.ok) {
      data = { rawData: result.rawData, emptyGroups: result.emptyGroups };
      deleted += 1;
    } else {
      skipped += 1;
    }
  }
  appState.selectedGroupKeys = new Set();
  applyDataChange(data);
  showToast(`Deleted ${deleted} group(s). Skipped ${skipped} (still had questions).`, skipped > 0 ? "info" : "success");
  updateSelectionBar();
}

/** Toggles question-select mode, scoped to a single SubTopic at a time (per feature.md). */
export function toggleQuestionSelectMode(subject, topic, subTopic) {
  document.body.classList.toggle("select-question-on");
  if (!document.body.classList.contains("select-question-on")) {
    appState.selectedQuestionIds = new Set();
  }
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
  document.body.classList.remove("select-subject-on", "select-topic-on", "select-subtopic-on", "select-question-on");
  updateSelectionBar();
}

export function updateSelectionBar() {
  const bar = document.getElementById("bulkSelectionBar");
  const countEl = document.getElementById("bulkSelectionCount");
  if (!bar || !countEl) return;
  const groupCount = appState.selectedGroupKeys.size;
  const qCount = appState.selectedQuestionIds.size;
  const total = groupCount + qCount;
  bar.hidden = total === 0;
  countEl.textContent =
    groupCount > 0 ? `${groupCount} group(s) selected` : qCount > 0 ? `${qCount} question(s) selected` : "";
  repaint();
}
