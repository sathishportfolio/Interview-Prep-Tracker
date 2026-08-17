// @ts-check
/**
 * features/autoDownload.js — "Auto Download (1 min)" toggle shown next to Temp/Test Mode. A
 * persisted global toggle like themeDark/dragDropOn (see appState.toggles), not module-local state,
 * so it survives reload AND round-trips through cloud sync the same way those do (sync/gists.js
 * pushes/pulls appState.toggles wholesale as part of the app-config gist manifest — see its
 * serializeManifestContent/pullAllFiles).
 * While on, silently re-triggers the same CSV download as the Export menu's "Download as CSV"
 * button (fileManager.downloadProgressCsv) once every minute, as a lightweight recurring local
 * backup.
 */
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { downloadProgressCsv } from "./fileManager.js";

const INTERVAL_MS = 60_000;
/** @type {number|null} */
let timerId = null;

function startTimer() {
  if (timerId !== null) return;
  timerId = window.setInterval(() => downloadProgressCsv(), INTERVAL_MS);
}

function stopTimer() {
  if (timerId !== null) window.clearInterval(timerId);
  timerId = null;
}

/**
 * Starts/stops the actual timer to match appState.toggles.autoDownloadOn without changing that
 * state itself — call once at boot (after bootstrapFromStorage) and again after anything that can
 * bring in a remote value for it (a sync pull; see app.js's refreshAfterExternalDataChange),
 * mirroring features/theme.js's applyTheme.
 */
export function applyAutoDownloadState() {
  if (appState.toggles.autoDownloadOn) startTimer();
  else stopTimer();
}

/** @param {boolean} on */
export function setAutoDownloadOn(on) {
  appState.toggles = { ...appState.toggles, autoDownloadOn: on };
  store.writeGlobalToggles(appState.toggles);
  applyAutoDownloadState();
}
