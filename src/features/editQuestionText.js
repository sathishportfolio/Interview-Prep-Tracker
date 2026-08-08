// @ts-check
/**
 * features/editQuestionText.js — Edit Question Text via a prompt() dialog (same pattern as
 * features/rename.js), pre-filled with the current text. Edit-mode-gated (see render/nodeViews/
 * questionView.js's statusControls), and works identically in the nested tree and Flatten View
 * since both share the same question node view unchanged.
 */
import { updateQuestion } from "../data/mutations.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { promptAction, showToast } from "./toast.js";

/** @param {string} questionId */
export function editQuestionTextPrompt(questionId) {
  const q = appState.rawData.find((x) => x.id === questionId);
  if (!q) return;
  const newText = promptAction("Edit question text:", q.question);
  if (newText == null) return; // cancelled
  const trimmed = newText.trim();
  if (!trimmed || trimmed === q.question) return;
  const rawData = updateQuestion(appState.rawData, questionId, { question: trimmed });
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
  showToast("Question updated.", "success");
}
