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
import * as editQuestionText from "./editQuestionText.js";
import * as moveButtons from "./moveButtons.js";
import * as deleteGroupFeature from "./deleteGroupFeature.js";
import * as copySingle from "./copySingle.js";
import * as copyMenus from "./copyMenus.js";
import * as rename from "./rename.js";
import * as quickAdd from "./quickAdd.js";
import * as bulkSelection from "./bulkSelection.js";
import * as moveForm from "./moveForm.js";
import * as groupPanels from "./groupPanels.js";
import * as autoExpand from "./autoExpand.js";
import { repaint } from "./refresh.js";
import { scrollNodeIntoView } from "../render/accordion.js";
import { appState } from "../state/appState.js";

export function buildTreeHandlers() {
  return {
    onToggleStatus: (qid, flag) => statusFlags.toggleStatus(qid, flag),
    onEditAnswer: (qid) => answerEditor.openAnswerEditor(qid),
    onEditQuestionText: (qid) => editQuestionText.editQuestionTextPrompt(qid),
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
    onToggleChildSelectMode: (parentLevel, parentScope) => bulkSelection.toggleChildSelectMode(parentLevel, parentScope),
    // Also the single-open-accordion resync point: opening a Subject/Topic/SubTopic closes its
    // siblings in appState (see accordion.js's toggleNodeOpenExclusive/openNodeExclusive) but only
    // this node's own DOM was patched directly — repaint() re-syncs every sibling's classes too.
    // Scrolling happens AFTER repaint(), not before: scrolling earlier targets stale pre-collapse
    // layout (the just-closed sibling's old height still counted), which then visibly jumps once
    // repaint() actually collapses it — this was the "lands in an unexpected spot" bug.
    onGroupAutoExpand: (level, scope) => {
      const clickedKey =
        level === "subject" ? `S::${scope.subject}` : level === "topic" ? `${scope.subject}::T::${scope.topic}` : `${scope.subject}::${scope.topic}::ST::${scope.subTopic}`;
      const deepestKey = level === "subject" || level === "topic" ? autoExpand.autoExpandFirstChild(level, scope) : null;
      repaint();
      if (appState.openNodeKeys.has(clickedKey)) scrollNodeIntoView(deepestKey || clickedKey);
    },
    onToggleGroupSelect: (level, scope) => bulkSelection.toggleGroupSelect(level, scope),
    onMountGroupPanels: (level, scope, mountEl) => groupPanels.mountGroupPanels(level, scope, mountEl),
  };
}
