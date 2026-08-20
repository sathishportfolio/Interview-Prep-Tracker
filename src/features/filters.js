// @ts-check
/**
 * features/filters.js — Filters (Subject/Topic/SubTopic/Status) card. Wires four multiSelect
 * instances to appState.filterState, using data/filter.js's interdependent option computation.
 * Filter selections are remembered per file (persisted as part of the active FileRecord).
 */
import { appState } from "../state/appState.js";
import { emptyFilterState } from "../data/filter.js";
import { createMultiSelect } from "../multiselect/multiSelect.js";
import { getFilterOptions, refreshView } from "./refresh.js";
import * as fileManager from "./fileManager.js";

// Order matches the Stats dropdown's own row order (see render/statsBadges.js), plus duplicate
// appended at the end (not shown in the Stats dropdown, so no ordering there to match against).
const STATUS_OPTIONS = /** @type {const} */ ([
  "unmarked", "done", "failed", "reviewLater", "starred", "visited", "notImportant", "difficultyEasy", "difficultyMedium", "difficultyHard",
  "hasAnswer", "noAnswer", "dueForReview", "duplicate",
]);
/** @type {Record<string, string>} */
const STATUS_LABELS = {
  done: "Done", reviewLater: "Review Later", dueForReview: "Due for Review", duplicate: "Duplicate", notImportant: "Not Important", starred: "Starred", failed: "Failed", visited: "Visited",
  hasAnswer: "With Answer", noAnswer: "Without Answer", unmarked: "Unmarked",
  difficultyEasy: "Difficulty: Easy", difficultyMedium: "Difficulty: Medium", difficultyHard: "Difficulty: Hard",
};
/** @type {Record<string, string>} */
const LABEL_TO_STATUS = Object.fromEntries(Object.entries(STATUS_LABELS).map(([k, v]) => [v, k]));

let subjectMs, topicMs, subTopicMs, statusMs, tagMs;
/** @type {HTMLButtonElement|null} */
let statusModeToggleBtn = null;

/**
 * @param {{subjectMount: HTMLElement, topicMount: HTMLElement, subTopicMount: HTMLElement, statusMount: HTMLElement, tagMount?: HTMLElement, statusModeToggleBtn?: HTMLButtonElement|null, clearStatusBtn?: HTMLElement|null}} mounts
 */
export function initFilters(mounts) {
  subjectMs = createMultiSelect(mounts.subjectMount, {
    placeholder: "Subject",
    onChange: (selected) => {
      appState.filterState = { ...appState.filterState, subjects: selected };
      onFilterChanged();
    },
  });
  topicMs = createMultiSelect(mounts.topicMount, {
    placeholder: "Topic",
    onChange: (selected) => {
      appState.filterState = { ...appState.filterState, topics: selected };
      onFilterChanged();
    },
  });
  subTopicMs = createMultiSelect(mounts.subTopicMount, {
    placeholder: "SubTopic",
    onChange: (selected) => {
      appState.filterState = { ...appState.filterState, subTopics: selected };
      onFilterChanged();
    },
  });
  statusMs = createMultiSelect(mounts.statusMount, {
    placeholder: "Status",
    onChange: (selectedLabels) => {
      const statuses = /** @type {any[]} */ (selectedLabels.map((label) => LABEL_TO_STATUS[label]).filter(Boolean));
      appState.filterState = { ...appState.filterState, statuses };
      onFilterChanged();
    },
  });
  statusMs.setOptions(STATUS_OPTIONS.map((s) => STATUS_LABELS[s]));

  if (mounts.tagMount) {
    tagMs = createMultiSelect(mounts.tagMount, {
      placeholder: "Tags",
      onChange: (selected) => {
        appState.filterState = { ...appState.filterState, tags: selected };
        onFilterChanged();
      },
    });
    tagMs.setOptions(appState.globalTags);
  }

  // Cycles OR -> AND -> NOT -> OR ...
  const STATUS_MODE_CYCLE = /** @type {const} */ (["OR", "AND", "NOT"]);
  statusModeToggleBtn = mounts.statusModeToggleBtn || null;
  statusModeToggleBtn?.addEventListener("click", () => {
    const currentIdx = STATUS_MODE_CYCLE.indexOf(appState.filterState.statusMode === "AND" || appState.filterState.statusMode === "NOT" ? appState.filterState.statusMode : "OR");
    const nextMode = STATUS_MODE_CYCLE[(currentIdx + 1) % STATUS_MODE_CYCLE.length];
    appState.filterState = { ...appState.filterState, statusMode: nextMode };
    onFilterChanged();
    renderStatusModeToggle();
  });

  mounts.clearStatusBtn?.addEventListener("click", () => clearStatusFilterOnly());

  syncControlsFromState();
}

