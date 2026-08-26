// @ts-check
/**
 * features/deleteGroupFeature.js — Delete Subject/Topic/SubTopic/Question. Group deletes are
 * blocked (alert) while the group still contains questions; question deletes require confirm().
 * (Named deleteGroupFeature.js, not deleteGroup.js, only to avoid shadowing data/mutations.js's
 * deleteGroup export in call sites that import both — same module purpose the plan's file list
 * calls `deleteGroup.js`.)
 */
import { deleteGroup as deleteGroupMutation, deleteQuestion } from "../data/mutations.js";
import { removeGroupLinksForScope } from "../data/groupLinks.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { confirmAction, showToast } from "./toast.js";

/**
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 */
export function deleteGroupWithGuard(level, scope) {
  const name = level === "subject" ? scope.subject : level === "topic" ? scope.topic : scope.subTopic;
  const result = deleteGroupMutation({ rawData: appState.rawData, emptyGroups: appState.emptyGroups }, level, scope);
  if (!result.ok) {
    window.alert(result.error);
    return;
  }
  if (!confirmAction(`Delete ${level} "${name}"? This cannot be undone.`)) return;
  const groupLinks = removeGroupLinksForScope(appState.groupLinks, level, scope);
  applyDataChange({ rawData: result.rawData, emptyGroups: result.emptyGroups, groupLinks });
  showToast(`Deleted "${name}".`, "success");
}

/** @param {string} questionId */
export function deleteQuestionWithConfirm(questionId) {
  const q = appState.rawData.find((x) => x.id === questionId);
  if (!q) return;
  if (!confirmAction(`Delete this question?\n\n"${q.question}"`)) return;
  const result = deleteQuestion({ rawData: appState.rawData, emptyGroups: appState.emptyGroups, tombstones: appState.tombstones }, questionId);
  applyDataChange(result);
}
