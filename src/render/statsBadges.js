// @ts-check
/**
 * render/statsBadges.js — Global stats dropdown (Total/Filtered/Review/Done/Starred/Due/Failed,
 * click any row to filter) plus the global actions group (Edit Mode toggle, Flatten toggle,
 * Drag-and-drop toggle, Auto-Expand toggle, Find Duplicates, Copy Visible).
 * Render-only; every click calls a handler. Deliberately NOT edit-gated (unlike per-node controls in
 * render/nodeViews/*) — these are view/read toggles and a non-destructive copy action, not edits, so
 * they stay usable whether or not Edit Mode is on.
 */

let badgesEl = null;
let actionsEl = null;
let progressBarEl = null;
/** Separate from the Filtered dropdown row's own click (which clears group filters). */
let progressBarVisible = false;
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
 * @typedef {Object} StatsData
 * @property {number} total
 * @property {number} filtered
 * @property {number} review
 * @property {number} done
 * @property {number} starred
 * @property {number} due
 * @property {number} failed
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

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "btn btn-sm btn-outline-secondary stats-dropdown-toggle";
  toggleBtn.innerHTML = `<i class="fa-solid fa-list-check"></i> Stats <i class="fa-solid fa-caret-down"></i>`;
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

  // `colorClass` reuses the exact same icon-* classes render/nodeViews/questionView.js's status
  // icons use, so a dropdown row and its matching per-question icon are always the same color
  // (see .stats-dropdown-item's CSS, mirroring .icon-btn.is-active).
  /** @type {Array<{label: string, count: number, colorClass: string|null, onClick: () => void}>} */
  const items = [
    { label: "Total", count: stats.total, colorClass: null, onClick: () => handlers.onTotalClick() },
    { label: "Filtered", count: stats.filtered, colorClass: null, onClick: () => handlers.onFilteredClick() },
    { label: "Review", count: stats.review, colorClass: "icon-review", onClick: () => handlers.onStatusBadgeClick("reviewLater") },
    { label: "Done", count: stats.done, colorClass: "icon-done", onClick: () => handlers.onStatusBadgeClick("done") },
    { label: "Starred", count: stats.starred, colorClass: "icon-starred", onClick: () => handlers.onStatusBadgeClick("starred") },
    { label: "Due", count: stats.due, colorClass: null, onClick: () => handlers.onStatusBadgeClick("dueForReview") },
    { label: "Failed", count: stats.failed, colorClass: "icon-failed", onClick: () => handlers.onStatusBadgeClick("failed") },
  ];
  for (const item of items) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `stats-dropdown-item${item.colorClass ? ` ${item.colorClass} is-active` : ""}`;
    row.innerHTML = `<span class="stats-dropdown-label">${item.label}</span><span class="stats-dropdown-count">${item.count}</span>`;
    row.addEventListener("click", (e) => {
      e.stopPropagation();
      item.onClick();
    });
    panel.appendChild(row);
  }
  dropdownWrap.appendChild(panel);
  badgesEl.appendChild(dropdownWrap);

  // Sits next to the Stats dropdown — toggles the segmented breakdown progress bar below (see
  // renderStatsProgress), separate from any single dropdown item's own click.
  const progressToggle = document.createElement("button");
  progressToggle.type = "button";
  progressToggle.className = "btn btn-sm btn-outline-secondary stats-progress-toggle";
  progressToggle.title = "Toggle Done/Review breakdown as % of Filtered";
  progressToggle.innerHTML = '<i class="fa-solid fa-chart-simple"></i>';
  progressToggle.classList.toggle("active", progressBarVisible);
  progressToggle.setAttribute("aria-pressed", String(progressBarVisible));
  progressToggle.addEventListener("click", () => {
    progressBarVisible = !progressBarVisible;
    progressToggle.classList.toggle("active", progressBarVisible);
    progressToggle.setAttribute("aria-pressed", String(progressBarVisible));
    renderStatsProgress(stats);
  });
  badgesEl.appendChild(progressToggle);

  renderStatsProgress(stats);
}

