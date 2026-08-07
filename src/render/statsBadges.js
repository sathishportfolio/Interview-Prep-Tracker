// @ts-check
/**
 * render/statsBadges.js — Global stats badges row (Total/Filtered/Review/Done/Starred) plus the
 * global actions group (Flatten toggle, Drag-and-drop toggle, Copy Visible button). Render-only;
 * every click calls a handler.
 */

let badgesEl = null;
let actionsEl = null;

/**
 * @param {HTMLElement} badgesContainer
 * @param {HTMLElement} actionsContainer
 */
export function initStatsBadges(badgesContainer, actionsContainer) {
  badgesEl = badgesContainer;
  actionsEl = actionsContainer;
}

/**
 * @typedef {Object} StatsData
 * @property {number} total
 * @property {number} filtered
 * @property {number} review
 * @property {number} done
 * @property {number} starred
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
}

/**
 * @param {{flatGroupView: boolean, dragDropOn: boolean}} toggles
 * @param {Record<string, any>} handlers
 */
export function renderGlobalActions(toggles, handlers) {
  if (!actionsEl) return;
  actionsEl.textContent = "";

  const flatBtn = document.createElement("button");
  flatBtn.type = "button";
  flatBtn.className = "btn btn-sm btn-outline-secondary edit-gated";
  flatBtn.title = "Toggle Flatten View";
  flatBtn.innerHTML = '<i class="fa-solid fa-align-left"></i>';
  flatBtn.classList.toggle("active", toggles.flatGroupView);
  flatBtn.addEventListener("click", () => handlers.onToggleFlatten());
  actionsEl.appendChild(flatBtn);

  const dragBtn = document.createElement("button");
  dragBtn.type = "button";
  dragBtn.className = "btn btn-sm btn-outline-secondary edit-gated";
  dragBtn.title = "Toggle Drag & Drop";
  dragBtn.innerHTML = '<i class="fa-solid fa-arrows-up-down-left-right"></i>';
  dragBtn.classList.toggle("active", toggles.dragDropOn);
  dragBtn.addEventListener("click", () => handlers.onToggleDragDrop());
  actionsEl.appendChild(dragBtn);

  const copyBtn = document.createElement("div");
  copyBtn.className = "btn-group edit-gated";
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
  select.className = "form-select form-select-sm edit-gated";
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
