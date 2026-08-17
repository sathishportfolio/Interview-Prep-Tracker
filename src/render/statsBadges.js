// @ts-check
/**
 * render/statsBadges.js — Global stats dropdown (Total, plus Review/Done/Starred/Due/Failed/With
 * Answer/Without Answer — click any row to toggle it in/out of the Status filter, additive/multi-
 * select just like statusFilterMount, both sharing appState.filterState.statuses, combined via
 * appState.filterState.statusMode's AND/OR — see filters.js's toggleStatusFilter). Each row shows
 * its own plain count by default; once 1+ statuses are active, every row switches to a
 * "count/total" fraction where `total` is THAT ROW'S OWN fixed count (unaffected by which row(s)
 * are active) and `count` is how many also match the full active filter (see features/refresh.js's
 * `statusFraction`) — currently-selected rows are additionally marked active. Plus the global
 * actions group (Edit Mode toggle, Flatten toggle, Drag-and-drop toggle, Auto-Expand toggle, Find
 * Duplicates, Copy Visible).
 * Render-only; every click calls a handler. Deliberately NOT edit-gated (unlike per-node controls in
 * render/nodeViews/*) — these are view/read toggles and a non-destructive copy action, not edits, so
 * they stay usable whether or not Edit Mode is on.
 */
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";

let badgesEl = null;
let actionsEl = null;
let progressBarEl = null;
/** Preserved across repaints (badgesEl is rebuilt from scratch every render) so re-rendering to
 *  reflect updated counts doesn't also close a dropdown the user just opened. */
let statsDropdownOpen = false;
/** Last args renderStatsBadges was called with, so the toggle/outside-click handlers below can
 *  re-render with the same data after just flipping statsDropdownOpen. */
let lastStats = null;
let lastHandlers = null;

/**
 * @param {HTMLElement} badgesContainer
 * @param {HTMLElement} actionsContainer
 * @param {HTMLElement} [progressBarContainer]
 */
export function initStatsBadges(badgesContainer, actionsContainer, progressBarContainer) {
  badgesEl = badgesContainer;
  actionsEl = actionsContainer;
  progressBarEl = progressBarContainer || null;

  document.addEventListener("click", (e) => {
    if (!statsDropdownOpen) return;
    const target = /** @type {Element|null} */ (e.target);
    if (target && target.closest(".stats-dropdown")) return;
    closeStatsDropdown();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && statsDropdownOpen) closeStatsDropdown();
  });
}

function closeStatsDropdown() {
  statsDropdownOpen = false;
  if (lastStats) renderStatsBadges(lastStats, lastHandlers);
}

/**
 * @typedef {Object} StatusFraction
 * @property {number} count Matching this row's own status; when 1+ statuses are active, also
 *   narrowed to match the FULL active filter too (an intersection) — else same as `total`.
 * @property {number} total This row's own fixed count (matching only its own status, ignoring any
 *   active Status filter) — the row's denominator, which never changes no matter which OTHER
 *   row(s) get toggled.
 */

/**
 * @typedef {Object} StatsData
 * @property {number} total Count matching only the current Subject/Topic/SubTopic filter (NOT
 *   narrowed by Status) — the toggle button's own "Total: N" reading when no Status is active.
 * @property {number} filtered Count matching the current Subject/Topic/SubTopic filter AND the
 *   full active Status filter combined — the toggle button's "Filtered: N" reading once 1+
 *   statuses are active; same as `total` otherwise.
 * @property {string[]} activeStatuses appState.filterState.statuses — which rows to visually mark
 *   as currently selected (statusFilterMount and the Stats dropdown share this same array), and
 *   whether any fraction display applies at all (activeStatuses.length > 0).
 * @property {StatusFraction} review
 * @property {StatusFraction} done
 * @property {StatusFraction} starred
 * @property {StatusFraction} due
 * @property {StatusFraction} failed
 * @property {StatusFraction} withAnswer
 * @property {StatusFraction} withoutAnswer
 * @property {StatusFraction} unmarked Questions with none of Done/Failed/Review Later set.
 */

