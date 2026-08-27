// @ts-check
/**
 * features/groupLinks.js — Related Links at the Subject/Topic/SubTopic level. Thin: calls
 * data/groupLinks.js's add/update/remove/reorderGroupLink for the data side, then the shared refresh
 * pipeline. Mirrors features/questionLinks.js exactly, one level up (scoped by level+scope instead
 * of a question id).
 */
import { addGroupLink, updateGroupLink, removeGroupLink, reorderGroupLinks } from "../data/groupLinks.js";
import { domainLabelFromUrl } from "../data/linkIcons.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { promptAction, confirmAction } from "./toast.js";

/** @param {"subject"|"topic"|"subTopic"} level @param {{subject: string, topic?: string, subTopic?: string}} scope @returns {[string, string|null, string|null]} */
function scopeTriple(level, scope) {
  return [scope.subject, level === "subject" ? null : /** @type {string} */ (scope.topic), level === "subTopic" ? /** @type {string} */ (scope.subTopic) : null];
}

/**
 * Only the URL is asked for — the label defaults to its bare hostname (see domainLabelFromUrl),
 * editable afterward via the link's own pencil icon if the auto-derived label isn't descriptive
 * enough (e.g. "MDN: Closures" instead of "developer.mozilla.org").
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 */
export function addGroupLinkPrompt(level, scope) {
  const url = promptAction("Link URL:");
  if (url === null || !url.trim()) return;
  const trimmedUrl = url.trim();
  const [subject, topic, subTopic] = scopeTriple(level, scope);
  const groupLinks = addGroupLink(appState.groupLinks, subject, topic, subTopic, { label: domainLabelFromUrl(trimmedUrl), url: trimmedUrl });
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
 * Label-only rename — prompts once (unlike editGroupLinkPrompt's label-then-URL pair), for contexts
 * where re-typing the URL too would be an unnecessary extra step. Used by
 * features/youtubePlayer.js's Group Playback playlist panel to rename a video's display label
 * mid-playback.
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 * @param {string} linkId
 * @param {string} currentLabel
 * @param {string} url unchanged — carried through as-is, since updateGroupLink requires both fields.
 */
export function renameGroupLinkPrompt(level, scope, linkId, currentLabel, url) {
  const label = promptAction("Link label:", currentLabel);
  if (label === null || !label.trim()) return;
  const [subject, topic, subTopic] = scopeTriple(level, scope);
  const groupLinks = updateGroupLink(appState.groupLinks, subject, topic, subTopic, linkId, { label: label.trim(), url });
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
