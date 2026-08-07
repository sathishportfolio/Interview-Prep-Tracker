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

const STATUS_OPTIONS = /** @type {const} */ (["done", "reviewLater", "duplicate", "lessImportant", "starred"]);
/** @type {Record<string, string>} */
const STATUS_LABELS = {
  done: "Done", reviewLater: "Review Later", duplicate: "Duplicate", lessImportant: "Less Important", starred: "Starred",
};
/** @type {Record<string, string>} */
const LABEL_TO_STATUS = Object.fromEntries(Object.entries(STATUS_LABELS).map(([k, v]) => [v, k]));

let subjectMs, topicMs, subTopicMs, statusMs;

/**
 * @param {{subjectMount: HTMLElement, topicMount: HTMLElement, subTopicMount: HTMLElement, statusMount: HTMLElement}} mounts
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

  syncControlsFromState();
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

/** Syncs the multi-select UI widgets from appState.filterState (call on file switch/load). */
export function syncControlsFromState() {
  subjectMs?.setSelected(appState.filterState.subjects);
  topicMs?.setSelected(appState.filterState.topics);
  subTopicMs?.setSelected(appState.filterState.subTopics);
  statusMs?.setSelected(appState.filterState.statuses.map((s) => STATUS_LABELS[s]));
  refreshOptionLists();
}

export function clearFilters() {
  appState.filterState = emptyFilterState();
  syncControlsFromState();
  onFilterChanged();
}

/** Clicking "Filtered" stats badge resets only Subject/Topic/SubTopic filters, not Status. */
export function clearGroupFiltersOnly() {
  appState.filterState = { ...appState.filterState, subjects: [], topics: [], subTopics: [] };
  syncControlsFromState();
  onFilterChanged();
}

/**
 * Toggles a single status filter on/off directly (Global Stats Badges click-to-filter).
 * @param {"done"|"reviewLater"|"duplicate"|"lessImportant"|"starred"} status
 */
export function toggleStatusFilter(status) {
  const set = new Set(appState.filterState.statuses);
  if (set.has(status)) set.delete(status);
  else set.add(status);
  appState.filterState = { ...appState.filterState, statuses: [...set] };
  syncControlsFromState();
  onFilterChanged();
}
