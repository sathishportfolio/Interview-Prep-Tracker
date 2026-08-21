// @ts-check
/**
 * render/panelCoordinator.js — enforces "only one popup panel open at a time" GLOBALLY across every
 * question row's Tags/Done/Failed/Review Later/History/Google Search/header-more-actions dropdowns
 * (render/nodeViews/*'s only shared always-imported utility besides accordion.js). Each panel already
 * owns its own open/close logic (hover-intent timers, click toggles, outside-click listeners) — this
 * module just tracks whichever ONE is currently open and closes it the instant a different one opens,
 * so a second panel never appears alongside a still-open first one. Stays inside render/*'s own
 * import boundary (no features/* import), consistent with render/* never importing features/*.
 */

/** @type {(() => void)|null} */
let currentCloseFn = null;

/**
 * Call when a panel is about to open: closes whatever panel was previously registered open (if it's
 * not this same one), then registers `closeFn` as the new "currently open" panel's own close
 * callback.
 * @param {() => void} closeFn Closes THIS panel — called by panelCoordinator itself when another
 *   panel opens, so it must be safe to call even if the panel is already closed/detached.
 */
export function openPanel(closeFn) {
  if (currentCloseFn && currentCloseFn !== closeFn) currentCloseFn();
  currentCloseFn = closeFn;
}

/** Call when a panel closes itself (for any reason) so panelCoordinator stops tracking it. */
export function panelClosed(closeFn) {
  if (currentCloseFn === closeFn) currentCloseFn = null;
}
