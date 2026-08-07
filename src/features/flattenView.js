// @ts-check
/**
 * features/flattenView.js — Flatten View toggle. Persisted globally. Defaults ON for first-time
 * mobile visitors (checked once at bootstrap in app.js via `isMobile()` here).
 */
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { repaint } from "./refresh.js";

export function toggleFlatten() {
  appState.toggles = { ...appState.toggles, flatGroupView: !appState.toggles.flatGroupView };
  store.writeGlobalToggles(appState.toggles);
  repaint();
}

/** @returns {boolean} */
export function isMobile() {
  return window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
}
