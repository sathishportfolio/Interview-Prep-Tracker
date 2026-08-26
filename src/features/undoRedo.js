// @ts-check
/**
 * features/undoRedo.js — global, snapshot-based Undo/Redo covering every data-changing action,
 * up to 50 steps back, in-memory only (resets on reload). Implemented as a clean wrapper: it
 * registers ONE hook on features/refresh.js's applyDataChange (the single funnel every mutation
 * call site already goes through), rather than each mutator remembering to snapshot itself.
 */
import { appState } from "../state/appState.js";
import { applyDataChange, setBeforeChangeHook } from "./refresh.js";

const MAX_HISTORY = 50;

/** @type {Array<{rawData: any[], emptyGroups: any[], tombstones: any[], groupLinks: any[]}>} */
let undoStack = [];
/** @type {Array<{rawData: any[], emptyGroups: any[], tombstones: any[], groupLinks: any[]}>} */
let redoStack = [];

export function initUndoRedo() {
  setBeforeChangeHook((prevRawData, prevEmptyGroups, prevTombstones, prevGroupLinks) => {
    undoStack.push({ rawData: prevRawData, emptyGroups: prevEmptyGroups, tombstones: prevTombstones, groupLinks: prevGroupLinks });
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
  });
}

export function undo() {
  if (undoStack.length === 0) return;
  const prev = /** @type {{rawData: any[], emptyGroups: any[], tombstones: any[], groupLinks: any[]}} */ (undoStack.pop());
  redoStack.push({ rawData: appState.rawData, emptyGroups: appState.emptyGroups, tombstones: appState.tombstones, groupLinks: appState.groupLinks });
  applyDataChange(prev, { skipUndoSnapshot: true });
}

export function redo() {
  if (redoStack.length === 0) return;
  const next = /** @type {{rawData: any[], emptyGroups: any[], tombstones: any[], groupLinks: any[]}} */ (redoStack.pop());
  undoStack.push({ rawData: appState.rawData, emptyGroups: appState.emptyGroups, tombstones: appState.tombstones, groupLinks: appState.groupLinks });
  applyDataChange(next, { skipUndoSnapshot: true });
}

/** @returns {{canUndo: boolean, canRedo: boolean}} */
export function undoRedoState() {
  return { canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 };
}
