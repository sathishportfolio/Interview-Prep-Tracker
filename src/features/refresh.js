// @ts-check
/**
 * features/refresh.js — the shared "apply a data change and repaint" pipeline every feature module
 * funnels through, so no module hand-rolls its own "mutate + regroup + persist + render" sequence.
 * undoRedo.js wraps `applyDataChange` to capture snapshots; everything else just calls it.
 */
import { groupData } from "../data/group.js";
import { filterGroupedData, computeFilterOptions, computeOptionFractions, matchesSingleStatus, matchesStatus, matchesTags, flattenTreeQuestions, sortTagsByCount } from "../data/filter.js";
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
  autoOpenSingleFilteredGroup();
}

/**
 * Whenever the resulting filtered tree has exactly one Subject, keep it open — and if that Subject
 * also has exactly one Topic, keep that open too. Never cascades into SubTopic. Runs on every
 * recompute() (file load/switch, any data mutation via applyDataChange, every filter change), not
 * just in response to a filter click, so the single remaining group is always expanded on screen.
 */
function autoOpenSingleFilteredGroup() {
  const subjects = appState.grouped.subjects;
  if (subjects.length !== 1) return;
  const subject = subjects[0];
  appState.openNodeKeys.add(`S::${subject.subject}`);
  if (subject.topics.length === 1) {
    appState.openNodeKeys.add(`${subject.subject}::T::${subject.topics[0].topic}`);
  }
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
  // Not Important questions don't count toward the Done/Review/Failed progress bar at all — same
  // exclusion data/group.js applies to each accordion's own completePercent — so a scope's bar (and
  // its group-complete-pct counterparts) agree once nothing else differs between them.
  const importantHierarchyQuestions = hierarchyQuestions.filter((q) => !q.notImportant);
  const progressIgnoredCount = hierarchyQuestions.length - importantHierarchyQuestions.length;
  const { statuses, statusMode, tags } = appState.filterState;
  // Both Status and Tags narrow these fractions/the "Filtered" total together — clicking a Tags row
  // must move the Status rows' counts (and vice versa), not just its own, since both dimensions
  // combine into the same active filter (see data/filter.js's matchesStatus/matchesTags).
  const hasActiveStatusOrTagFilter = statuses.length > 0 || tags.length > 0;
  /** @param {import('../types.js').Question} q */
  const matchesFullActiveFilter = (q) => matchesStatus(q, statuses, statusMode) && matchesTags(q, tags);
  /**
   * @param {import('../types.js').StatusFilterKey} key
   * @returns {{count: number, total: number}}
   */
  const statusFraction = (key) => {
    const own = hierarchyQuestions.filter((q) => matchesSingleStatus(q, key));
    const total = own.length;
    const count = hasActiveStatusOrTagFilter ? own.filter(matchesFullActiveFilter).length : total;
    return { count, total };
  };
  /** @param {string} tag @returns {{count: number, total: number}} */
  const tagFraction = (tag) => {
    const own = hierarchyQuestions.filter((q) => q.tags?.includes(tag));
    const total = own.length;
    const count = hasActiveStatusOrTagFilter ? own.filter(matchesFullActiveFilter).length : total;
    return { count, total };
  };
  // Same shape as statusFraction, scoped to importantHierarchyQuestions instead — feeds only the
  // stats-progress bar (see render/statsBadges.js's renderStatsProgress), not the Stats dropdown rows
  // above (which intentionally still count Not Important questions, since "Not Important" is one of
  // those rows).
  /**
   * @param {import('../types.js').StatusFilterKey} key
   * @returns {{count: number, total: number}}
   */
  const progressStatusFraction = (key) => {
    const own = importantHierarchyQuestions.filter((q) => matchesSingleStatus(q, key));
    const total = own.length;
    const count = hasActiveStatusOrTagFilter ? own.filter(matchesFullActiveFilter).length : total;
    return { count, total };
  };
  const tagFractionsByTag = Object.fromEntries(appState.globalTags.map((t) => [t, tagFraction(t)]));
  renderStatsBadges(
    {
      total: hierarchyQuestions.length,
      filtered: hasActiveStatusOrTagFilter ? hierarchyQuestions.filter(matchesFullActiveFilter).length : hierarchyQuestions.length,
      activeStatuses: statuses,
      review: statusFraction("reviewLater"),
      done: statusFraction("done"),
      starred: statusFraction("starred"),
      visited: statusFraction("visited"),
      notImportant: statusFraction("notImportant"),
      difficultyEasy: statusFraction("difficultyEasy"),
      difficultyMedium: statusFraction("difficultyMedium"),
      difficultyHard: statusFraction("difficultyHard"),
      noDifficulty: statusFraction("noDifficulty"),
      notVisited: statusFraction("notVisited"),
      failed: statusFraction("failed"),
      withAnswer: statusFraction("hasAnswer"),
      withoutAnswer: statusFraction("noAnswer"),
      withTags: statusFraction("hasTags"),
      withLinks: statusFraction("hasLinks"),
      withYouTubeLink: statusFraction("hasYouTubeLink"),
      withoutYouTubeLink: statusFraction("noYouTubeLink"),
      unmarked: statusFraction("unmarked"),
      tags: sortTagsByCount(appState.globalTags, tagFractionsByTag),
      activeTags: appState.filterState.tags,
      tagFractions: tagFractionsByTag,
      // Not-Important-excluded counterparts for the stats-progress bar only — see progressStatusFraction.
      progressTotal: importantHierarchyQuestions.length,
      progressIgnoredCount,
      progressDone: progressStatusFraction("done"),
      progressReview: progressStatusFraction("reviewLater"),
      progressFailed: progressStatusFraction("failed"),
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
  const youtubeAutoplayToggleEl = /** @type {HTMLInputElement|null} */ (document.getElementById("youtubeAutoplayToggle"));
  if (youtubeAutoplayToggleEl) youtubeAutoplayToggleEl.checked = !!appState.toggles.youtubeAutoplayOn;

  if (afterRepaintHook) afterRepaintHook();
}

/** @type {((prevRawData: any[], prevEmptyGroups: any[], prevTombstones: any[], prevGroupLinks: any[]) => void)|null} */
let beforeChangeHook = null;

/**
 * Registers a callback invoked with the PRE-mutation {rawData, emptyGroups, tombstones, groupLinks}
 * right before every applyDataChange call — undoRedo.js's single hook point, so every mutation call
 * site is covered without each one remembering to push its own snapshot.
 * @param {(prevRawData: any[], prevEmptyGroups: any[], prevTombstones: any[], prevGroupLinks: any[]) => void} fn
 */
export function setBeforeChangeHook(fn) {
  beforeChangeHook = fn;
}

/**
 * Applies a new {rawData, emptyGroups, tombstones?, groupLinks?} pair: updates appState, recomputes,
 * persists (unless tempMode — persistCurrentProgress itself no-ops appropriately via the store
 * backend swap), and repaints. This is the ONE place undoRedo.js needs to wrap to cover every
 * mutation. `tombstones`/`groupLinks` are optional on the incoming pair — most mutations never touch
 * either, so the matching appState field is left as-is when absent (only the delete-family mutators
 * in data/mutations.js return tombstones; only Related Links / rename / delete / move group call
 * sites return groupLinks — see data/groupLinks.js).
 * @param {{rawData: any[], emptyGroups: any[], tombstones?: any[], groupLinks?: any[]}} pair
 * @param {{skipUndoSnapshot?: boolean}} [options] Internal: undoRedo.js itself uses this to apply
 *   a restored snapshot without recording ANOTHER undo step for the undo/redo action itself.
 */
export function applyDataChange(pair, options = {}) {
  if (!options.skipUndoSnapshot && beforeChangeHook) {
    beforeChangeHook(appState.rawData, appState.emptyGroups, appState.tombstones, appState.groupLinks);
  }
  appState.rawData = pair.rawData;
  appState.emptyGroups = pair.emptyGroups;
  if (pair.tombstones) appState.tombstones = pair.tombstones;
  if (pair.groupLinks) appState.groupLinks = pair.groupLinks;
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

/**
 * "count/total" fractions for every option in filterCardBody's five multiSelect filters (Subject/
 * Topic/SubTopic/Status/Tags) — same fraction shape and hierarchy-scoped-denominator convention as
 * the Stats dropdown's own rows (see `repaint()`'s statusFraction/tagFraction above), computed once
 * here so features/filters.js doesn't duplicate the logic. Subject/Topic/SubTopic use
 * data/filter.js's computeOptionFractions (denominator = that value's count across the whole file);
 * Status/Tags reuse the hierarchy-scoped denominator (that status/tag's count within the current
 * Subject/Topic/SubTopic selection, ignoring Status/Tags themselves) so their `total` matches what
 * the Stats dropdown already shows for the same row.
 * @param {readonly string[]} statusKeys STATUS_OPTIONS from features/filters.js.
 * @returns {{subjects: Record<string, {count: number, total: number}>, topics: Record<string, {count: number, total: number}>, subTopics: Record<string, {count: number, total: number}>, statuses: Record<string, {count: number, total: number}>, tags: Record<string, {count: number, total: number}>}}
 */
export function computeFilterPanelFractions(statusKeys) {
  const hierarchyOnlyTree = filterGroupedData(appState.groupedUnfiltered, { ...appState.filterState, statuses: [], tags: [] });
  const hierarchyQuestions = flattenTreeQuestions(hierarchyOnlyTree);
  const { statuses, statusMode, tags } = appState.filterState;
  const hasActiveStatusOrTagFilter = statuses.length > 0 || tags.length > 0;
  /** @param {import('../types.js').Question} q */
  const matchesFullActiveFilter = (q) => matchesStatus(q, statuses, statusMode) && matchesTags(q, tags);

  /** @param {import('../types.js').StatusFilterKey} key */
  const statusFraction = (key) => {
    const own = hierarchyQuestions.filter((q) => matchesSingleStatus(q, key));
    const total = own.length;
    const count = hasActiveStatusOrTagFilter ? own.filter(matchesFullActiveFilter).length : total;
    return { count, total };
  };
  /** @param {string} tag */
  const tagFraction = (tag) => {
    const own = hierarchyQuestions.filter((q) => q.tags?.includes(tag));
    const total = own.length;
    const count = hasActiveStatusOrTagFilter ? own.filter(matchesFullActiveFilter).length : total;
    return { count, total };
  };

  const hierarchyFractions = computeOptionFractions(appState.groupedUnfiltered, appState.filterState);

  return {
    ...hierarchyFractions,
    statuses: Object.fromEntries(statusKeys.map((k) => [k, statusFraction(/** @type {any} */ (k))])),
    tags: Object.fromEntries(appState.globalTags.map((t) => [t, tagFraction(t)])),
  };
}
