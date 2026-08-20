// @ts-check
/**
 * features/difficulty.js — per-question Difficulty (easy/medium/hard). The accordion's dot control
 * cycles through the four states on click, same shape as statusFlags.js's cycleDoneFailedReview.
 */
import { updateQuestion, applyPatchToSelection } from "../data/mutations.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";

/** @type {Array<"easy"|"medium"|"hard"|null>} */
const CYCLE = [null, "easy", "medium", "hard"];

/** @param {string} questionId */
export function cycleDifficulty(questionId) {
  const q = appState.rawData.find((x) => x.id === questionId);
  if (!q) return;
  const idx = CYCLE.indexOf(q.difficulty ?? null);
  const next = CYCLE[(idx + 1) % CYCLE.length];
  const rawData = updateQuestion(appState.rawData, questionId, { difficulty: next });
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
}

/**
 * Bulk action: sets Difficulty across a whole selection — every question under any selected
 * Subject/Topic/SubTopic plus every explicitly-selected question id (see
 * features/bulkSelection.js's getSelection()).
 * @param {{groups: {level: "subject"|"topic"|"subTopic", scope: {subject: string, topic?: string, subTopic?: string}}[], questionIds: string[]}} selection
 * @param {"easy"|"medium"|"hard"|null} difficulty
 */
export function bulkSetDifficulty(selection, difficulty) {
  if (selection.groups.length === 0 && selection.questionIds.length === 0) return;
  const data = applyPatchToSelection(
    { rawData: appState.rawData, emptyGroups: appState.emptyGroups },
    selection.groups,
    selection.questionIds,
    { difficulty }
  );
  applyDataChange(data);
}
