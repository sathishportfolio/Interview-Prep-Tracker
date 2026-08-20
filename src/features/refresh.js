// @ts-check
/**
 * features/refresh.js — the shared "apply a data change and repaint" pipeline every feature module
 * funnels through, so no module hand-rolls its own "mutate + regroup + persist + render" sequence.
 * undoRedo.js wraps `applyDataChange` to capture snapshots; everything else just calls it.
 */
import { groupData } from "../data/group.js";
import { filterGroupedData, computeFilterOptions, matchesSingleStatus, matchesStatus } from "../data/filter.js";
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

  // Stats are computed against a HIERARCHY-only filtered set (Subject/Topic/SubTopic, ignoring
  // Status) — kept separate from appState.grouped (which the tree/flat view render from, and which
  // DOES apply the Status filter narrowing what's actually visible). `total` is that scope's size.
  // Each row's own BASE count (`total` of its fraction) is that row's status matched within this
  // hierarchy scope alone, ignoring whatever's currently active in the Status filter — a fixed
  // denominator that never changes no matter which OTHER row(s) get toggled on. Once 1+ statuses
  // are active (statusFilterMount / Stats-dropdown are multi-select/additive — see filters.js's
  // toggleStatusFilter — combined via appState.filterState.statusMode's AND/OR/NOT), each row's
  // numerator becomes "how many ALSO match the full active filter" (an intersection using the same
  // matchesStatus the tree itself filters by) — e.g. clicking "Starred" turns "Review: 12" into
  // "Review: 0/12" (0 of Review's own 12 are also Starred) and "Done: 39" into "Done: 2/39", while
  // Starred's own row becomes "2/2".
  const hierarchyOnlyTree = filterGroupedData(appState.groupedUnfiltered, { ...appState.filterState, statuses: [], tags: [] });
  const hierarchyQuestions = flattenTreeQuestions(hierarchyOnlyTree);
  const { statuses, statusMode } = appState.filterState;
  /**
   * @param {import('../types.js').StatusFilterKey} key
   * @returns {{count: number, total: number}}
   */
  const statusFraction = (key) => {
    const own = hierarchyQuestions.filter((q) => matchesSingleStatus(q, key));
    const total = own.length;
    const count = statuses.length > 0 ? own.filter((q) => matchesStatus(q, statuses, statusMode)).length : total;
    return { count, total };
  };
  /** @param {string} tag @returns {{count: number, total: number}} */
  const tagFraction = (tag) => {
    const own = hierarchyQuestions.filter((q) => q.tags?.includes(tag));
    const total = own.length;
    const count = statuses.length > 0 ? own.filter((q) => matchesStatus(q, statuses, statusMode)).length : total;
    return { count, total };
  };
  renderStatsBadges(
    {
      total: hierarchyQuestions.length,
      filtered: statuses.length > 0 ? hierarchyQuestions.filter((q) => matchesStatus(q, statuses, statusMode)).length : hierarchyQuestions.length,
      activeStatuses: statuses,
      review: statusFraction("reviewLater"),
      done: statusFraction("done"),
      starred: statusFraction("starred"),
      visited: statusFraction("visited"),
      notImportant: statusFraction("notImportant"),
      difficultyEasy: statusFraction("difficultyEasy"),
      difficultyMedium: statusFraction("difficultyMedium"),
      difficultyHard: statusFraction("difficultyHard"),
      due: statusFraction("dueForReview"),
      failed: statusFraction("failed"),
      withAnswer: statusFraction("hasAnswer"),
      withoutAnswer: statusFraction("noAnswer"),
      unmarked: statusFraction("unmarked"),
      tags: appState.globalTags,
      activeTags: appState.filterState.tags,
      tagFractions: Object.fromEntries(appState.globalTags.map((t) => [t, tagFraction(t)])),
    },
    statsHandlers
  );
  renderGlobalActions(appState.toggles, actionsHandlers);
  renderBreadcrumb(breadcrumbGetter());

  document.body.classList.toggle("edit-mode-off", !appState.toggles.editModeOn);
  document.body.classList.toggle("drag-drop-off", !appState.toggles.dragDropOn);
  document.getElementById("editModeToggleBtn")?.classList.toggle("edit-mode-active", appState.toggles.editModeOn);
  // Static checkbox (not part of the render engine) — kept in sync here so it reflects toggles
  // changed from elsewhere too (Edit Mode's own lockstep, a cross-device sync pull), not just its
  // own change handler.
  const autoDownloadToggleEl = /** @type {HTMLInputElement|null} */ (document.getElementById("autoDownloadToggle"));
  if (autoDownloadToggleEl) autoDownloadToggleEl.checked = !!appState.toggles.autoDownloadOn;

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
