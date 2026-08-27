// @ts-check
/**
 * features/questionLinks.js — Related Articles/Links: each question can carry a user-ordered list
 * of {label, url} links, always opened in a new tab. Thin: calls data/mutations.js's
 * add/update/remove/reorderQuestionLink for the data side, then the shared refresh pipeline.
 */
import { addQuestionLink, updateQuestionLink, removeQuestionLink, reorderQuestionLinks } from "../data/mutations.js";
import { domainLabelFromUrl, isYouTubeUrl } from "../data/linkIcons.js";
import { normalizeYouTubeUrl, extractYouTubeVideoId } from "../data/youtubeTime.js";
import { fetchYouTubeTitle, fetchYouTubeTitleForUrl } from "./youtubeOEmbed.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { promptAction, confirmAction, showToast } from "./toast.js";

/**
 * Only the URL is asked for — the label defaults to its bare hostname (see domainLabelFromUrl),
 * editable afterward via the link's own pencil icon if the auto-derived label isn't descriptive
 * enough (e.g. "MDN: Closures" instead of "developer.mozilla.org"). A YouTube watch/share URL is
 * first canonicalized down to its bare `watch?v=<id>` form (data/youtubeTime.js's
 * normalizeYouTubeUrl) — dropping any trailing `&list=...&index=...` etc — and its real title is
 * fetched in the background (see youtubeOEmbed.js) and swapped in as the label once it resolves; a
 * YouTube URL with no video id (e.g. a bare playlist link) is kept as-is and still gets a
 * best-effort title fetch, just without the canonicalization (nothing to canonicalize to) or the
 * embedded-player support that requires a video id (see features/youtubePlayer.js).
 * A URL already present on this question's links is rejected with a toast instead of added again.
 * @param {string} questionId
 */
export function addLinkPrompt(questionId) {
  const url = promptAction("Link URL:");
  if (url === null || !url.trim()) return;
  const trimmedUrl = normalizeYouTubeUrl(url.trim());
  const question = appState.rawData.find((q) => q.id === questionId);
  if (question?.links?.some((l) => l.url === trimmedUrl)) {
    showToast("This link is already added.", "error");
    return;
  }
  const defaultLabel = domainLabelFromUrl(trimmedUrl);
  const rawData = addQuestionLink(appState.rawData, questionId, { label: defaultLabel, url: trimmedUrl });
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });

  const videoId = extractYouTubeVideoId(trimmedUrl);
  const titlePromise = videoId ? fetchYouTubeTitle(videoId) : isYouTubeUrl(trimmedUrl) ? fetchYouTubeTitleForUrl(trimmedUrl) : null;
  if (titlePromise) {
    titlePromise.then((title) => {
      if (!title) return;
      const question = appState.rawData.find((q) => q.id === questionId);
      const link = question?.links?.find((l) => l.url === trimmedUrl && l.label === defaultLabel);
      if (!link) return;
      const nextRawData = updateQuestionLink(appState.rawData, questionId, link.id, { label: title, url: trimmedUrl });
      applyDataChange({ rawData: nextRawData, emptyGroups: appState.emptyGroups });
    });
  }
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
  const rawData = updateQuestionLink(appState.rawData, questionId, linkId, { label: label.trim(), url: normalizeYouTubeUrl(url.trim()) });
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
}

/**
 * Label-only rename — prompts once (unlike editLinkPrompt's label-then-URL pair), for contexts where
 * re-typing the URL too would be an unnecessary extra step. Used by features/youtubePlayer.js's
 * Group Playback playlist panel to rename a video's display label mid-playback.
 * @param {string} questionId
 * @param {string} linkId
 * @param {string} currentLabel
 * @param {string} url unchanged — carried through as-is, since updateQuestionLink requires both fields.
 */
export function renameLinkPrompt(questionId, linkId, currentLabel, url) {
  const label = promptAction("Link label:", currentLabel);
  if (label === null || !label.trim()) return;
  const rawData = updateQuestionLink(appState.rawData, questionId, linkId, { label: label.trim(), url });
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
