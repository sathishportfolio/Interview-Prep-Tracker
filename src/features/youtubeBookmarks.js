// @ts-check
/**
 * features/youtubeBookmarks.js — CRUD for a YouTube link's timestamp bookmarks. Thin: calls
 * data/mutations.js's add/update/removeLinkBookmark, then the shared refresh pipeline — same
 * pattern as features/questionLinks.js. features/youtubePlayer.js (the embedded-player modal) is
 * the only caller.
 *
 * Duplicate starts are rejected, not merged/renamed — two bookmarks pointing at the exact same
 * moment in the video is never useful and just clutters the list/sequential-autoplay order (see
 * data/filter.js-style "reject, don't silently coerce" precedent elsewhere in this codebase). Every
 * write path that can introduce a `start` (add, edit, bulk paste) checks first and, on a collision,
 * shows a toast and leaves the existing data untouched — the caller's own re-render (features/
 * youtubePlayer.js's renderList) then reflects that nothing changed.
 */
import { addLinkBookmark, updateLinkBookmark, removeLinkBookmark, setLinkBookmarks } from "../data/mutations.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { formatTimestamp } from "../data/youtubeTime.js";
import { showToast } from "./toast.js";

/**
 * @param {string|null} questionId Null (Group Playback's Subject/Topic/SubTopic-level entries) never
 *   matches a question, so this always reads false — callers gate the bookmark UI off entirely in
 *   that case anyway (see features/youtubePlayer.js's bookmarksSupported).
 * @param {string} linkId
 * @param {number} start
 * @param {string} [excludeBookmarkId] skip this bookmark's own id when checking (for edits) —
 *   without it, editing a bookmark without changing its start would flag against itself.
 * @returns {boolean}
 */
function hasDuplicateStart(questionId, linkId, start, excludeBookmarkId) {
  return !!getLink(questionId, linkId)?.bookmarks?.some((b) => b.id !== excludeBookmarkId && b.start === start);
}

/**
 * @param {string|null} questionId See hasDuplicateStart's questionId doc — null is a harmless no-op.
 * @param {string} linkId
 * @param {{start: number, end?: number|null, label?: string}} input
 */
export function addBookmark(questionId, linkId, input) {
  if (hasDuplicateStart(questionId, linkId, input.start)) {
    showToast(`A bookmark already starts at ${formatTimestamp(input.start)} — ignored.`, "error");
    return;
  }
  const rawData = addLinkBookmark(appState.rawData, questionId, linkId, input);
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
}

/**
 * @param {string|null} questionId See hasDuplicateStart's questionId doc — null is a harmless no-op.
 * @param {string} linkId
 * @param {string} bookmarkId
 * @param {Partial<{start: number, end: number|null, label: string, starred: boolean}>} patch
 */
export function updateBookmark(questionId, linkId, bookmarkId, patch) {
  if (patch.start !== undefined && hasDuplicateStart(questionId, linkId, patch.start, bookmarkId)) {
    showToast(`A bookmark already starts at ${formatTimestamp(patch.start)} — ignored.`, "error");
    return;
  }
  const rawData = updateLinkBookmark(appState.rawData, questionId, linkId, bookmarkId, patch);
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
}

/**
 * @param {string|null} questionId See hasDuplicateStart's questionId doc — null is a harmless no-op.
 * @param {string} linkId
 * @param {string} bookmarkId
 */
export function removeBookmark(questionId, linkId, bookmarkId) {
  const rawData = removeLinkBookmark(appState.rawData, questionId, linkId, bookmarkId);
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
}

/**
 * Bulk-replaces a link's entire bookmarks list from the raw-text toggle's textarea — see
 * data/mutations.js's setLinkBookmarks for the id/starred/createdAt preservation rule. Duplicate
 * starts WITHIN the pasted text are dropped (first occurrence wins), same "ignore, don't silently
 * merge" rule as addBookmark/updateBookmark above.
 * @param {string|null} questionId See hasDuplicateStart's questionId doc — null is a harmless no-op.
 * @param {string} linkId
 * @param {{start: number, end: number|null, label: string}[]} parsedBookmarks
 */
export function setBookmarks(questionId, linkId, parsedBookmarks) {
  const seenStarts = new Set();
  const deduped = [];
  for (const b of parsedBookmarks) {
    if (seenStarts.has(b.start)) continue;
    seenStarts.add(b.start);
    deduped.push(b);
  }
  if (deduped.length < parsedBookmarks.length) {
    const droppedCount = parsedBookmarks.length - deduped.length;
    showToast(`Ignored ${droppedCount} bookmark${droppedCount === 1 ? "" : "s"} with a duplicate start time.`, "error");
  }
  const rawData = setLinkBookmarks(appState.rawData, questionId, linkId, deduped);
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
}

/**
 * Looks up a question's link fresh off appState.rawData (not a possibly-stale closure reference) —
 * features/youtubePlayer.js re-reads this after every bookmark mutation to redraw its list.
 * @param {string|null} questionId Null (Group Playback's Subject/Topic/SubTopic-level entries) never
 *   matches a question, so this always returns null.
 * @param {string} linkId
 * @returns {import('../types.js').QuestionLink|null}
 */
export function getLink(questionId, linkId) {
  const q = appState.rawData.find((qq) => qq.id === questionId);
  return q?.links?.find((l) => l.id === linkId) || null;
}