/**
 * @param {StatsData} stats
 * @param {Record<string, any>} handlers
 */
export function renderStatsBadges(stats, handlers) {
  if (!badgesEl) return;
  lastStats = stats;
  lastHandlers = handlers;
  badgesEl.textContent = "";

  const dropdownWrap = document.createElement("div");
  dropdownWrap.className = "stats-dropdown";

  // `colorClass` reuses the exact same icon-* classes render/nodeViews/questionView.js's status
  // icons use, so a dropdown row and its matching per-question icon are always the same color
  // (see .stats-dropdown-item's CSS, mirroring .icon-btn.is-active).
  /** @type {Array<{statusKey: string, label: string, fraction: StatusFraction, colorClass: string|null, onClick: () => void}>} */
  const items = [
    { statusKey: "unmarked", label: "Unmarked", fraction: stats.unmarked, colorClass: null, onClick: () => handlers.onStatusBadgeClick("unmarked") },
    { statusKey: "done", label: "Done", fraction: stats.done, colorClass: "icon-done", onClick: () => handlers.onStatusBadgeClick("done") },
    { statusKey: "failed", label: "Failed", fraction: stats.failed, colorClass: "icon-failed", onClick: () => handlers.onStatusBadgeClick("failed") },
    { statusKey: "reviewLater", label: "Review", fraction: stats.review, colorClass: "icon-review", onClick: () => handlers.onStatusBadgeClick("reviewLater") },
    { statusKey: "starred", label: "Starred", fraction: stats.starred, colorClass: "icon-starred", onClick: () => handlers.onStatusBadgeClick("starred") },
    { statusKey: "hasAnswer", label: "With Answer", fraction: stats.withAnswer, colorClass: null, onClick: () => handlers.onStatusBadgeClick("hasAnswer") },
    { statusKey: "noAnswer", label: "Without Answer", fraction: stats.withoutAnswer, colorClass: null, onClick: () => handlers.onStatusBadgeClick("noAnswer") },
    { statusKey: "dueForReview", label: "Due", fraction: stats.due, colorClass: null, onClick: () => handlers.onStatusBadgeClick("dueForReview") },
  ];
  const activeStatuses = new Set(stats.activeStatuses || []);
  const hasActiveFilter = activeStatuses.size > 0;

  /** @param {StatusFraction} fraction */
  const fractionText = (fraction) => (hasActiveFilter ? `${fraction.count}/${fraction.total}` : `${fraction.count}`);

  // The toggle button reads "Total: N" (N = count matching the current Subject/Topic/SubTopic
  // scope, ignoring Status) when nothing's active, or "Filtered: N" (N = that same scope narrowed
  // by the full active Status filter) once 1+ statuses are toggled on — with multi-select there's
  // no single "active row" to spotlight here, unlike each dropdown row below, which is individually
  // marked selected/unselected via `.filter-active` and shows its own count/total fraction.
  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "btn btn-sm btn-outline-secondary stats-dropdown-toggle";
  const toggleText = hasActiveFilter ? `Filtered: ${stats.filtered}` : `Total: ${stats.total}`;
  toggleBtn.innerHTML = `<i class="fa-solid fa-list-check"></i> ${toggleText} <i class="fa-solid fa-caret-down"></i>`;
  toggleBtn.setAttribute("aria-expanded", String(statsDropdownOpen));
  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    statsDropdownOpen = !statsDropdownOpen;
    renderStatsBadges(stats, handlers);
  });
  dropdownWrap.appendChild(toggleBtn);

  const panel = document.createElement("div");
  panel.className = "stats-dropdown-panel";
  panel.hidden = !statsDropdownOpen;

  for (const item of items) {
    const row = document.createElement("button");
    row.type = "button";
    const isActive = activeStatuses.has(item.statusKey);
    row.className = `stats-dropdown-item${item.colorClass ? ` ${item.colorClass} is-active` : ""}${isActive ? " filter-active" : ""}`;
    row.setAttribute("aria-pressed", String(isActive));
    row.innerHTML = `<span class="stats-dropdown-label">${item.label}</span><span class="stats-dropdown-count">${fractionText(item.fraction)}</span>`;
    row.addEventListener("click", (e) => {
      e.stopPropagation();
      item.onClick();
    });
    panel.appendChild(row);
  }
  dropdownWrap.appendChild(panel);
  badgesEl.appendChild(dropdownWrap);

  // Sits next to the Stats dropdown — toggles the segmented breakdown progress bar below (see
  // renderStatsProgress), separate from any single dropdown item's own click. Persisted globally
  // (appState.toggles.statsProgressVisible), like themeDark/autoDownloadOn/filterCardOpen, so the
  // shown/hidden state carries across devices instead of resetting on reload.
  const progressBarVisible = !!appState.toggles.statsProgressVisible;
  const progressToggle = document.createElement("button");
  progressToggle.type = "button";
  progressToggle.className = "btn btn-sm btn-outline-secondary stats-progress-toggle";
  progressToggle.title = "Toggle Done/Review/Failed breakdown as % of Filtered";
  progressToggle.innerHTML = '<i class="fa-solid fa-chart-simple"></i>';
  progressToggle.classList.toggle("active", progressBarVisible);
  progressToggle.setAttribute("aria-pressed", String(progressBarVisible));
  progressToggle.addEventListener("click", () => {
    appState.toggles = { ...appState.toggles, statsProgressVisible: !progressBarVisible };
    store.writeGlobalToggles(appState.toggles);
    renderStatsBadges(stats, handlers);
  });
  badgesEl.appendChild(progressToggle);

  renderStatsProgress(stats);
}