/**
 * Bootstrap multi-segment progress bar: Done/Review as % of the Filtered count (the target = 100%).
 * A question can be both Done and Review Later at once, so the two widths aren't guaranteed to sum
 * to <=100% — each segment is independently "this status's share of Filtered", not a
 * mutually-exclusive partition.
 * @param {StatsData} stats
 */
function renderStatsProgress(stats) {
  if (!progressBarEl) return;
  progressBarEl.hidden = !progressBarVisible;
  progressBarEl.textContent = "";
  if (!progressBarVisible) return;

  const bar = document.createElement("div");
  bar.className = "progress stats-progress";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", "Filtered breakdown: Done, Review");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");

  // Same Bootstrap color variant as each stat's own badge above, so the segment reads as "that badge,
  // stretched into a bar" rather than an unrelated new color scheme.
  const segments = [
    { variant: "success", label: "Done", count: stats.done },
    { variant: "warning", label: "Review", count: stats.review },
  ];
  for (const { variant, label, count } of segments) {
    const percent = stats.filtered > 0 ? Math.round((count / stats.filtered) * 100) : 0;
    const segment = document.createElement("div");
    segment.className = `progress-bar progress-bar-striped progress-bar-animated bg-${variant}`;
    segment.style.width = `${percent}%`;
    segment.textContent = percent > 0 ? `${label} ${percent}%` : "";
    segment.title = `${label}: ${count} of ${stats.filtered} filtered (${percent}%)`;
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

  const editModeBtn = document.createElement("button");
  editModeBtn.type = "button";
  editModeBtn.className = "btn btn-sm btn-outline-secondary";
  editModeBtn.title = "Toggle Edit Mode";
  editModeBtn.innerHTML = '<i class="fa-solid fa-pencil"></i>';
  editModeBtn.classList.toggle("active", toggles.editModeOn);
  editModeBtn.addEventListener("click", () => handlers.onToggleEditMode());
  actionsEl.appendChild(editModeBtn);

  const flatBtn = document.createElement("button");
  flatBtn.type = "button";
  flatBtn.className = "btn btn-sm btn-outline-secondary";
  flatBtn.title = "Toggle Flatten View";
  flatBtn.innerHTML = '<i class="fa-solid fa-align-left"></i>';
  flatBtn.classList.toggle("active", toggles.flatGroupView);
  flatBtn.addEventListener("click", () => handlers.onToggleFlatten());
  actionsEl.appendChild(flatBtn);

  const dragBtn = document.createElement("button");
  dragBtn.type = "button";
  dragBtn.className = "btn btn-sm btn-outline-secondary";
  dragBtn.title = "Toggle Drag & Drop";
  dragBtn.innerHTML = '<i class="fa-solid fa-arrows-up-down-left-right"></i>';
  dragBtn.classList.toggle("active", toggles.dragDropOn);
  dragBtn.addEventListener("click", () => handlers.onToggleDragDrop());
  actionsEl.appendChild(dragBtn);

  const autoExpandBtn = document.createElement("button");
  autoExpandBtn.type = "button";
  autoExpandBtn.className = "btn btn-sm btn-outline-secondary";
  autoExpandBtn.title = "Toggle Auto-Expand Children (opening a Subject/Topic also opens its first Topic/SubTopic)";
  autoExpandBtn.innerHTML = '<i class="fa-solid fa-angles-down"></i>';
  autoExpandBtn.classList.toggle("active", !!toggles.autoExpandChildrenOn);
  autoExpandBtn.addEventListener("click", () => handlers.onToggleAutoExpand());
  actionsEl.appendChild(autoExpandBtn);

  const findDupesBtn = document.createElement("button");
  findDupesBtn.type = "button";
  findDupesBtn.className = "btn btn-sm btn-outline-secondary";
  findDupesBtn.title = "Find Duplicates in the current filtered view";
  findDupesBtn.innerHTML = '<i class="fa-solid fa-clone"></i>';
  findDupesBtn.addEventListener("click", () => handlers.onFindDuplicates());
  actionsEl.appendChild(findDupesBtn);

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
