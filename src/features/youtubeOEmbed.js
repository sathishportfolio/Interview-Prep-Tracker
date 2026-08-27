// @ts-check
/**
 * features/youtubeOEmbed.js — fetches a YouTube video's real title via the public, key-less oEmbed
 * endpoint (CORS-enabled, no API key/quota needed). Display polish only (features/youtubePlayer.js's
 * Group Playback playlist panel shows it alongside the link's own label) — never persisted, never
 * the source of truth for anything. Results are cached in-memory per video id for the life of the
 * tab, since the same video can reappear across playlist opens/re-renders.
 */

/** @type {Map<string, Promise<string|null>>} videoId -> in-flight/settled title fetch. */
const titleCache = new Map();

/**
 * @param {string} videoId
 * @returns {Promise<string|null>} the video's title, or null if the fetch fails/is blocked (offline,
 *   a deleted/private video, etc.) — callers fall back to the link's own label/question text.
 */
export function fetchYouTubeTitle(videoId) {
  const cached = titleCache.get(videoId);
  if (cached) return cached;
  const promise = fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => data?.title ?? null)
    .catch(() => null);
  titleCache.set(videoId, promise);
  return promise;
}
