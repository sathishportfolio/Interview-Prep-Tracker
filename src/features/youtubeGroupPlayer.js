// @ts-check
/**
 * features/youtubeGroupPlayer.js — Group Playback: the header action that gathers every YouTube
 * link across the currently filtered group (appState.grouped, same scope Copy Visible/Find
 * Duplicates use) — both a question's own Related Links AND Subject/Topic/SubTopic-level Related
 * Links (data/groupLinks.js) — and opens them as one playlist in features/youtubePlayer.js's
 * embedded player. That module owns all the actual playback/bookmark/playlist-panel/auto-advance
 * logic (see its `options.playlist` param); this module is just the "build the playlist from the
 * current filter, tagged with where each video is attached" entry point.
 *
 * Playlist order walks the tree top-down (Subject -> Topic -> SubTopic -> Question), and at each
 * level emits that level's OWN group links before descending — so a Subject-level video always
 * precedes its Topics' videos, which precede their SubTopics', which precede their Questions', for
 * every branch. Each entry's `level` and `breadcrumb` (see buildEntry) are what
 * features/youtubePlayer.js's playlist panel uses to visually tag/group entries so a Subject-level
 * video is never mistaken for a specific question's.
 */
import { appState } from "../state/appState.js";
import { getGroupLinks } from "../data/groupLinks.js";
import { isYouTubeUrl } from "../data/linkIcons.js";
import { extractYouTubeVideoId } from "../data/youtubeTime.js";
import { openYouTubePlayer } from "./youtubePlayer.js";
import { showToast } from "./toast.js";

/**
 * @typedef {Object} PlaylistEntry
 * @property {"subject"|"topic"|"subTopic"|"question"} level
 * @property {string} subject
 * @property {string|null} topic
 * @property {string|null} subTopic
 * @property {string|null} questionId Non-null only for level "question".
 * @property {string|null} question Question text, non-null only for level "question".
 * @property {string} breadcrumb Full "Subject ▸ Topic ▸ SubTopic[ ▸ Question]" chain for display.
 * @property {string} groupKey Groups entries that share the same level+scope (a question's OWN
 *   entries are grouped separately per question) — features/youtubePlayer.js's playlist panel draws
 *   a divider whenever this changes between consecutive entries.
 * @property {{id: string, url: string, label: string}} link
 */

const CHAIN_SEP = " ▸ "; // "▸"

/** @param {"subject"|"topic"|"subTopic"|"question"} level @param {string} subject @param {string|null} topic @param {string|null} subTopic @param {string|null} question @returns {string} */
function buildBreadcrumb(level, subject, topic, subTopic, question) {
  const parts = [subject];
  if (topic) parts.push(topic);
  if (subTopic) parts.push(subTopic);
  if (level === "question" && question) parts.push(question);
  return parts.join(CHAIN_SEP);
}

/**
 * @param {"subject"|"topic"|"subTopic"|"question"} level
 * @param {string} subject @param {string|null} topic @param {string|null} subTopic
 * @param {string|null} questionId
 * @param {{id: string, url: string, label: string}} link
 * @returns {PlaylistEntry}
 */
function buildEntry(level, subject, topic, subTopic, questionId, question, link) {
  return {
    level,
    subject,
    topic,
    subTopic,
    questionId,
    question,
    breadcrumb: buildBreadcrumb(level, subject, topic, subTopic, question),
    groupKey: level === "question" ? `question::${questionId}` : `${level}::${subject}::${topic ?? ""}::${subTopic ?? ""}`,
    link,
  };
}

/**
 * @returns {PlaylistEntry[]}
 */
function buildFilteredPlaylist() {
  /** @type {PlaylistEntry[]} */
  const playlist = [];
  for (const s of appState.grouped.subjects) {
    for (const link of getGroupLinks(appState.groupLinks, s.subject)) {
      if (isYouTubeUrl(link.url)) playlist.push(buildEntry("subject", s.subject, null, null, null, null, link));
    }
    for (const t of s.topics) {
      for (const link of getGroupLinks(appState.groupLinks, s.subject, t.topic)) {
        if (isYouTubeUrl(link.url)) playlist.push(buildEntry("topic", s.subject, t.topic, null, null, null, link));
      }
      for (const st of t.subTopics) {
        for (const link of getGroupLinks(appState.groupLinks, s.subject, t.topic, st.subTopic)) {
          if (isYouTubeUrl(link.url)) playlist.push(buildEntry("subTopic", s.subject, t.topic, st.subTopic, null, null, link));
        }
        for (const q of st.questions) {
          for (const link of q.links ?? []) {
            if (isYouTubeUrl(link.url)) playlist.push(buildEntry("question", s.subject, t.topic, st.subTopic, q.id, q.question, link));
          }
        }
      }
    }
  }
  return playlist;
}

/**
 * Opens Group Playback for the currently filtered view, starting at its first EMBEDDABLE video —
 * the list can also include YouTube links with no recognizable video id (e.g. a bare playlist URL,
 * added as a Related Link but not embeddable — see data/youtubeTime.js's extractYouTubeVideoId);
 * those still appear as their own playlist rows (features/youtubePlayer.js's renderPlaylistPanel
 * opens them in a new tab instead of playing), just never as the starting entry.
 */
export function openGroupPlayback() {
  const playlist = buildFilteredPlaylist();
  const startIndex = playlist.findIndex((entry) => extractYouTubeVideoId(entry.link.url));
  if (startIndex === -1) {
    showToast("No playable YouTube videos in the current filtered view.", "info");
    return;
  }
  const first = playlist[startIndex];
  openYouTubePlayer(first.questionId, first.link, { playlist, index: startIndex });
}
