// @ts-check
/**
 * features/questionLinks.js — Related Articles/Links: each question can carry a user-ordered list
 * of {label, url} links, always opened in a new tab. Thin: calls data/mutations.js's
 * add/update/remove/reorderQuestionLink for the data side, then the shared refresh pipeline.
 */
import { addQuestionLink, updateQuestionLink, removeQuestionLink, reorderQuestionLinks } from "../data/mutations.js";
import { domainLabelFromUrl } from "../data/linkIcons.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { promptAction, confirmAction } from "./toast.js";

/**
 * Only the URL is asked for — the label defaults to its bare hostname (see domainLabelFromUrl),
 * editable afterward via the link's own pencil icon if the auto-derived label isn't descriptive
 * enough (e.g. "MDN: Closures" instead of "developer.mozilla.org").
 * @param {string} questionId
 */
export function addLinkPrompt(questionId) {
  const url = promptAction("Link URL:");
  if (url === null || !url.trim()) return;
  const trimmedUrl = url.trim();
  const rawData = addQuestionLink(appState.rawData, questionId, { label: domainLabelFromUrl(trimmedUrl), url: trimmedUrl });
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
}

/**
 * @param {string} questionId
 * @param {string} linkId
 * @param {string} currentLabel
 * @param {string} currentUrl
 */
export function editLinkPrompt(questionId, linkId, currentLabel, currentUrl) {
  const label = promptAction("Link label:", currentLabel);
  if (label === null || !label.trim()) return;
  const url = promptAction("Link URL:", currentUrl);
  if (url === null || !url.trim()) return;
  const rawData = updateQuestionLink(appState.rawData, questionId, linkId, { label: label.trim(), url: url.trim() });
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
}

/**
 * @param {string} questionId
 * @param {string} linkId
 * @param {string} label
 */
export function removeLinkWithConfirm(questionId, linkId, label) {
  if (!confirmAction(`Remove link "${label}"?`)) return;
  const rawData = removeQuestionLink(appState.rawData, questionId, linkId);
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
}

/**
 * @param {string} questionId
 * @param {string[]} orderedLinkIds
 */
export function reorderLinks(questionId, orderedLinkIds) {
  const rawData = reorderQuestionLinks(appState.rawData, questionId, orderedLinkIds);
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
}
