// @ts-check
/**
 * features/statusFlags.js — Status Flags (Done/ReviewLater/Duplicate/LessImportant/Starred). Thin:
 * calls data/mutations.js.toggleStatusFlag then the shared refresh pipeline. Marking Done also
 * advances the question's spaced-repetition schedule (and unmarking it, or marking Review Later,
 * resets it back to "due soon") — see data/mutations.js scheduleReview.
 */
import { toggleStatusFlag, scheduleReview } from "../data/mutations.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { flashHighlight } from "../render/highlight.js";
import { findQuestionHeaderEl } from "../render/treeRenderer.js";

/**
 * @param {string} questionId
 * @param {"done"|"reviewLater"|"duplicate"|"lessImportant"|"starred"} flag
 */
export function toggleStatus(questionId, flag) {
  const prev = appState.rawData.find((q) => q.id === questionId);
  let rawData = toggleStatusFlag(appState.rawData, questionId, flag);
  if (prev && flag === "done") {
    rawData = scheduleReview(rawData, questionId, prev.done ? "reset" : "advance");
  } else if (prev && flag === "reviewLater" && !prev.reviewLater) {
    rawData = scheduleReview(rawData, questionId, "reset");
  }
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
  // Toggling starred/lessImportant can move the question within its tier — flash it so the user
  // can find where it landed after the (keyed, so cheap) re-render.
  const el = findQuestionHeaderEl(questionId);
  if (el) flashHighlight(el);
}
