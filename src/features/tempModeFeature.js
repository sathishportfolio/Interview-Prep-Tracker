// @ts-check
/**
 * features/tempModeFeature.js — Temp/Test Mode toggle wiring (UI-facing; the actual storage
 * redirection lives in persistence/tempMode.js). Named tempModeFeature.js to avoid colliding with
 * persistence/tempMode.js on import lines that need both.
 */
import { setTempMode } from "../persistence/tempMode.js";
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";

/** @param {boolean} on */
export function setTempModeOn(on) {
  appState.toggles = { ...appState.toggles, tempMode: on };
  setTempMode(on);
  if (!on) {
    // Leaving temp mode: persist current toggles state for real (entering temp mode intentionally
    // does NOT write anything real, since store.js writes now redirect to memory).
    store.writeGlobalToggles(appState.toggles);
  }
}