/**
 * Bootstrap multi-segment progress bar: Done/Review/Failed as % of `stats.total` (the current
 * Subject/Topic/SubTopic scope, ignoring Status — same fixed denominator every dropdown row's
 * fraction uses; the target = 100%). A question can be Done AND Review Later AND Failed at once,
 * so the segment widths aren't guaranteed to sum to <=100% — each segment is independently "this
 * status's share of the scope", not a mutually-exclusive partition.
 * @param {StatsData} stats
 */
function renderStatsProgress(stats) {
  if (!progressBarEl) return;
  const visible = !!appState.toggles.statsProgressVisible;
  progressBarEl.hidden = !visible;
  progressBarEl.textContent = "";
  if (!visible) return;

  const bar = document.createElement("div");
  bar.className = "progress stats-progress";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", "Breakdown: Done, Review, Failed");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");

  // Same Bootstrap color variant as each stat's own badge above, so the segment reads as "that badge,
  // stretched into a bar" rather than an unrelated new color scheme.
  const segments = [
    { variant: "success", label: "Done", count: stats.done.count },
    { variant: "warning", label: "Review", count: stats.review.count },
    { variant: "danger", label: "Failed", count: stats.failed.count },
  ];
  for (const { variant, label, count } of segments) {
    const percent = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
    const segment = document.createElement("div");
    segment.className = `progress-bar progress-bar-striped progress-bar-animated bg-${variant}`;
    segment.style.width = `${percent}%`;
    segment.textContent = percent > 0 ? `${label} ${percent}%` : "";
    segment.title = `${label}: ${count} of ${stats.total} (${percent}%)`;
    bar.appendChild(segment);
  }
  progressBarEl.appendChild(bar);
}

/**
 * @param {{editModeOn?: boolean, flatGroupView: boolean, dragDropOn: boolean, autoExpandChildrenOn?: boolean}} toggles
 * @param {Record<string, any>} handlers
 */
