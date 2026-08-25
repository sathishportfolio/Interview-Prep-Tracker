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
import { toggleStatusFlag, setTriStatusFlag, scheduleReview, markStatus, resetTriStateHistory, updateQuestion } from "../data/mutations.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { flashHighlight } from "../render/highlight.js";
import { findQuestionHeaderEl } from "../render/treeRenderer.js";
import { setActiveQuestionQuiet } from "./activeQuestion.js";

/**
 * The very first time a question is marked Done (never Done before, and never marked Done via the
 * "Mark Done" menu before either — see doneCount), it's also marked Visited and set as the Active
 * Question — a first "I know this" is exactly the kind of milestone worth flagging and remembering
 * where you left off, without requiring a second separate click for either. Uses setActiveQuestionQuiet
 * (no scroll/reveal) rather than setActiveQuestion, matching how Starred already treats this same
 * "don't yank the user's scroll position mid-review" concern.
 * @param {import('../types.js').Question} prev
 * @param {"done"|"failed"|"reviewLater"|null} flag
 * @param {string} questionId
 * @param {import('../types.js').Question[]} rawData
 * @returns {import('../types.js').Question[]}
 */
function applyFirstDoneMilestone(prev, flag, questionId, rawData) {
  if (flag !== "done" || prev.done || prev.doneCount) return rawData;
  setActiveQuestionQuiet(questionId);
  return updateQuestion(rawData, questionId, { visited: true });
}

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
  rawData = applyFirstDoneMilestone(prev, flag, questionId, rawData);
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
  if (flash) {
    const el = findQuestionHeaderEl(questionId);
    if (el) flashHighlight(el);
  }
}

/** @type {Record<"done"|"failed"|"reviewLater", string>} */
const TRI_STATE_LABELS = { done: "Done", failed: "Failed", reviewLater: "Review Later" };

/**
 * Any of the three status buttons' own menu: "Mark <Status>" (withNotes=false) or "Mark <Status>
 * with Notes" (withNotes=true, prompts for an optional note via window.prompt — cancelling aborts
 * entirely, no state change). Each call always records a fresh count/history entry for `status` (see
 * data/mutations.js markStatus), even if the question was already in that state, and advances/resets
 * the SRS schedule the same way the plain tri-state toggle does (Done advances it; Failed/Review
 * Later reset it back to "due soon").
 * @param {string} questionId
 * @param {"done"|"failed"|"reviewLater"} status
 * @param {boolean} withNotes
 */
export function markStatusWithMenu(questionId, status, withNotes) {
  let note;
  if (withNotes) {
    note = window.prompt(`Note for this ${TRI_STATE_LABELS[status]} entry (optional):`, "");
    if (note === null) return; // cancelled — abort, no state change
    note = note.trim() || undefined;
  }
  const prev = appState.rawData.find((x) => x.id === questionId);
  const rawData0 = markStatus(appState.rawData, questionId, status, note);
  let rawData = scheduleReview(rawData0, questionId, status === "done" ? "advance" : "reset");
  if (prev) rawData = applyFirstDoneMilestone(prev, status, questionId, rawData);
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
}

/**
 * Ctrl/Cmd+click or long-press on ANY of the Done/Failed/Review Later buttons: after a confirm()
 * warning, clears all three flags plus each of their counters/full history timelines for this
 * question (see data/mutations.js resetTriStateHistory — deliberately not scoped to just the button
 * clicked). Mirrors unmarking Done's SRS reset.
 * @param {string} questionId
 */
export function resetTriState(questionId) {
  const q = appState.rawData.find((x) => x.id === questionId);
  if (!q) return;
  const counts = [
    q.doneCount ? `Done: ${q.doneCount}` : null,
    q.failedCount ? `Failed: ${q.failedCount}` : null,
    q.reviewLaterCount ? `Review Later: ${q.reviewLaterCount}` : null,
  ].filter(Boolean);
  const countsLabel = counts.length > 0 ? ` (currently ${counts.join(", ")})` : "";
  if (!window.confirm(`Reset Done/Failed/Review Later history for this question${countsLabel}? This clears every counter and its full timeline. This cannot be undone.`)) return;
  const rawData0 = resetTriStateHistory(appState.rawData, questionId);
  const rawData = scheduleReview(rawData0, questionId, "reset");
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
}
