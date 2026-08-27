// @ts-check
/**
 * features/youtubeOEmbed.js — fetches a YouTube video's real title via the public, key-less oEmbed
 * endpoint (CORS-enabled, no API key/quota needed). Display polish only (features/youtubePlayer.js's
 * Group Playback playlist panel shows it alongside the link's own label) — never persisted, never
 * the source of truth for anything. Results are cached in-memory per fetch key for the life of the
 * tab, since the same video/link can reappear across playlist opens/re-renders.
 */

/** @type {Map<string, Promise<string|null>>} cache key ("v:<id>" or "u:<url>") -> in-flight/settled title fetch. */
const titleCache = new Map();

/**
 * @param {string} oembedTargetUrl the URL handed to YouTube's oEmbed endpoint
 * @param {string} cacheKey
 * @returns {Promise<string|null>}
 */
function fetchTitle(oembedTargetUrl, cacheKey) {
  const cached = titleCache.get(cacheKey);
  if (cached) return cached;
  const promise = fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(oembedTargetUrl)}&format=json`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => data?.title ?? null)
    .catch(() => null);
  titleCache.set(cacheKey, promise);
  return promise;
}

/**
 * @param {string} videoId
 * @returns {Promise<string|null>} the video's title, or null if the fetch fails/is blocked (offline,
 *   a deleted/private video, etc.) — callers fall back to the link's own label/question text.
 */
export function fetchYouTubeTitle(videoId) {
  return fetchTitle(`https://www.youtube.com/watch?v=${videoId}`, `v:${videoId}`);
}

/**
 * Same as fetchYouTubeTitle, for a YouTube URL with no recognizable video id (e.g. a bare
 * `/playlist?list=...` link, added as a non-embeddable Related Link — see data/linkIcons.js's
 * isYouTubeUrl and data/youtubeTime.js's extractYouTubeVideoId). YouTube's oEmbed endpoint doesn't
 * officially support every such URL shape, so this is best-effort: null on failure, same as above.
 * @param {string} url
 * @returns {Promise<string|null>}
 */
export function fetchYouTubeTitleForUrl(url) {
  return fetchTitle(url, `u:${url}`);
}
