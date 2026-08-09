// @ts-check
/**
 * features/tempModeFeature.js — Temp/Test Mode toggle wiring (UI-facing; the actual storage
 * redirection lives in persistence/tempMode.js). Named tempModeFeature.js to avoid colliding with
 * persistence/tempMode.js on import lines that need both.
 */
import { setTempMode } from "../persistence/tempMode.js";
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";

/**
 * @param {boolean} on
 */
export function setTempModeOn(on) {
  appState.toggles = { ...appState.toggles, tempMode: on };
  if (on) {
    // Persist the ON flag itself to REAL storage first, before redirecting writes to memory — so a
    // reload knows to re-enter Temp/Test Mode automatically (see initTempModeFromStorage) instead of
    // silently dropping back to real data with the checkbox unchecked. This is the only thing about
    // temp mode that's now persisted: the actual edits made while in temp mode still never reach
    // real storage (see persistence/tempMode.js) — everything else about the feature is unchanged.
    store.writeGlobalToggles(appState.toggles);
    setTempMode(true);
  } else {
    setTempMode(false);
    // Leaving temp mode: persist current toggles state for real (entering temp mode intentionally
    // does NOT write anything else real, since store.js writes were redirected to memory).
    store.writeGlobalToggles(appState.toggles);
  }
}

/**
 * Re-enters Temp/Test Mode on load if it was on when the page was last closed — call once right
 * after bootstrapFromStorage() so appState.toggles.tempMode already reflects the persisted flag.
 * Only redirects the storage backend; doesn't re-write globalToggles (already correct from bootstrap).
 */
export function initTempModeFromStorage() {
  if (appState.toggles.tempMode) setTempMode(true);
}
