// @ts-check
/**
 * features/statusFlags.js — Status Flags (Done/Failed/ReviewLater/Duplicate/LessImportant/Starred).
 * Thin: calls data/mutations.js then the shared refresh pipeline. Done, Failed, and Review Later
 * are mutually exclusive (a question can't be "I know this" and "I got this wrong" and "I need to
 * review this" at once) — setting any one of the three clears the other two, via
 * data/mutations.js's setTriStatusFlag. Marking Done also advances the question's
 * spaced-repetition schedule; marking Failed or Review Later (or unmarking Done back to nothing)
 * resets it back to "due soon" — see data/mutations.js scheduleReview.
 */
import { toggleStatusFlag, setTriStatusFlag, scheduleReview } from "../data/mutations.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { flashHighlight } from "../render/highlight.js";
import { findQuestionHeaderEl } from "../render/treeRenderer.js";
import { setActiveQuestionQuiet } from "./activeQuestion.js";

/** Done -> Failed -> Review Later -> (cleared), the order the 'd' keyboard shortcut cycles through. */
const TRI_STATE_ORDER = /** @type {const} */ (["done", "failed", "reviewLater"]);

/**
 * @param {string} questionId
 * @param {"done"|"reviewLater"|"duplicate"|"lessImportant"|"starred"|"failed"} flag
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

  const prev = appState.rawData.find((q) => q.id === questionId);
  const rawData = toggleStatusFlag(appState.rawData, questionId, flag);
  // Starring while an Active Question is already set moves the resume pointer to the question just
  // BEFORE this one in its SubTopic — see setActiveQuestionQuiet's doc comment: on reload this
  // scrolls back to right before the starred question, giving context leading into it rather than
  // landing on the (already-seen) starred question itself. Only when there IS a previous Active
  // Question, so starring never introduces one for users who don't use that feature at all.
  if (prev && !prev.starred && flag === "starred" && appState.activeQuestion) {
    const previousSibling = findPreviousSibling(appState.rawData, prev);
    if (previousSibling) setActiveQuestionQuiet(previousSibling.id);
  }
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
  // Toggling starred/lessImportant can move the question within its tier — flash it so the user
  // can find where it landed after the (keyed, so cheap) re-render.
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
 * The sibling immediately before `q` within its own SubTopic, by persisted order — null if `q` is
 * already first.
 * @param {import('../types.js').Question[]} rawData
 * @param {import('../types.js').Question} q
 * @returns {import('../types.js').Question|null}
 */
function findPreviousSibling(rawData, q) {
  const siblings = rawData
    .filter((x) => x.subject === q.subject && x.topic === q.topic && x.subTopic === q.subTopic)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const idx = siblings.findIndex((x) => x.id === q.id);
  return idx > 0 ? siblings[idx - 1] : null;
}
