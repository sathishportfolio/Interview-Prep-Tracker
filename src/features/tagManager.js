// @ts-check
/**
 * features/tagManager.js — "Manage Tags" popup (replaces the old addGlobalTagBtn's single-tag
 * `prompt()`): full CRUD over the global tag registry (appState.globalTags) plus each tag's
 * "related tags" (appState.globalTagRelations) — tags that get auto-applied alongside it whenever
 * this tag is assigned to a question (see data/mutations.js's toggleQuestionTag). Thin: all actual
 * state changes go through features/tags.js; this module is presentation only, re-rendering its
 * modal body in place after every action (same pattern as sync/syncConfig.js's buildConfiguredView).
 */
import { appState } from "../state/appState.js";
import { openModal } from "./modal.js";
import { showToast } from "./toast.js";
import * as tags from "./tags.js";

/** Opens the Manage Tags modal. */
export function openTagManager() {
  const wrap = document.createElement("div");
  wrap.className = "tag-manager";
  openModal({ title: "Manage Tags", bodyEl: wrap });
  renderInto(wrap);
}

/** @param {HTMLElement} wrap */
function renderInto(wrap) {
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
      renderInto(wrap);
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

  const list = document.createElement("div");
  list.className = "tag-manager-list";
  if (appState.globalTags.length === 0) {
    const empty = document.createElement("p");
    empty.className = "small text-muted";
    empty.textContent = "No tags yet — add one above.";
    list.appendChild(empty);
  }
  for (const tag of appState.globalTags) {
    list.appendChild(buildTagRow(wrap, tag));
  }
  wrap.appendChild(list);
}

/**
 * @param {HTMLElement} wrap
 * @param {string} tag
 */
function buildTagRow(wrap, tag) {
  const row = document.createElement("div");
  row.className = "tag-manager-row";

  const head = document.createElement("div");
  head.className = "tag-manager-row-head";

  const name = document.createElement("span");
  name.className = "tag-manager-name";
  name.textContent = tag;
  head.appendChild(name);

  const renameBtn = document.createElement("button");
  renameBtn.type = "button";
  renameBtn.className = "btn btn-sm btn-outline-secondary";
  renameBtn.title = "Rename tag";
  renameBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
  renameBtn.addEventListener("click", () => {
    tags.renameTagPrompt(tag);
    renderInto(wrap);
  });
  head.appendChild(renameBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn-sm btn-outline-danger";
  deleteBtn.title = "Delete tag";
  deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
  deleteBtn.addEventListener("click", () => {
    tags.deleteTagPrompt(tag);
    renderInto(wrap);
  });
  head.appendChild(deleteBtn);

  row.appendChild(head);
  row.appendChild(buildRelatedTagsRow(wrap, tag));
  return row;
}

/**
 * @param {HTMLElement} wrap
 * @param {string} tag
 */
function buildRelatedTagsRow(wrap, tag) {
  const relatedWrap = document.createElement("div");
  relatedWrap.className = "tag-manager-related";

  const relatedLabel = document.createElement("span");
  relatedLabel.className = "small text-muted tag-manager-related-label";
  relatedLabel.textContent = "Related tags (auto-applied together):";
  relatedWrap.appendChild(relatedLabel);

  const related = tags.getRelatedTags(tag);
  if (related.length === 0) {
    const none = document.createElement("span");
    none.className = "small text-muted";
    none.textContent = "None";
    relatedWrap.appendChild(none);
  }
  for (const relTag of related) {
    const chip = document.createElement("span");
    chip.className = "multiselect-tag tag-manager-related-chip";
    const label = document.createElement("span");
    label.textContent = relTag;
    const rm = document.createElement("span");
    rm.className = "rm";
    rm.textContent = "×";
    rm.title = `Remove "${relTag}" from ${tag}'s related tags`;
    rm.addEventListener("click", () => {
      tags.removeRelatedTag(tag, relTag);
      renderInto(wrap);
    });
    chip.append(label, rm);
    relatedWrap.appendChild(chip);
  }

  const remainingOptions = appState.globalTags.filter((t) => t !== tag && !related.includes(t));
  if (remainingOptions.length > 0) {
    const select = document.createElement("select");
    select.className = "form-select form-select-sm tag-manager-related-select";
    select.title = `Map a related tag onto "${tag}"`;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "+ Add related tag…";
    select.appendChild(placeholder);
    for (const opt of remainingOptions) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    }
    select.addEventListener("change", () => {
      if (!select.value) return;
      tags.addRelatedTag(tag, select.value);
      showToast(`"${select.value}" will now auto-apply whenever "${tag}" is added.`, "success");
      renderInto(wrap);
    });
    relatedWrap.appendChild(select);
  }

  return relatedWrap;
}
