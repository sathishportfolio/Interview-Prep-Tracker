// @ts-check
/**
 * render/linkChipIcon.js — the leading icon on a read-only `.link-chip` (render/nodeViews/
 * questionView.js's per-question row, and groupLinksPanel.js's per-Subject/Topic/SubTopic row):
 * YouTube's brand icon for a YouTube link, otherwise the site's favicon (data/linkIcons.js's
 * faviconUrlFor — a public favicon service keyed by hostname, not anything fetched/cached by this
 * app, so it's identical on every device with nothing new to sync), falling back to the plain
 * external-link glyph if that favicon 404s/fails to load or the URL has no determinable hostname.
 */
import { isYouTubeUrl, faviconUrlFor } from "../data/linkIcons.js";

/** @returns {HTMLElement} the generic external-link glyph used as the icon-less fallback */
function buildFallbackIcon() {
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-arrow-up-right-from-square link-chip-icon";
  return icon;
}

/**
 * @param {string} url
 * @returns {HTMLElement}
 */
export function buildLinkChipIcon(url) {
  if (isYouTubeUrl(url)) {
    const icon = document.createElement("i");
    icon.className = "fa-brands fa-youtube link-chip-icon link-chip-icon-youtube";
    return icon;
  }
  const faviconUrl = faviconUrlFor(url);
  if (!faviconUrl) return buildFallbackIcon();
  const img = document.createElement("img");
  img.className = "link-chip-icon link-chip-favicon";
  img.src = faviconUrl;
  img.alt = "";
  img.width = 14;
  img.height = 14;
  img.loading = "lazy";
  img.addEventListener("error", () => img.replaceWith(buildFallbackIcon()), { once: true });
  return img;
}
