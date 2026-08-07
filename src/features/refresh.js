// @ts-check
/**
 * features/refresh.js — the shared "apply a data change and repaint" pipeline every feature module
 * funnels through, so no module hand-rolls its own "mutate + regroup + persist + render" sequence.
 * undoRedo.js wraps `applyDataChange` to capture snapshots; everything else just calls it.
 */
import { groupData } from "../data/group.js";
import { filterGroupedData, computeFilterOptions } from "../data/filter.js";
import { appState } from "../state/appState.js";
import { renderTree } from "../render/treeRenderer.js";
import { renderFlat } from "../render/flatRenderer.js";
import { renderStatsBadges, renderGlobalActions } from "../render/statsBadges.js";
import { renderBreadcrumb } from "../render/breadcrumb.js";
import * as fileManager from "./fileManager.js";

/** @type {Record<string, any>} set once by app.js after all handler objects exist */
let statsHandlers = {};
let actionsHandlers = {};
/** @type {() => {chainText: string|null, activeQuestionChainText: string|null, activeQuestionText: string|null}} */
let breadcrumbGetter = () => ({ chainText: null, activeQuestionChainText: null, activeQuestionText: null });
/** @type {(() => void)|null} */
let afterRepaintHook = null;

/** @param {() => void} fn Called at the end of every repaint() (e.g. dragDrop.refreshSortables). */
export function setAfterRepaintHook(fn) {
  afterRepaintHook = fn;
}

/**
 * @param {{stats: Record<string, any>, actions: Record<string, any>, breadcrumb: () => {chainText: string|null, activeQuestionChainText: string|null, activeQuestionText: string|null}}} config
 */
export function configureRefresh(config) {
  statsHandlers = config.stats;
  actionsHandlers = config.actions;
  breadcrumbGetter = config.breadcrumb;
}

/** Recomputes grouped/filtered trees from current appState.rawData/emptyGroups/filterState. */
export function recompute() {
  const grouped = groupData(appState.rawData, appState.emptyGroups);
  appState.groupedUnfiltered = grouped;
  appState.grouped = filterGroupedData(grouped, appState.filterState);
}

/** Repaints the tree/flat view + stats + breadcrumb from current appState (no data recompute). */
export function repaint() {
  const noData = appState.rawData.length === 0 && appState.emptyGroups.length === 0;
  const treeRoot = document.getElementById("treeRoot");
  const flatRoot = document.getElementById("flatRoot");
  const noDataMsg = document.getElementById("noDataMessage");
  if (noDataMsg) noDataMsg.hidden = !noData;
  if (treeRoot) treeRoot.hidden = noData || appState.toggles.flatGroupView;
  if (flatRoot) flatRoot.hidden = noData || !appState.toggles.flatGroupView;

  if (!noData) {
    if (appState.toggles.flatGroupView) {
      renderFlat(appState.grouped);
    } else {
      renderTree(appState.grouped);
    }
  }

  const filteredQuestions = flattenTreeQuestions(appState.grouped);
  renderStatsBadges(
    {
      total: appState.rawData.length,
      filtered: filteredQuestions.length,
      review: filteredQuestions.filter((q) => q.reviewLater).length,
      done: filteredQuestions.filter((q) => q.done).length,
      starred: filteredQuestions.filter((q) => q.starred).length,
    },
    statsHandlers
  );
  renderGlobalActions(appState.toggles, actionsHandlers);
  renderBreadcrumb(breadcrumbGetter());

  document.body.classList.toggle("edit-mode-off", !appState.toggles.editModeOn);
  document.body.classList.toggle("drag-drop-off", !appState.toggles.dragDropOn);
  document.getElementById("editModeToggleBtn")?.classList.toggle("edit-mode-active", appState.toggles.editModeOn);

  if (afterRepaintHook) afterRepaintHook();
}

/** @param {import('../types.js').GroupedTree} tree */
function flattenTreeQuestions(tree) {
  const out = [];
  for (const s of tree.subjects) for (const t of s.topics) for (const st of t.subTopics) out.push(...st.questions);
  return out;
}

/** @type {((prevRawData: any[], prevEmptyGroups: any[]) => void)|null} */
let beforeChangeHook = null;

/**
 * Registers a callback invoked with the PRE-mutation {rawData, emptyGroups} right before every
 * applyDataChange call — undoRedo.js's single hook point, so every mutation call site is covered
 * without each one remembering to push its own snapshot.
 * @param {(prevRawData: any[], prevEmptyGroups: any[]) => void} fn
 */
export function setBeforeChangeHook(fn) {
  beforeChangeHook = fn;
}

/**
 * Applies a new {rawData, emptyGroups} pair: updates appState, recomputes, persists (unless
 * tempMode — persistCurrentProgress itself no-ops appropriately via the store backend swap), and
 * repaints. This is the ONE place undoRedo.js needs to wrap to cover every mutation.
 * @param {{rawData: any[], emptyGroups: any[]}} pair
 * @param {{skipUndoSnapshot?: boolean}} [options] Internal: undoRedo.js itself uses this to apply
 *   a restored snapshot without recording ANOTHER undo step for the undo/redo action itself.
 */
export function applyDataChange(pair, options = {}) {
  if (!options.skipUndoSnapshot && beforeChangeHook) {
    beforeChangeHook(appState.rawData, appState.emptyGroups);
  }
  appState.rawData = pair.rawData;
  appState.emptyGroups = pair.emptyGroups;
  recompute();
  fileManager.persistCurrentProgress();
  repaint();
}

/** Recomputes + repaints without changing data (e.g. after a filter/toggle change). */
export function refreshView() {
  recompute();
  repaint();
}

/** @returns {{subjects: string[], topics: string[], subTopics: string[]}} */
export function getFilterOptions() {
  return computeFilterOptions(appState.groupedUnfiltered, appState.filterState);
}