export function renderGlobalActions(toggles, handlers) {
  if (!actionsEl) return;
  actionsEl.textContent = "";

  // The icon buttons scroll internally (see .action-icons-scroll) if they don't all fit; the Copy
  // Visible select is appended to actionsEl directly afterward, OUTSIDE this scrollable wrapper, so
  // it always stays pinned fully visible at the row's right edge instead of scrolling out of view.
  const iconsWrap = document.createElement("div");
  iconsWrap.className = "action-icons-scroll";
  actionsEl.appendChild(iconsWrap);

  const editModeBtn = document.createElement("button");
  editModeBtn.type = "button";
  editModeBtn.className = "btn btn-sm btn-outline-secondary";
  editModeBtn.title = "Toggle Edit Mode";
  editModeBtn.innerHTML = '<i class="fa-solid fa-pencil"></i>';
  editModeBtn.classList.toggle("active", toggles.editModeOn);
  editModeBtn.addEventListener("click", () => handlers.onToggleEditMode());
  iconsWrap.appendChild(editModeBtn);

  const flatBtn = document.createElement("button");
  flatBtn.type = "button";
  flatBtn.className = "btn btn-sm btn-outline-secondary";
  flatBtn.title = "Toggle Flatten View";
  flatBtn.innerHTML = '<i class="fa-solid fa-align-left"></i>';
  flatBtn.classList.toggle("active", toggles.flatGroupView);
  flatBtn.addEventListener("click", () => handlers.onToggleFlatten());
  iconsWrap.appendChild(flatBtn);

  const dragBtn = document.createElement("button");
  dragBtn.type = "button";
  dragBtn.className = "btn btn-sm btn-outline-secondary";
  dragBtn.title = "Toggle Drag & Drop";
  dragBtn.innerHTML = '<i class="fa-solid fa-arrows-up-down-left-right"></i>';
  dragBtn.classList.toggle("active", toggles.dragDropOn);
  dragBtn.addEventListener("click", () => handlers.onToggleDragDrop());
  iconsWrap.appendChild(dragBtn);

  const autoExpandBtn = document.createElement("button");
  autoExpandBtn.type = "button";
  autoExpandBtn.className = "btn btn-sm btn-outline-secondary";
  autoExpandBtn.title = "Toggle Auto-Expand Children (opening a Subject/Topic also opens its first Topic/SubTopic)";
  autoExpandBtn.innerHTML = '<i class="fa-solid fa-angles-down"></i>';
  autoExpandBtn.classList.toggle("active", !!toggles.autoExpandChildrenOn);
  autoExpandBtn.addEventListener("click", () => handlers.onToggleAutoExpand());
  iconsWrap.appendChild(autoExpandBtn);

  const findDupesBtn = document.createElement("button");
  findDupesBtn.type = "button";
  findDupesBtn.className = "btn btn-sm btn-outline-secondary";
  findDupesBtn.title = "Find Duplicates in the current filtered view";
  findDupesBtn.innerHTML = '<i class="fa-solid fa-clone"></i>';
  findDupesBtn.addEventListener("click", () => handlers.onFindDuplicates());
  iconsWrap.appendChild(findDupesBtn);

  const formats = [
    ["plain", "Questions (plain)"],
    ["structureWithAnswer", "Structure + Answer"],
    ["hierarchy", "Hierarchy (tab-indented)"],
    ["structureOnly", "Structure only"],
    ["hierarchyOnly", "Hierarchy only"],
  ];

  const select = document.createElement("select");
  select.className = "form-select form-select-sm";
  select.style.maxWidth = "200px";

  // A real, always-selectable option (not a disabled placeholder) — it IS the control's resting
  // state, and re-selecting it (even from itself) fires the default "plain" copy, same as the old
  // standalone "Copy Visible" button did. Picking one of the real formats below copies in that
  // format instead, then the select resets back to this so either can fire again right away.
  const COPY_VISIBLE_VALUE = "__copyVisible__";
  const copyOpt = document.createElement("option");
  copyOpt.value = COPY_VISIBLE_VALUE;
  copyOpt.textContent = "Copy Visible";
  copyOpt.selected = true;
  select.appendChild(copyOpt);

  for (const [value, label] of formats) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => {
    const format = select.value === COPY_VISIBLE_VALUE ? formats[0][0] : select.value;
    handlers.onCopyVisible(format);
    select.value = COPY_VISIBLE_VALUE;
  });
  actionsEl.appendChild(select);
}
