// @ts-check
/**
 * render/statsBadges.js — Global stats badges row (Total/Filtered/Review/Done/Starred) plus the
 * global actions group (Edit Mode toggle, Flatten toggle, Drag-and-drop toggle, Auto-Expand
 * toggle, Find Duplicates, Copy Visible).
 * Render-only; every click calls a handler. Deliberately NOT edit-gated (unlike per-node controls in
 * render/nodeViews/*) — these are view/read toggles and a non-destructive copy action, not edits, so
 * they stay usable whether or not Edit Mode is on.
 */

let badgesEl = null;
let actionsEl = null;
let progressBarEl = null;
/** Separate from the Filtered badge's own click (which clears group filters) — see mkBadge call site. */
let progressBarVisible = false;

/**
 * @param {HTMLElement} badgesContainer
 * @param {HTMLElement} actionsContainer
 * @param {HTMLElement} [progressBarContainer]
 */
export function initStatsBadges(badgesContainer, actionsContainer, progressBarContainer) {
  badgesEl = badgesContainer;
  actionsEl = actionsContainer;
  progressBarEl = progressBarContainer || null;
}

/**
 * @typedef {Object} StatsData
 * @property {number} total
 * @property {number} filtered
 * @property {number} review
 * @property {number} done
 * @property {number} starred
 * @property {number} due
 */

/**
 * @param {StatsData} stats
 * @param {Record<string, any>} handlers
 */
export function renderStatsBadges(stats, handlers) {
  if (!badgesEl) return;
  badgesEl.textContent = "";

  badgesEl.appendChild(mkBadge("secondary", `Total: ${stats.total}`, () => handlers.onTotalClick()));
  badgesEl.appendChild(mkBadge("primary", `Filtered: ${stats.filtered}`, () => handlers.onFilteredClick()));
  badgesEl.appendChild(mkBadge("warning", `Review: ${stats.review}`, () => handlers.onStatusBadgeClick("reviewLater")));
  badgesEl.appendChild(mkBadge("success", `Done: ${stats.done}`, () => handlers.onStatusBadgeClick("done")));
  badgesEl.appendChild(mkBadge("info", `Starred: ${stats.starred}`, () => handlers.onStatusBadgeClick("starred")));
  badgesEl.appendChild(mkBadge("danger", `Due: ${stats.due}`, () => handlers.onStatusBadgeClick("dueForReview")));

  // Separate trigger from the Filtered badge's own click (which clears group filters) — toggles the
  // segmented breakdown progress bar below (see renderStatsProgress).
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

  const copyBtn = document.createElement("div");
  copyBtn.className = "btn-group";
  const copyMain = document.createElement("button");
  copyMain.type = "button";
  copyMain.className = "btn btn-sm btn-primary";
  copyMain.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Visible';
  const formats = [
    ["plain", "Questions (plain)"],
    ["structureWithAnswer", "Structure + Answer"],
    ["hierarchy", "Hierarchy (tab-indented)"],
    ["structureOnly", "Structure only"],
    ["hierarchyOnly", "Hierarchy only"],
  ];
  copyMain.addEventListener("click", () => handlers.onCopyVisible(formats[0][0]));
  copyBtn.appendChild(copyMain);
  actionsEl.appendChild(copyBtn);

  const select = document.createElement("select");
  select.className = "form-select form-select-sm";
  select.style.maxWidth = "180px";
  for (const [value, label] of formats) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => handlers.onCopyVisible(select.value));
  actionsEl.appendChild(select);
}

/**
 * @param {string} variant
 * @param {string} text
 * @param {() => void} onClick
 */
function mkBadge(variant, text, onClick) {
  const span = document.createElement("span");
  span.className = `badge bg-${variant}`;
  span.textContent = text;
  span.addEventListener("click", onClick);
  return span;
}
