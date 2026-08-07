// @ts-check
/**
 * features/editMode.js — Edit Mode floating toggle. Persisted globally (GlobalToggles.editModeOn).
 * Enforcement is pure CSS (body.edit-mode-off hides .edit-gated controls) — this module just
 * flips the toggle + persists + repaints (repaint() itself toggles the body class).
 */
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { repaint } from "./refresh.js";

export function toggleEditMode() {
  appState.toggles = { ...appState.toggles, editModeOn: !appState.toggles.editModeOn };
  store.writeGlobalToggles(appState.toggles);
  repaint();
}
