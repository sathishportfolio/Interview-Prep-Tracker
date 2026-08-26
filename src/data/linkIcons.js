// @ts-check
/**
 * data/linkIcons.js — pure helpers for a Related Link's URL: the hostname-derived default label
 * (features/questionLinks.js's/groupLinks.js's "+ Add link" no longer prompts for a label at all —
 * see addLinkPrompt/addGroupLinkPrompt), whether it's a YouTube link (render/nodeViews/questionView.js
 * and groupLinksPanel.js prefix those chips with the YouTube brand icon instead of a favicon), and the
 * favicon image URL for everything else. The favicon URL is deterministically derived from the link's
 * own hostname (a public favicon service, not a fetched-and-stored image) — every device computes the
 * exact same URL from the exact same synced `link.url`, so the icon "syncs across devices" for free,
 * with nothing new to persist or push/pull.
 */

/**
 * @param {string} url
 * @returns {string} Lowercase hostname with a leading "www." stripped, or "" if `url` isn't parseable
 *   even after assuming `https://` for a bare "example.com" (no scheme).
 */
export function extractHostname(url) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

/** @param {string} url @returns {boolean} */
export function isYouTubeUrl(url) {
  const host = extractHostname(url);
  return host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be" || host.endsWith(".youtu.be");
}

/**
 * Default label for a link added via "+ Add link" (URL-only — see addLinkPrompt/addGroupLinkPrompt):
 * the bare hostname, e.g. "developer.mozilla.org" — editable afterward via the pencil icon like any
 * other link. Falls back to the raw (trimmed) URL if it doesn't parse as one.
 * @param {string} url
 * @returns {string}
 */
export function domainLabelFromUrl(url) {
  return extractHostname(url) || url.trim();
}

/**
 * @param {string} url
 * @returns {string} A favicon image URL for `url`'s hostname (a public favicon service — nothing
 *   fetched/cached by this app itself), or "" if the hostname can't be determined.
 */
export function faviconUrlFor(url) {
  const host = extractHostname(url);
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32` : "";
}