/** @type {Record<"OR"|"AND"|"NOT", string>} */
const STATUS_MODE_TITLES = {
  OR: "Matching ANY selected status (OR) — click to require ALL instead (AND)",
  AND: "Matching ALL selected statuses (AND) — click to EXCLUDE any selected status instead (NOT)",
  NOT: "Excluding any selected status (NOT) — click to match ANY instead (OR)",
};

/** Reflects appState.filterState.statusMode ("OR"/"AND"/"NOT") onto the toggle button's label/state. */
function renderStatusModeToggle() {
  if (!statusModeToggleBtn) return;
  const mode = appState.filterState.statusMode === "AND" || appState.filterState.statusMode === "NOT" ? appState.filterState.statusMode : "OR";
  statusModeToggleBtn.textContent = mode;
  statusModeToggleBtn.title = STATUS_MODE_TITLES[mode];
}

function onFilterChanged() {
  refreshView();
  fileManager.persistCurrentProgress();
  refreshOptionLists();
}

/** Recomputes each dropdown's own option list from the OTHER active filters. */
export function refreshOptionLists() {
  const opts = getFilterOptions();
  subjectMs?.setOptions(opts.subjects);
  topicMs?.setOptions(opts.topics);
  subTopicMs?.setOptions(opts.subTopics);
}

/** Re-reads the Tags dropdown's option list from appState.globalTags — call whenever a new tag is
 *  created (see features/tags.js's createAndAddTag) so it shows up without a full reload. */
export function refreshTagOptions() {
  tagMs?.setOptions(appState.globalTags);
}

/** Syncs the multi-select UI widgets from appState.filterState (call on file switch/load). */
export function syncControlsFromState() {
  subjectMs?.setSelected(appState.filterState.subjects);
  topicMs?.setSelected(appState.filterState.topics);
  subTopicMs?.setSelected(appState.filterState.subTopics);
  statusMs?.setSelected(appState.filterState.statuses.map((s) => STATUS_LABELS[s]));
  refreshTagOptions();
  tagMs?.setSelected(appState.filterState.tags);
  renderStatusModeToggle();
  refreshOptionLists();
}

export function clearFilters() {
  appState.filterState = emptyFilterState();
  syncControlsFromState();
  onFilterChanged();
}

/**
 * The Stats dropdown's own click-to-filter: additive, same as the Status multiSelect
 * (statusFilterMount) — toggles ONE status in/out of the existing `statuses` selection rather than
 * replacing it, so e.g. clicking "With Answer" then "Done" ends up with both selected (combined per
 * appState.filterState.statusMode — see data/filter.js's matchesStatus).
 * @param {"done"|"reviewLater"|"dueForReview"|"duplicate"|"notImportant"|"starred"|"failed"|"hasAnswer"|"noAnswer"|"unmarked"|"difficultyEasy"|"difficultyMedium"|"difficultyHard"} status
 */
export function toggleStatusFilter(status) {
  const set = new Set(appState.filterState.statuses);
  if (set.has(status)) set.delete(status);
  else set.add(status);
  appState.filterState = { ...appState.filterState, statuses: [...set] };
  syncControlsFromState();
  onFilterChanged();
}

/**
 * The Stats dropdown's Tags section click-to-filter — additive, same shape as toggleStatusFilter but
 * for appState.filterState.tags instead of .statuses.
 * @param {string} tag
 */
export function toggleTagFilter(tag) {
  const set = new Set(appState.filterState.tags);
  if (set.has(tag)) set.delete(tag);
  else set.add(tag);
  appState.filterState = { ...appState.filterState, tags: [...set] };
  syncControlsFromState();
  onFilterChanged();
}

/** Clears ONLY the Status selection (statusFilterMount / Stats dropdown), leaving Subject/Topic/
 *  SubTopic and the AND/OR/NOT mode untouched — distinct from clearFilters(), which resets everything. */
export function clearStatusFilterOnly() {
  appState.filterState = { ...appState.filterState, statuses: [] };
  syncControlsFromState();
  onFilterChanged();
}
