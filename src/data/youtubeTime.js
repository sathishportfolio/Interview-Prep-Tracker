// @ts-check
/**
 * data/youtubeTime.js — pure helpers for YouTube video ids and mm:ss/h:mm:ss timestamps, shared by
 * features/youtubePlayer.js (the embedded-player modal + bookmark capture) and
 * features/youtubeBookmarks.js (bookmark CRUD). No DOM, no appState.
 */

/**
 * @param {string} url
 * @returns {string|null} the YouTube video id, or null if `url` isn't a recognizable YouTube watch/
 *   share/embed/shorts link.
 */
export function extractYouTubeVideoId(url) {
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return id || null;
    }
    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      const embedMatch = parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/);
      if (embedMatch) return embedMatch[1];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * @param {string} videoId
 * @returns {string} YouTube's own static per-video thumbnail image URL (mqdefault size, 320x180) —
 *   deterministic from the id alone, same "derive an image URL from public data, no fetch/API key
 *   needed" pattern as data/linkIcons.js's faviconUrlFor. Used by features/youtubePlayer.js's Group
 *   Playback playlist panel.
 */
export function youtubeThumbnailUrl(videoId) {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

/**
 * Start-time hint from a YouTube URL's own `t`/`start` query param (e.g. "?t=90" or "?t=1m30s"), so
 * opening a link that already points at a moment in the video starts the embedded player there too.
 * @param {string} url
 * @returns {number} seconds, 0 if absent/unparseable.
 */
export function extractStartSeconds(url) {
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`);
    const raw = parsed.searchParams.get("t") || parsed.searchParams.get("start");
    if (!raw) return 0;
    if (/^\d+$/.test(raw)) return Number(raw);
    const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
    if (!match) return 0;
    const [, h, m, s] = match;
    return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
  } catch {
    return 0;
  }
}

/**
 * @param {number} totalSeconds
 * @returns {string} "mm:ss", or "h:mm:ss" once it reaches an hour.
 */
export function formatTimestamp(totalSeconds) {
  const total = Math.max(0, Math.round(totalSeconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Parses a single "mm:ss" / "h:mm:ss" / plain-seconds string, typed or pasted by hand.
 * @param {string} input
 * @returns {number|null} seconds, or null if unparseable.
 */
export function parseTimestamp(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(":").map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  let seconds = 0;
  for (const part of parts) seconds = seconds * 60 + Number(part);
  return seconds;
}

/**
 * Parses the editable "00:10" or "00:10 - 00:50" range text a bookmark row shows/accepts — the
 * "manually copy paste this timestamp" entry point.
 * @param {string} input
 * @returns {{start: number, end: number|null}|null} null if the start half doesn't parse.
 */
export function parseBookmarkRangeInput(input) {
  const [startRaw, endRaw] = (input || "").split("-");
  const start = parseTimestamp(startRaw);
  if (start === null) return null;
  const end = endRaw !== undefined ? parseTimestamp(endRaw) : null;
  return { start, end };
}

/**
 * @param {{start: number, end?: number|null}} bookmark
 * @returns {string} "00:10" or "00:10 - 00:50"
 */
export function formatBookmarkRange(bookmark) {
  const startText = formatTimestamp(bookmark.start);
  return bookmark.end != null ? `${startText} - ${formatTimestamp(bookmark.end)}` : startText;
}

/**
 * @param {{start: number}} bookmark
 * @returns {string} default label shown/saved when the user hasn't set a custom one.
 */
export function defaultBookmarkLabel(bookmark) {
  return `Bookmarked At ${formatTimestamp(bookmark.start)}`;
}

/**
 * Parses one line of the bulk text-area format: "MM:SS-MM:SS - Label" (range, note the tight dash
 * between start/end vs the spaced " - " before the label) or "MM:SS - Label" (single point). The
 * label half is optional — a bare "MM:SS" or "MM:SS-MM:SS" line is fine too.
 * @param {string} line
 * @returns {{start: number, end: number|null, label: string}|null} null if the line doesn't parse.
 */
export function parseBookmarkLine(line) {
  const trimmed = (line || "").trim();
  if (!trimmed) return null;
  const sepIdx = trimmed.indexOf(" - ");
  const timePart = sepIdx === -1 ? trimmed : trimmed.slice(0, sepIdx);
  const label = sepIdx === -1 ? "" : trimmed.slice(sepIdx + 3).trim();
  const rangeParts = timePart.split("-");
  if (rangeParts.length > 2) return null;
  const start = parseTimestamp(rangeParts[0]);
  if (start === null) return null;
  const end = rangeParts.length === 2 ? parseTimestamp(rangeParts[1]) : null;
  return { start, end, label };
}

/**
 * @param {string} text Multi-line bulk bookmark text (one bookmark per line — see parseBookmarkLine).
 * @returns {{start: number, end: number|null, label: string}[]} unparseable/blank lines are dropped.
 */
export function parseBookmarkLines(text) {
  return (text || "").split("\n").map(parseBookmarkLine).filter((b) => b !== null);
}

/**
 * @param {{start: number, end?: number|null, label?: string}} bookmark
 * @returns {string} "MM:SS-MM:SS - Label" or "MM:SS - Label"
 */
export function formatBookmarkLine(bookmark) {
  const time = bookmark.end != null ? `${formatTimestamp(bookmark.start)}-${formatTimestamp(bookmark.end)}` : formatTimestamp(bookmark.start);
  return `${time} - ${bookmark.label || defaultBookmarkLabel(bookmark)}`;
}

/**
 * @param {{start: number, end?: number|null, label?: string}[]} bookmarkList
 * @returns {string} the full bulk text-area contents, one formatBookmarkLine per line.
 */
export function formatBookmarkLines(bookmarkList) {
  return bookmarkList.map(formatBookmarkLine).join("\n");
}
