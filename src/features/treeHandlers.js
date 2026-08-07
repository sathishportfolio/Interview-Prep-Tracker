// @ts-check
/**
 * features/treeHandlers.js — composes the single `handlers` object passed into render/treeRenderer
 * (and render/flatRenderer). This is the glue layer: render/* never imports features/* directly,
 * so app.js builds this object from the individual feature modules and hands it to
 * initTreeRenderer/initFlatRenderer. Every entry here is a thin call into one feature module.
 */
import * as statusFlags from "./statusFlags.js";
import * as activeQuestion from "./activeQuestion.js";
import * as answerEditor from "./answerEditor.js";
import * as moveButtons from "./moveButtons.js";
import * as deleteGroupFeature from "./deleteGroupFeature.js";
import * as copySingle from "./copySingle.js";
import * as copyMenus from "./copyMenus.js";
import * as rename from "./rename.js";
import * as quickAdd from "./quickAdd.js";
import * as bulkSelection from "./bulkSelection.js";
import * as moveForm from "./moveForm.js";
import * as groupPanels from "./groupPanels.js";
import { appState } from "../state/appState.js";

export function buildTreeHandlers() {
  return {
    onToggleStatus: (qid, flag) => statusFlags.toggleStatus(qid, flag),
    onEditAnswer: (qid) => answerEditor.openAnswerEditor(qid),
    onOpenMoveForm: (qid) => moveForm.openMoveForm(appState.selectedQuestionIds.has(qid) ? [...appState.selectedQuestionIds] : [qid]),
    onDeleteQuestion: (qid) => deleteGroupFeature.deleteQuestionWithConfirm(qid),
    onCopyQuestion: (qid) => copySingle.copyQuestionText(qid),
    onCopyAndSearch: (qid) => copySingle.copyAndSearch(qid),
    onGoogleSearch: (qid) => copySingle.googleSearchQuestion(qid),
    onMoveQuestionOrder: (qid, dir) => moveButtons.moveQuestion(qid, dir),
    onToggleActiveQuestion: (qid) => activeQuestion.toggleActiveQuestion(qid),
    onToggleSelectQuestion: (qid) => bulkSelection.toggleSelectQuestion(qid),
    onOpenCopyMenu: (level, scope, anchorEl) => copyMenus.openCopyMenu(level, scope, anchorEl),
    onRenameGroup: (level, scope) => rename.renameGroupPrompt(level, scope),
    onDeleteGroup: (level, scope) => deleteGroupFeature.deleteGroupWithGuard(level, scope),
    onQuickAddTopic: (subject) => quickAdd.quickAddTopic(subject),
    onQuickAddSubTopic: (subject, topic) => quickAdd.quickAddSubTopic(subject, topic),
    onToggleQuestionSelectMode: (subject, topic, subTopic) => bulkSelection.toggleQuestionSelectMode(subject, topic, subTopic),
    onToggleTopicSelectMode: () => bulkSelection.toggleGroupSelectMode("topic"),
    onToggleSubjectSelectMode: () => bulkSelection.toggleGroupSelectMode("subject"),
    onToggleGroupSelect: (level, scope) => bulkSelection.toggleGroupSelect(level, scope),
    onMountGroupPanels: (level, scope, mountEl) => groupPanels.mountGroupPanels(level, scope, mountEl),
    onMountMoveSelectedButton: (mountEl) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-sm btn-outline-primary move-selected-btn edit-gated";
      btn.textContent = "Move Selected";
      btn.addEventListener("click", () => {
        if (appState.selectedQuestionIds.size === 0) return;
        moveForm.openMoveForm([...appState.selectedQuestionIds]);
      });
      mountEl.appendChild(btn);
    },
  };
}
