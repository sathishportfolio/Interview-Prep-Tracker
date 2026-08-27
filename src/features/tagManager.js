// @ts-check
/**
 * features/tagManager.js — "Manage Tags" popup (replaces the old addGlobalTagBtn's single-tag
 * `prompt()`): full CRUD over the global tag registry (appState.globalTags) plus each tag's icon
 * (appState.globalTagMeta) and "related tags" (appState.globalTagRelations) — tags that get
 * auto-applied alongside it whenever this tag is assigned to a question (see data/mutations.js's
 * toggleQuestionTag). Thin: all actual state changes go through features/tags.js; this module is
 * presentation only.
 *
 * Search + Sort: once a file has more than a handful of tags, scrolling to find one gets tedious —
 * a search box (substring match on name) and a sort mode (SORT_OPTIONS below) narrow/reorder the
 * list. Both are local UI state (searchQuery/sortMode module vars below, reset each time the popup
 * opens), NOT persisted — this is a one-off "find it, fix it" tool, not a saved view. Search/sort
 * live in their own toolbar (buildShell), rendered once per modal open; only the list itself
 * (renderList) rebuilds on every tag-level action, so typing in the search box or re-sorting never
 * loses focus/resets the toolbar the way re-rendering the whole modal body would.
 */
import { appState } from "../state/appState.js";
import { openModal } from "./modal.js";
import { showToast } from "./toast.js";
import { createMultiSelect } from "../multiselect/multiSelect.js";
import * as tags from "./tags.js";

/** @type {{value: string, label: string}[]} */
const SORT_OPTIONS = [
  { value: "modified", label: "Recently Modified" },
  { value: "created", label: "Recently Added" },
  { value: "tagged", label: "Recently Tagged" },
  { value: "count", label: "Most Tagged" },
  { value: "az", label: "A–Z" },
  { value: "za", label: "Z–A" },
];

let searchQuery = "";
let sortMode = "modified";

/** Opens the Manage Tags modal. */
export function openTagManager() {
  searchQuery = "";
  sortMode = "modified";
  const wrap = document.createElement("div");
  wrap.className = "tag-manager";
  openModal({ title: "Manage Tags", bodyEl: wrap });
  buildShell(wrap);
}

/**
 * Builds the parts that stay fixed across list re-renders (Add Tag row, Search+Sort toolbar) and
 * the list mount itself, then does the first list render.
 * @param {HTMLElement} wrap
 */
function buildShell(wrap) {
  wrap.textContent = "";

  const addRow = document.createElement("div");
  addRow.className = "tag-manager-add-row";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "form-control form-control-sm";
  input.placeholder = "New tag name";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-sm btn-primary";
  addBtn.textContent = "Add Tag";
  const create = () => {
    if (tags.createGlobalTag(input.value)) {
      input.value = "";
      renderList(listMount);
    }
  };
  addBtn.addEventListener("click", create);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      create();
    }
  });
  addRow.append(input, addBtn);
  wrap.appendChild(addRow);

  const toolbar = document.createElement("div");
  toolbar.className = "tag-manager-toolbar";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "form-control form-control-sm tag-manager-search";
  searchInput.placeholder = "Search tags…";
  searchInput.value = searchQuery;
  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    renderList(listMount);
  });
  toolbar.appendChild(searchInput);

  const sortSelect = document.createElement("select");
  sortSelect.className = "form-select form-select-sm tag-manager-sort";
  sortSelect.title = "Sort tags by";
  for (const opt of SORT_OPTIONS) {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    o.selected = opt.value === sortMode;
    sortSelect.appendChild(o);
  }
  sortSelect.addEventListener("change", () => {
    sortMode = sortSelect.value;
    renderList(listMount);
  });
  toolbar.appendChild(sortSelect);

  wrap.appendChild(toolbar);

  const listMount = document.createElement("div");
  listMount.className = "tag-manager-list";
  wrap.appendChild(listMount);

  renderList(listMount);
}

/**
 * Filters appState.globalTags by searchQuery (case-insensitive substring) and orders by sortMode,
 * then (re)builds every row into `listMount` — the one thing every tag-level action below calls to
 * refresh, instead of rebuilding the Add Tag row/toolbar (which would drop the search box's focus
 * and any in-progress typing).
 * @param {HTMLElement} listMount
 */
function renderList(listMount) {
  listMount.textContent = "";

  if (appState.globalTags.length === 0) {
    const empty = document.createElement("p");
    empty.className = "small text-muted";
    empty.textContent = "No tags yet — add one above.";
    listMount.appendChild(empty);
    return;
  }

  const query = searchQuery.trim().toLowerCase();
  const matching = query ? appState.globalTags.filter((t) => t.toLowerCase().includes(query)) : appState.globalTags;
  const ordered = sortTags(matching, sortMode);

  if (ordered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "small text-muted";
    empty.textContent = `No tags match "${searchQuery.trim()}".`;
    listMount.appendChild(empty);
    return;
  }

  for (const tag of ordered) {
    listMount.appendChild(buildTagRow(listMount, tag));
  }
}

/**
 * @param {string[]} tagNames
 * @param {string} mode One of SORT_OPTIONS' values.
 * @returns {string[]}
 */
