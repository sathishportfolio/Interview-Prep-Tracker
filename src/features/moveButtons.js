// @ts-check
/**
 * features/moveButtons.js — Move Up/Down/Top/Bottom per-question buttons. Thin wrapper over
 * data/order.js.moveQuestionOrder + the shared refresh pipeline.
 */
import { moveQuestionOrder } from "../data/order.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";

/**
 * @param {string} questionId
 * @param {"up"|"down"|"top"|"bottom"} direction
 */
export function moveQuestion(questionId, direction) {
  const rawData = moveQuestionOrder(appState.rawData, questionId, direction);
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
}
