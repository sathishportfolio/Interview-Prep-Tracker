// @ts-check
/**
 * render/nodeViews/topicView.js — create/patch for a Topic node: header + its SubTopic list.
 * @typedef {import('../../types.js').TopicGroup} TopicGroup
 */
import { createAccordionShell } from "../accordion.js";
import { reconcileKeyedList } from "../keyedList.js";
import { createSubTopicNode, patchSubTopicNode } from "./subTopicView.js";
import { appState } from "../../state/appState.js";

/**
 * @param {TopicGroup} t
 * @param {Record<string, any>} handlers
 * @returns {HTMLElement}
 */
export function createTopicNode(t, handlers) {
  const key = `${t.subject}::T::${t.topic}`;
  const { item, header, headerControls, body } = createAccordionShell(key, "level-topic");
  item.dataset.subject = t.subject;
  item.dataset.topic = t.topic;

  const dragHandle = document.createElement("i");
  dragHandle.className = "fa-solid fa-grip-vertical drag-handle";
  header.insertBefore(dragHandle, header.firstChild);

  const selectBox = document.createElement("input");
  selectBox.type = "checkbox";
  selectBox.className = "group-select-checkbox";
  selectBox.addEventListener("click", (e) => e.stopPropagation());
  selectBox.addEventListener("change", (e) => {
    e.stopPropagation();
    handlers.onToggleGroupSelect("topic", { subject: t.subject, topic: t.topic });
  });
  header.insertBefore(selectBox, header.children[1]);

  headerControls.appendChild(iconBtn("fa-copy", "Copy", (e) => {
    e.stopPropagation();
    handlers.onOpenCopyMenu("topic", { subject: t.subject, topic: t.topic }, e.currentTarget);
  }));
  headerControls.appendChild(iconBtn("fa-plus", "Quick Add SubTopic", (e) => {
    e.stopPropagation();
    handlers.onQuickAddSubTopic(t.subject, t.topic);
  }));
  headerControls.appendChild(iconBtn("fa-pen", "Rename", (e) => {
    e.stopPropagation();
    handlers.onRenameGroup("topic", { subject: t.subject, topic: t.topic });
  }, true));
  headerControls.appendChild(iconBtn("fa-trash icon-duplicate", "Delete", (e) => {
    e.stopPropagation();
    handlers.onDeleteGroup("topic", { subject: t.subject, topic: t.topic });
  }, true));
  headerControls.appendChild(iconBtn("fa-square-check", "Select mode", (e) => {
    e.stopPropagation();
    handlers.onToggleTopicSelectMode(t.subject);
  }, true));

  const bulkAddMount = document.createElement("div");
  bulkAddMount.className = "bulk-add-mount edit-gated";
  const subTopicList = document.createElement("div");
  subTopicList.className = "subtopic-list";
  body.appendChild(bulkAddMount);
  body.appendChild(subTopicList);

  patchTopicNode(item, t, handlers);
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

/** @param {TopicGroup} t @returns {number} */
function countQuestions(t) {
  let n = 0;
  for (const st of t.subTopics) n += st.questions.length;
  return n;
}

/**
 * @param {HTMLElement} el
 * @param {TopicGroup} t
 * @param {Record<string, any>} handlers
 */
export function patchTopicNode(el, t, handlers) {
  const titleEl = el.querySelector(".acc-title");
  if (titleEl) titleEl.textContent = `${t.topic}${t.isEmpty ? " (empty)" : ` (${countQuestions(t)})`}`;

  const header = el.querySelector(":scope > .acc-header");
  const body = el.querySelector(":scope > .acc-body");
  const key = `${t.subject}::T::${t.topic}`;
  if (header && body) {
    header.classList.toggle("expanded", appState.openNodeKeys.has(key));
    body.classList.toggle("open", appState.openNodeKeys.has(key));
  }

  const bulkAddMount = el.querySelector(".bulk-add-mount");
  if (bulkAddMount && handlers.onMountGroupPanels) {
    handlers.onMountGroupPanels("topic", { subject: t.subject, topic: t.topic }, bulkAddMount);
  }

  const list = el.querySelector(".subtopic-list");
  if (list) {
    reconcileKeyedList(
      /** @type {HTMLElement} */ (list),
      t.subTopics,
      (st) => `${st.subject}::${st.topic}::ST::${st.subTopic}`,
      (st) => createSubTopicNode(st, handlers),
      (stEl, st) => patchSubTopicNode(stEl, st, handlers)
    );
  }
}
