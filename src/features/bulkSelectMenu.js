// @ts-check
/**
 * features/bulkSelectMenu.js — "Bulk Select ▾" dropdown mounted in the root bulk-add panel
 * (bulkAddRootWrap). A tree-wide shortcut for turning on select-mode (checkbox visibility) across
 * every Subject/Topic/SubTopic/Question at once, instead of clicking each accordion's own "Select
 * mode" button one by one — see bulkSelection.js's enableSubjectSelectMode/enableSelectModeEverywhere.
 * Each option only reveals checkboxes for the user to pick specific items with; it never
 * auto-selects everything (use the floating bar's "Select All" for that, once some items are
 * already selected).
 */
import * as bulkSelection from "./bulkSelection.js";

/** @param {HTMLElement} mountEl */
export function mountBulkSelectMenu(mountEl) {
  const wrap = document.createElement("div");
  wrap.className = "bulk-select-menu-wrap";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-sm btn-outline-secondary";
  btn.innerHTML = '<i class="fa-solid fa-square-check"></i> Bulk Select <i class="fa-solid fa-caret-down"></i>';
  btn.setAttribute("aria-haspopup", "true");
  btn.setAttribute("aria-expanded", "false");

  const panel = document.createElement("div");
  panel.className = "bulk-select-menu-panel";
  panel.hidden = true;

  /** @param {string} label @param {() => void} onClick */
  const item = (label, onClick) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "btn btn-sm btn-outline-secondary bulk-select-menu-item";
    row.textContent = label;
    row.addEventListener("click", () => {
      onClick();
      close();
    });
    panel.appendChild(row);
  };

  item("Select Subjects", () => bulkSelection.enableSubjectSelectMode());
  item("Select Topics", () => bulkSelection.enableSelectModeEverywhere("topic"));
  item("Select SubTopics", () => bulkSelection.enableSelectModeEverywhere("subTopic"));
  item("Select Questions", () => bulkSelection.enableSelectModeEverywhere("question"));

  function close() {
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", onDocClick);
  }
  function onDocClick(/** @type {MouseEvent} */ e) {
    if (!wrap.contains(/** @type {Node} */ (e.target))) close();
  }
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = panel.hidden;
    panel.hidden = !opening;
    btn.setAttribute("aria-expanded", String(opening));
    if (opening) document.addEventListener("click", onDocClick);
    else document.removeEventListener("click", onDocClick);
  });
  panel.addEventListener("click", (e) => e.stopPropagation());

  wrap.append(btn, panel);
  mountEl.appendChild(wrap);
}
