// @ts-check
/**
 * features/autoDownload.js — optional "Auto Download (1 min)" toggle shown next to Temp/Test Mode.
 * While on, silently re-triggers the same CSV download as the Export menu's "Download as CSV"
 * button (fileManager.downloadProgressCsv) once every minute, as a lightweight recurring local
 * backup. Deliberately NOT persisted (plain module-local timer, not appState.toggles) — leaving
 * repeated auto-downloads running silently across browser sessions the user forgot about would be
 * more surprising than useful, so it always starts OFF on reload.
 */
import { downloadProgressCsv } from "./fileManager.js";

const INTERVAL_MS = 60_000;
/** @type {number|null} */
let timerId = null;

/** @returns {boolean} */
export function isAutoDownloadOn() {
  return timerId !== null;
}

/** @param {boolean} on */
export function toggleAutoDownload(on) {
  if (on) {
    if (timerId !== null) return;
    timerId = window.setInterval(() => downloadProgressCsv(), INTERVAL_MS);
  } else {
    if (timerId !== null) window.clearInterval(timerId);
    timerId = null;
  }
}
