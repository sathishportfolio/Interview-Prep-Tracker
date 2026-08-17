// @ts-check
/**
 * features/editMode.js — Edit Mode floating toggle. Persisted globally (GlobalToggles.editModeOn).
 * Enforcement is pure CSS (body.edit-mode-off hides .edit-gated controls) — this module just
 * flips the toggle + persists + repaints (repaint() itself toggles the body class). Drag & Drop is
 * kept in lockstep with Edit Mode: dragging/reordering is itself an edit, so it shouldn't be
 * possible to be in Edit Mode with dragging off (or vice versa) and wonder why rows aren't/are
 * draggable. Auto Download is deliberately NOT tied to Edit Mode — it's a separate, manually-opted-
 * into recurring local backup (see features/autoDownload.js), off by default and left exactly as
 * the user set it regardless of Edit Mode flips.
 */
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { repaint } from "./refresh.js";

export function toggleEditMode() {
  const editModeOn = !appState.toggles.editModeOn;
  appState.toggles = { ...appState.toggles, editModeOn, dragDropOn: editModeOn };
  store.writeGlobalToggles(appState.toggles);
  repaint();
}
