// @ts-check
/**
 * render/highlight.js — shared full-header flash/highlight overlay, reused for jump-to-question,
 * relocate-flash (after a move/reorder), and drop-target indication during drag. Per README-AI
 * gotcha #8: the overlay must be a separate absolutely-positioned sibling <div>, not a class/border
 * on the header itself, since in-flow children paint over header-level box decorations.
 */

/**
 * Flashes a header element (yellow overlay fading over ~2s) — used for jump-to-question and
 * "this question just moved" feedback.
 * @param {HTMLElement} headerEl Must have position:relative (accordion/question headers do, via CSS).
 */
export function flashHighlight(headerEl) {
  const existing = headerEl.querySelector(":scope > .flash-overlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.className = "flash-overlay";
  headerEl.appendChild(overlay);
  overlay.addEventListener("animationend", () => overlay.remove());
  // Fallback removal in case animationend doesn't fire (e.g. element removed/re-rendered).
  setTimeout(() => overlay.remove(), 2500);
}

/**
 * Scrolls a header into view and flashes it.
 * @param {HTMLElement} headerEl
 */
export function scrollAndFlash(headerEl) {
  headerEl.scrollIntoView({ behavior: "smooth", block: "center" });
  flashHighlight(headerEl);
}

let currentDropTarget = null;

/**
 * Shows a drop-target indicator overlay on a header (used when dragging onto a collapsed
 * SubTopic's header).
 * @param {HTMLElement} headerEl
 */
export function showDropTargetHighlight(headerEl) {
  clearDropTargetHighlight();
  const overlay = document.createElement("div");
  overlay.className = "drop-target-highlight";
  headerEl.appendChild(overlay);
  currentDropTarget = overlay;
}

export function clearDropTargetHighlight() {
  if (currentDropTarget) {
    currentDropTarget.remove();
    currentDropTarget = null;
  }
}
