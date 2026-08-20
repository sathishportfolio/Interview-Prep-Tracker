// @ts-check
/**
 * features/statusFlags.js — Status Flags (Done/Failed/ReviewLater/Duplicate/NotImportant/Starred).
 * Thin: calls data/mutations.js then the shared refresh pipeline. Done, Failed, and Review Later
 * are mutually exclusive (a question can't be "I know this" and "I got this wrong" and "I need to
 * review this" at once) — setting any one of the three clears the other two, via
 * data/mutations.js's setTriStatusFlag. Marking Done also advances the question's
 * spaced-repetition schedule; marking Failed or Review Later (or unmarking Done back to nothing)
 * resets it back to "due soon" — see data/mutations.js scheduleReview.
 */
import { toggleStatusFlag, setTriStatusFlag, scheduleReview, markDone, resetDoneHistory } from "../data/mutations.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { flashHighlight } from "../render/highlight.js";
import { findQuestionHeaderEl } from "../render/treeRenderer.js";

/** Done -> Failed -> Review Later -> (cleared), the order the 'd' keyboard shortcut cycles through. */
const TRI_STATE_ORDER = /** @type {const} */ (["done", "failed", "reviewLater"]);

/**
 * @param {string} questionId
 * @param {"done"|"reviewLater"|"duplicate"|"notImportant"|"starred"|"failed"|"visited"} flag
 * @param {{flash?: boolean}} [options] `flash` defaults true (the 'r'/'s' keyboard shortcuts in
 *   reviewShortcuts.js rely on it); the status-icon-row button click (treeHandlers.js's
 *   onToggleStatus) passes `flash: false` — clicking a status icon is already visual feedback in
 *   itself, so the extra flash-highlight is redundant there.
 */
export function toggleStatus(questionId, flag, options = {}) {
  const flash = options.flash ?? true;
  if (flag === "done" || flag === "failed" || flag === "reviewLater") {
    const prev = appState.rawData.find((q) => q.id === questionId);
    if (!prev) return;
    applyTriState(questionId, prev[flag] ? null : flag, { flash });
    return;
  }

  const rawData = toggleStatusFlag(appState.rawData, questionId, flag);
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
  if (flash) {
    const el = findQuestionHeaderEl(questionId);
    if (el) flashHighlight(el);
  }
}

/**
 * Cycles a question's Done/Failed/Review Later tri-state in fixed order — none -> Done -> Failed ->
 * Review Later -> none — for the 'd' keyboard shortcut. Never flashes: 'd' is meant for fast
 * repeated review-cycling, where a flash on every press would be more noise than signal.
 * @param {string} questionId
 */
export function cycleDoneFailedReview(questionId) {
  const prev = appState.rawData.find((q) => q.id === questionId);
  if (!prev) return;
  const idx = TRI_STATE_ORDER.findIndex((f) => prev[f]);
  const next = idx === -1 ? TRI_STATE_ORDER[0] : idx === TRI_STATE_ORDER.length - 1 ? null : TRI_STATE_ORDER[idx + 1];
  applyTriState(questionId, next, { flash: false });
}

/**
 * @param {string} questionId
 * @param {"done"|"failed"|"reviewLater"|null} flag
 * @param {{flash?: boolean}} [options]
 */
function applyTriState(questionId, flag, options = {}) {
  const flash = options.flash ?? true;
  const prev = appState.rawData.find((q) => q.id === questionId);
  if (!prev) return;
  let rawData = setTriStatusFlag(appState.rawData, questionId, flag);
  if (flag === "done") {
    rawData = scheduleReview(rawData, questionId, "advance");
  } else if (flag === "failed" || flag === "reviewLater" || (flag === null && prev.done)) {
    // Failed/Review Later need re-surfacing soon; leaving Done behind (including clearing to
    // nothing) resets the schedule the same way unmarking Done directly always has.
    rawData = scheduleReview(rawData, questionId, "reset");
  }
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
  if (flash) {
    const el = findQuestionHeaderEl(questionId);
    if (el) flashHighlight(el);
  }
}

/**
 * The status-icon-row Done button's menu: "Mark Done" (withNotes=false) or "Mark Done with Notes"
 * (withNotes=true, prompts for an optional note via window.prompt — cancelling aborts entirely, no
 * state change). Each call always records a fresh doneCount/doneHistory entry (see
 * data/mutations.js markDone), even if the question was already Done, and still advances the SRS
 * schedule exactly like the plain Done toggle does.
 * @param {string} questionId
 * @param {boolean} withNotes
 */
export function markDoneWithMenu(questionId, withNotes) {
  let note;
  if (withNotes) {
    note = window.prompt("Note for this Done entry (optional):", "");
    if (note === null) return; // cancelled — abort, no state change
    note = note.trim() || undefined;
  }
  const rawData0 = markDone(appState.rawData, questionId, note);
  const rawData = scheduleReview(rawData0, questionId, "advance");
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
}

/**
 * Ctrl/Cmd+click or long-press on the Done button: after a confirm() warning, clears the Done flag,
 * counter, and full history timeline for this question. Mirrors unmarking Done's SRS reset.
 * @param {string} questionId
 */
export function resetDone(questionId) {
  const q = appState.rawData.find((x) => x.id === questionId);
  if (!q) return;
  if (!window.confirm(`Reset Done history for this question? This clears the counter (currently ${q.doneCount ?? 0}) and its full timeline. This cannot be undone.`)) return;
  const rawData0 = resetDoneHistory(appState.rawData, questionId);
  const rawData = scheduleReview(rawData0, questionId, "reset");
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
}
