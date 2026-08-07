// @ts-check
/**
 * features/toast.js — tiny shared toast/alert helper. Not really a "feature" of feature.md, just
 * cross-cutting UI plumbing (kept out of render/* since it's imperative one-off DOM, not part of
 * the tree's keyed reconciliation).
 */

/**
 * @param {string} message
 * @param {"info"|"success"|"error"} [level]
 */
export function showToast(message, level = "info") {
  const host = document.getElementById("toastHost");
  if (!host) {
    // Fallback for contexts without the toast host mounted yet.
    // eslint-disable-next-line no-console
    console.log(`[toast:${level}] ${message}`);
    return;
  }
  const el = document.createElement("div");
  el.className = `app-toast ${level}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/**
 * Simple confirm wrapper (kept as a named export so it can be swapped/mocked later if needed).
 * @param {string} message
 * @returns {boolean}
 */
export function confirmAction(message) {
  return window.confirm(message);
}

/**
 * @param {string} message
 * @param {string} [defaultValue]
 * @returns {string|null}
 */
export function promptAction(message, defaultValue = "") {
  return window.prompt(message, defaultValue);
}
