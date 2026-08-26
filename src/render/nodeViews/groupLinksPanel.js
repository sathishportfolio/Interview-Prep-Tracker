// @ts-check
/**
 * render/nodeViews/groupLinksPanel.js — shared Related Links control for a Subject/Topic/SubTopic
 * accordion, reused identically by subjectView.js/topicView.js/subTopicView.js. Mirrors
 * questionView.js's own links-dropdown-wrap (edit panel: reorderable list + add-link form) and its
 * read-only display row — same markup/CSS classes, just scoped by level+scope instead of a question
 * id. Render-only; every action calls into `handlers`. Never imports features/*.
 * @typedef {import('../../types.js').QuestionLink} QuestionLink
 */
import { openPanel as coordinatorOpenPanel, panelClosed as coordinatorPanelClosed } from "../panelCoordinator.js";

/**
 * Builds the header-controls icon button + its click-toggled edit panel (reorderable list + add-link
 * form) — append the returned element into `headerControls` alongside Copy/Rename/Delete/etc.
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 * @param {Record<string, any>} handlers
 * @returns {HTMLElement}
 */
export function createGroupLinksControl(level, scope, handlers) {
  const wrap = document.createElement("div");
  wrap.className = "links-dropdown-wrap";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-sm btn-light icon-links";
  btn.title = "Related Links";
  btn.innerHTML = '<i class="fa-solid fa-link"></i>';

  const panel = document.createElement("div");
  panel.className = "links-dropdown-panel";
  panel.hidden = true;

  const editList = document.createElement("div");
  editList.className = "related-links-list group-related-links-list";
  editList.dataset.level = level;
  editList.dataset.subject = scope.subject;
  if (level !== "subject") editList.dataset.topic = scope.topic;
  if (level === "subTopic") editList.dataset.subTopic = scope.subTopic;

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-sm btn-outline-secondary link-add-btn";
  addBtn.textContent = "+ Add link";
  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onAddGroupLink(level, scope);
  });

  panel.appendChild(editList);
  panel.appendChild(addBtn);

  const closePanel = () => {
    panel.hidden = true;
    document.removeEventListener("click", onDocClick);
    coordinatorPanelClosed(closePanel);
  };
  const onDocClick = (/** @type {MouseEvent} */ e) => {
    if (!wrap.contains(/** @type {Node} */ (e.target))) closePanel();
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = panel.hidden;
    if (opening) {
      coordinatorOpenPanel(closePanel);
      panel.hidden = false;
      document.addEventListener("click", onDocClick);
    } else {
      closePanel();
    }
  });

  wrap.appendChild(btn);
  wrap.appendChild(panel);
  return wrap;
}

/**
 * @param {HTMLElement} wrap element returned by createGroupLinksControl
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 * @param {QuestionLink[]} links
 * @param {Record<string, any>} handlers
 */
export function patchGroupLinksControl(wrap, level, scope, links, handlers) {
  const btn = wrap.querySelector(".icon-links");
  if (btn) btn.classList.toggle("is-active", links.length > 0);

  const editList = wrap.querySelector(".group-related-links-list");
  if (!editList) return;
  editList.textContent = "";
  if (links.length === 0) {
    const empty = document.createElement("div");
    empty.className = "tag-chips-empty";
    empty.textContent = "No links yet — add one below.";
    editList.appendChild(empty);
  }
  for (const link of links) {
    const row = document.createElement("div");
    row.className = "link-edit-row";
    row.dataset.linkId = link.id;
    const dragHandle = document.createElement("i");
    dragHandle.className = "fa-solid fa-grip-vertical drag-handle";
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.className = "link-edit-anchor";
    anchor.textContent = link.label || link.url;
    anchor.addEventListener("click", (e) => e.stopPropagation());
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "tag-chip-action";
    editBtn.title = "Edit link";
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handlers.onEditGroupLink(level, scope, link.id, link.label, link.url);
    });
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "tag-chip-action";
    removeBtn.title = "Remove link";
    removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handlers.onRemoveGroupLink(level, scope, link.id, link.label);
    });
    row.appendChild(dragHandle);
    row.appendChild(anchor);
    row.appendChild(editBtn);
    row.appendChild(removeBtn);
    editList.appendChild(row);
  }
}

/** @returns {HTMLElement} an empty read-only chip row — append into the accordion body, right before its status-summary-row */
export function createGroupLinksDisplayRow() {
  const row = document.createElement("div");
  row.className = "group-links-row";
  return row;
}

/** @param {HTMLElement} row @param {QuestionLink[]} links */
export function patchGroupLinksDisplayRow(row, links) {
  row.textContent = "";
  row.hidden = links.length === 0;
  for (const link of links) {
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.className = "link-chip";
    anchor.title = link.url;
    const linkIcon = document.createElement("i");
    linkIcon.className = "fa-solid fa-arrow-up-right-from-square";
    anchor.appendChild(linkIcon);
    anchor.appendChild(document.createTextNode(` ${link.label || link.url}`));
    anchor.addEventListener("click", (e) => e.stopPropagation());
    row.appendChild(anchor);
  }
}