function sortTags(tagNames, mode) {
  const rows = tagNames.map((tag) => ({ tag, meta: tags.getTagMeta(tag) }));
  const byName = (a, b) => a.tag.localeCompare(b.tag);
  switch (mode) {
    case "created":
      rows.sort((a, b) => (b.meta.createdAt || 0) - (a.meta.createdAt || 0) || byName(a, b));
      break;
    case "tagged":
      rows.sort((a, b) => (b.meta.lastTaggedAt || 0) - (a.meta.lastTaggedAt || 0) || byName(a, b));
      break;
    case "count":
      rows.sort((a, b) => tags.countQuestionsWithTag(b.tag) - tags.countQuestionsWithTag(a.tag) || byName(a, b));
      break;
    case "za":
      rows.sort((a, b) => byName(b, a));
      break;
    case "az":
      rows.sort(byName);
      break;
    case "modified":
    default:
      rows.sort((a, b) => (b.meta.modifiedAt || 0) - (a.meta.modifiedAt || 0) || byName(a, b));
  }
  return rows.map((r) => r.tag);
}

/**
 * @param {HTMLElement} listMount
 * @param {string} tag
 */
function buildTagRow(listMount, tag) {
  const row = document.createElement("div");
  row.className = "tag-manager-row";

  const head = document.createElement("div");
  head.className = "tag-manager-row-head";

  const name = document.createElement("span");
  name.className = "tag-manager-name";
  name.textContent = tag;
  head.appendChild(name);

  const count = tags.countQuestionsWithTag(tag);
  if (count > 0) {
    const countBadge = document.createElement("span");
    countBadge.className = "tag-manager-count-badge";
    countBadge.textContent = String(count);
    countBadge.title = `Applied to ${count} question${count === 1 ? "" : "s"}`;
    head.appendChild(countBadge);
  }

  const renameBtn = document.createElement("button");
  renameBtn.type = "button";
  renameBtn.className = "btn btn-sm btn-outline-secondary";
  renameBtn.title = "Rename tag";
  renameBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
  renameBtn.addEventListener("click", () => {
    tags.renameTagPrompt(tag);
    renderList(listMount);
  });
  head.appendChild(renameBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn-sm btn-outline-danger";
  deleteBtn.title = "Delete tag";
  deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
  deleteBtn.addEventListener("click", () => {
    tags.deleteTagPrompt(tag);
    renderList(listMount);
  });
  head.appendChild(deleteBtn);

  row.appendChild(head);
  row.appendChild(buildIconRow(listMount, tag));
  row.appendChild(buildRelatedTagsRow(listMount, tag));
  return row;
}

/**
 * Icon control — the FA icon class (e.g. "fa-solid fa-clock") shown before a question's text
 * whenever this tag is the FIRST tag on that question (see data/tagIcon.js's pickDisplayTagIcon,
 * and render/nodeViews/questionView.js's qTagIcon). No "primary" toggle — which tag's icon wins is
 * simply whichever tag was added to the question first, so there's nothing to configure here beyond
 * the icon itself.
 * @param {HTMLElement} listMount
 * @param {string} tag
 */
function buildIconRow(listMount, tag) {
  const iconRow = document.createElement("div");
  iconRow.className = "tag-manager-icon-row";

  const meta = tags.getTagMeta(tag);

  const preview = document.createElement("i");
  preview.className = `tag-manager-icon-preview ${meta.icon || "fa-solid fa-icons tag-manager-icon-preview-empty"}`;

  const iconInput = document.createElement("input");
  iconInput.type = "text";
  iconInput.className = "form-control form-control-sm tag-manager-icon-input";
  iconInput.placeholder = "fa-solid fa-clock";
  iconInput.value = meta.icon || "";
  iconInput.title = "Custom icon class (e.g. fa-solid fa-clock), shown before this tag's questions";

  const saveIcon = () => {
    tags.setTagIcon(tag, iconInput.value);
    renderList(listMount);
  };
  iconInput.addEventListener("click", (e) => e.stopPropagation());
  iconInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveIcon();
    }
  });

  const saveIconBtn = document.createElement("button");
  saveIconBtn.type = "button";
  saveIconBtn.className = "btn btn-sm btn-outline-secondary";
  saveIconBtn.title = "Save icon";
  saveIconBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
  saveIconBtn.addEventListener("click", saveIcon);

  iconRow.append(preview, iconInput, saveIconBtn);
  return iconRow;
}

/**
 * @param {HTMLElement} listMount
 * @param {string} tag
 */
function buildRelatedTagsRow(listMount, tag) {
  const relatedWrap = document.createElement("div");
  relatedWrap.className = "tag-manager-related";

  const relatedLabel = document.createElement("span");
  relatedLabel.className = "small text-muted tag-manager-related-label";
  relatedLabel.textContent = "Related tags (auto-applied together):";
  relatedWrap.appendChild(relatedLabel);

  const mount = document.createElement("div");
  mount.className = "tag-manager-related-select";
  relatedWrap.appendChild(mount);

  const related = tags.getRelatedTags(tag);
  const ms = createMultiSelect(mount, {
    placeholder: "+ Add related tag…",
    onChange: (selected) => {
      const nextSet = new Set(selected);
      const before = tags.getRelatedTags(tag);
      for (const relTag of nextSet) {
        if (!before.includes(relTag)) {
          tags.addRelatedTag(tag, relTag);
          showToast(`"${relTag}" will now auto-apply whenever "${tag}" is added.`, "success");
        }
      }
      for (const relTag of before) {
        if (!nextSet.has(relTag)) tags.removeRelatedTag(tag, relTag);
      }
      renderList(listMount);
    },
  });
  ms.setOptions(appState.globalTags.filter((t) => t !== tag));
  ms.setSelected(related);

  return relatedWrap;
}
