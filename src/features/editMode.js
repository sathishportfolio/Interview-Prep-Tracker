// @ts-check
/**
 * features/editMode.js — Edit Mode floating toggle. Persisted globally (GlobalToggles.editModeOn).
 * Enforcement is pure CSS (body.edit-mode-off hides .edit-gated controls) — this module just
 * flips the toggle + persists + repaints (repaint() itself toggles the body class). Drag & Drop and
 * Auto Download are both kept in lockstep with Edit Mode: dragging/reordering is itself an edit, so
 * it shouldn't be possible to be in Edit Mode with dragging off (or vice versa) and wonder why rows
 * aren't/are draggable; Auto Download follows the same on/off switch as a simple "I'm actively
 * editing this file" signal for when a recurring local backup is worth running.
 */
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { repaint } from "./refresh.js";
import { applyAutoDownloadState } from "./autoDownload.js";

export function toggleEditMode() {
  const editModeOn = !appState.toggles.editModeOn;
  appState.toggles = { ...appState.toggles, editModeOn, dragDropOn: editModeOn, autoDownloadOn: editModeOn };
  store.writeGlobalToggles(appState.toggles);
  applyAutoDownloadState();
  repaint();
}
