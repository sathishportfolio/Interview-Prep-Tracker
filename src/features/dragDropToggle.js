// @ts-check
/**
 * features/dragDropToggle.js — Drag & Drop on/off toggle. Independent of Edit Mode, default ON.
 * Enforcement is pure CSS (body.drag-drop-off hides .drag-handle); repaint() applies the class.
 */
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { repaint } from "./refresh.js";

export function toggleDragDrop() {
  appState.toggles = { ...appState.toggles, dragDropOn: !appState.toggles.dragDropOn };
  store.writeGlobalToggles(appState.toggles);
  repaint();
}
