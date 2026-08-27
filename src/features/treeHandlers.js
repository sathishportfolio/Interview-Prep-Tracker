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
import * as difficulty from "./difficulty.js";
import * as notImportant from "./notImportant.js";
import * as groupLinks from "./groupLinks.js";
import * as reorderMode from "./reorderMode.js";
import * as tags from "./tags.js";
import * as questionLinks from "./questionLinks.js";
import * as youtubePlayer from "./youtubePlayer.js";
import * as filters from "./filters.js";
import { repaint } from "./refresh.js";
import { scrollNodeIntoView } from "../render/accordion.js";
import { appState, toggleNodeOpenExclusive } from "../state/appState.js";

export function buildTreeHandlers() {
  return {
    // flash: false — clicking a status-icon-row button is already its own visual feedback (the icon
    // itself lights up), so the extra flash-highlight is redundant here (unlike the 'r'/'s' keyboard
    // shortcuts in reviewShortcuts.js, which keep flashing since there's no click to see).
    onToggleStatus: (qid, flag) => statusFlags.toggleStatus(qid, flag, { flash: false }),
    onMarkStatus: (qid, status, withNotes) => statusFlags.markStatusWithMenu(qid, status, withNotes),
    onResetTriState: (qid) => statusFlags.resetTriState(qid),
    onToggleQuestionTag: (qid, tag) => tags.toggleTagOnQuestion(qid, tag),
    onCreateTag: (qid, tag) => tags.createAndAddTag(qid, tag),
    onFilterByTag: (tag) => filters.toggleTagFilter(tag),
    onFilterByGroup: (level, scope) => filters.filterByGroup(level, scope),
    onAddQuestionLink: (qid) => questionLinks.addLinkPrompt(qid),
    onEditQuestionLink: (qid, linkId, label, url) => questionLinks.editLinkPrompt(qid, linkId, label, url),
    onRemoveQuestionLink: (qid, linkId, label) => questionLinks.removeLinkWithConfirm(qid, linkId, label),
    onReorderQuestionLinks: (qid, orderedLinkIds) => questionLinks.reorderLinks(qid, orderedLinkIds),
    onOpenYouTubePlayer: (qid, link) => youtubePlayer.openYouTubePlayer(qid, link),
    onCycleDifficulty: (qid) => difficulty.cycleDifficulty(qid),
    onReorderSelect: (level, scope) => reorderMode.selectForReorder(level, scope),
    onToggleGroupNotImportant: (level, scope) => notImportant.toggleGroupNotImportant(level, scope),
    onAddGroupLink: (level, scope) => groupLinks.addGroupLinkPrompt(level, scope),
    onEditGroupLink: (level, scope, linkId, label, url) => groupLinks.editGroupLinkPrompt(level, scope, linkId, label, url),
    onRemoveGroupLink: (level, scope, linkId, label) => groupLinks.removeGroupLinkWithConfirm(level, scope, linkId, label),
    onEditAnswer: (qid) => answerEditor.openAnswerEditor(qid),
    onEditQuestionText: (qid) => editQuestionText.editQuestionTextPrompt(qid),
    onOpenMoveForm: (qid) => moveForm.openMoveForm(appState.selectedQuestionIds.has(qid) ? [...appState.selectedQuestionIds] : [qid]),
    onDeleteQuestion: (qid) => deleteGroupFeature.deleteQuestionWithConfirm(qid),
    onCopyQuestion: (qid) => copySingle.copyQuestionText(qid),
    onCopyAndSearch: (qid) => copySingle.copyAndSearch(qid),
    onGoogleSearch: (qid, mode) => copySingle.googleSearchQuestion(qid, mode),
    onMoveQuestionOrder: (qid, dir) => moveButtons.moveQuestion(qid, dir),
    onToggleActiveQuestion: (qid) => activeQuestion.toggleActiveQuestion(qid),
    // Single-open-accordion for question answer bodies, mirroring the Subject/Topic/SubTopic
    // exclusivity below but scoped globally (see appState.js's siblingOpenKeysAtSameLevel) since flat
    // view has no parent grouping to scope by. repaint() re-syncs whichever OTHER question row was
    // previously open — toggleNodeOpenExclusive only updated appState, not that row's own DOM.
    onToggleQuestionOpen: (qid) => {
      toggleNodeOpenExclusive(`Q::${qid}`);
      // Opening a question's answer body while Edit Mode is off is a review action — mark it the
      // Active Question so this is the resume point on next load. Edit Mode's own gated controls
      // (Edit Answer, etc.) already set it explicitly on save, so this only covers the plain-review
      // open/close click.
      if (appState.openNodeKeys.has(`Q::${qid}`) && !appState.toggles.editModeOn) {
        activeQuestion.setActiveQuestionQuiet(qid);
      }
      repaint();
    },
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
