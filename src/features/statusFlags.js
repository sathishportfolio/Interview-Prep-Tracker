// @ts-check
/**
 * features/statusFlags.js — Status Flags (Done/ReviewLater/Duplicate/LessImportant/Starred). Thin:
 * calls data/mutations.js.toggleStatusFlag then the shared refresh pipeline.
 */
import { toggleStatusFlag } from "../data/mutations.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { flashHighlight } from "../render/highlight.js";
import { findQuestionHeaderEl } from "../render/treeRenderer.js";

/**
 * @param {string} questionId
 * @param {"done"|"reviewLater"|"duplicate"|"lessImportant"|"starred"} flag
 */
export function toggleStatus(questionId, flag) {
  const rawData = toggleStatusFlag(appState.rawData, questionId, flag);
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
  // Toggling starred/lessImportant can move the question within its tier — flash it so the user
  // can find where it landed after the (keyed, so cheap) re-render.
  const el = findQuestionHeaderEl(questionId);
  if (el) flashHighlight(el);
}
