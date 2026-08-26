// @ts-check
/**
 * features/groupLinks.js — Related Links at the Subject/Topic/SubTopic level. Thin: calls
 * data/groupLinks.js's add/update/remove/reorderGroupLink for the data side, then the shared refresh
 * pipeline. Mirrors features/questionLinks.js exactly, one level up (scoped by level+scope instead
 * of a question id).
 */
import { addGroupLink, updateGroupLink, removeGroupLink, reorderGroupLinks } from "../data/groupLinks.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { promptAction, confirmAction } from "./toast.js";

/** @param {"subject"|"topic"|"subTopic"} level @param {{subject: string, topic?: string, subTopic?: string}} scope @returns {[string, string|null, string|null]} */
function scopeTriple(level, scope) {
  return [scope.subject, level === "subject" ? null : /** @type {string} */ (scope.topic), level === "subTopic" ? /** @type {string} */ (scope.subTopic) : null];
}

/**
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 */
export function addGroupLinkPrompt(level, scope) {
  const label = promptAction('Link label (e.g. "MDN: Closures"):');
  if (label === null || !label.trim()) return;
  const url = promptAction("Link URL:");
  if (url === null || !url.trim()) return;
  const [subject, topic, subTopic] = scopeTriple(level, scope);
  const groupLinks = addGroupLink(appState.groupLinks, subject, topic, subTopic, { label: label.trim(), url: url.trim() });
  applyDataChange({ rawData: appState.rawData, emptyGroups: appState.emptyGroups, groupLinks });
}

/**
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 * @param {string} linkId
 * @param {string} currentLabel
 * @param {string} currentUrl
 */
export function editGroupLinkPrompt(level, scope, linkId, currentLabel, currentUrl) {
  const label = promptAction("Link label:", currentLabel);
  if (label === null || !label.trim()) return;
  const url = promptAction("Link URL:", currentUrl);
  if (url === null || !url.trim()) return;
  const [subject, topic, subTopic] = scopeTriple(level, scope);
  const groupLinks = updateGroupLink(appState.groupLinks, subject, topic, subTopic, linkId, { label: label.trim(), url: url.trim() });
  applyDataChange({ rawData: appState.rawData, emptyGroups: appState.emptyGroups, groupLinks });
}

/**
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 * @param {string} linkId
 * @param {string} label
 */
export function removeGroupLinkWithConfirm(level, scope, linkId, label) {
  if (!confirmAction(`Remove link "${label}"?`)) return;
  const [subject, topic, subTopic] = scopeTriple(level, scope);
  const groupLinks = removeGroupLink(appState.groupLinks, subject, topic, subTopic, linkId);
  applyDataChange({ rawData: appState.rawData, emptyGroups: appState.emptyGroups, groupLinks });
}

/**
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 * @param {string[]} orderedLinkIds
 */
export function reorderGroupLinksFor(level, scope, orderedLinkIds) {
  const [subject, topic, subTopic] = scopeTriple(level, scope);
  const groupLinks = reorderGroupLinks(appState.groupLinks, subject, topic, subTopic, orderedLinkIds);
  applyDataChange({ rawData: appState.rawData, emptyGroups: appState.emptyGroups, groupLinks });
}
