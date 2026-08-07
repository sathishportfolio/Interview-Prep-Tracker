// @ts-check
/**
 * render/nodeViews/subjectView.js — create/patch for a Subject node: header + its Topic list.
 * @typedef {import('../../types.js').SubjectGroup} SubjectGroup
 */
import { createAccordionShell } from "../accordion.js";
import { reconcileKeyedList } from "../keyedList.js";
import { createTopicNode, patchTopicNode } from "./topicView.js";
import { appState } from "../../state/appState.js";

/**
 * @param {SubjectGroup} s
 * @param {Record<string, any>} handlers
 * @returns {HTMLElement}
 */
export function createSubjectNode(s, handlers) {
  const key = `S::${s.subject}`;
  const { item, header, headerControls, body } = createAccordionShell(key, "level-subject");
  item.dataset.subject = s.subject;

  const dragHandle = document.createElement("i");
  dragHandle.className = "fa-solid fa-grip-vertical drag-handle";
  header.insertBefore(dragHandle, header.firstChild);

  const selectBox = document.createElement("input");
  selectBox.type = "checkbox";
  selectBox.className = "group-select-checkbox";
  selectBox.addEventListener("click", (e) => e.stopPropagation());
  selectBox.addEventListener("change", (e) => {
    e.stopPropagation();
    handlers.onToggleGroupSelect("subject", { subject: s.subject });
  });
  header.insertBefore(selectBox, header.children[1]);

  headerControls.appendChild(iconBtn("fa-copy", "Copy", (e) => {
    e.stopPropagation();
    handlers.onOpenCopyMenu("subject", { subject: s.subject }, e.currentTarget);
  }));
  headerControls.appendChild(iconBtn("fa-plus", "Quick Add Topic", (e) => {
    e.stopPropagation();
    handlers.onQuickAddTopic(s.subject);
  }));
  headerControls.appendChild(iconBtn("fa-pen", "Rename", (e) => {
    e.stopPropagation();
    handlers.onRenameGroup("subject", { subject: s.subject });
  }, true));
  headerControls.appendChild(iconBtn("fa-trash icon-duplicate", "Delete", (e) => {
    e.stopPropagation();
    handlers.onDeleteGroup("subject", { subject: s.subject });
  }, true));
  headerControls.appendChild(iconBtn("fa-square-check", "Select mode", (e) => {
    e.stopPropagation();
    handlers.onToggleSubjectSelectMode();
  }, true));

  const bulkAddMount = document.createElement("div");
  bulkAddMount.className = "bulk-add-mount edit-gated";
  const topicList = document.createElement("div");
  topicList.className = "topic-list";
  body.appendChild(bulkAddMount);
  body.appendChild(topicList);

  patchSubjectNode(item, s, handlers);
  return item;
}

function iconBtn(iconClass, title, onClick, gated = false) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `btn btn-sm btn-light${gated ? " edit-gated" : ""}`;
  btn.title = title;
  btn.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
  btn.addEventListener("click", onClick);
  return btn;
}

/** @param {SubjectGroup} s @returns {number} */
function countQuestions(s) {
  let n = 0;
  for (const t of s.topics) for (const st of t.subTopics) n += st.questions.length;
  return n;
}

/**
 * @param {HTMLElement} el
 * @param {SubjectGroup} s
 * @param {Record<string, any>} handlers
 */
export function patchSubjectNode(el, s, handlers) {
  const titleEl = el.querySelector(".acc-title");
  if (titleEl) titleEl.textContent = `${s.subject}${s.isEmpty ? " (empty)" : ` (${countQuestions(s)})`}`;

  const header = el.querySelector(":scope > .acc-header");
  const body = el.querySelector(":scope > .acc-body");
  const key = `S::${s.subject}`;
  if (header && body) {
    header.classList.toggle("expanded", appState.openNodeKeys.has(key));
    body.classList.toggle("open", appState.openNodeKeys.has(key));
  }

  const bulkAddMount = el.querySelector(".bulk-add-mount");
  if (bulkAddMount && handlers.onMountGroupPanels) {
    handlers.onMountGroupPanels("subject", { subject: s.subject }, bulkAddMount);
  }

  const list = el.querySelector(".topic-list");
  if (list) {
    reconcileKeyedList(
      /** @type {HTMLElement} */ (list),
      s.topics,
      (t) => `${t.subject}::T::${t.topic}`,
      (t) => createTopicNode(t, handlers),
      (tEl, t) => patchTopicNode(tEl, t, handlers)
    );
  }
}
