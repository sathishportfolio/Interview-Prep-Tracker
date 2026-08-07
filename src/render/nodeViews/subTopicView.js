// @ts-check
/**
 * render/nodeViews/subTopicView.js — create/patch for a SubTopic node: its own accordion header
 * (with copy menu / rename / delete / select-mode controls) plus its Question list, reconciled via
 * keyedList. Render-only; all actions call into the `handlers` object.
 * @typedef {import('../../types.js').SubTopicGroup} SubTopicGroup
 * @typedef {import('./questionView.js').TreeHandlers} TreeHandlers
 */
import { createAccordionShell } from "../accordion.js";
import { reconcileKeyedList } from "../keyedList.js";
import { createQuestionNode, patchQuestionNode } from "./questionView.js";
import { appState } from "../../state/appState.js";

/**
 * @param {SubTopicGroup} st
 * @param {Record<string, any>} handlers
 * @returns {HTMLElement}
 */
export function createSubTopicNode(st, handlers) {
  const key = `${st.subject}::${st.topic}::ST::${st.subTopic}`;
  const { item, header, headerControls, body, titleEl } = createAccordionShell(key, "level-subtopic");
  item.dataset.subject = st.subject;
  item.dataset.topic = st.topic;
  item.dataset.subTopic = st.subTopic;

  const dragHandle = document.createElement("i");
  dragHandle.className = "fa-solid fa-grip-vertical drag-handle";
  header.insertBefore(dragHandle, header.firstChild);

  const selectBox = document.createElement("input");
  selectBox.type = "checkbox";
  selectBox.className = "group-select-checkbox";
  selectBox.addEventListener("click", (e) => e.stopPropagation());
  selectBox.addEventListener("change", (e) => {
    e.stopPropagation();
    handlers.onToggleGroupSelect("subTopic", { subject: st.subject, topic: st.topic, subTopic: st.subTopic });
  });
  header.insertBefore(selectBox, header.children[1]);

  headerControls.appendChild(
    iconBtn("fa-copy", "Copy", (e) => {
      e.stopPropagation();
      handlers.onOpenCopyMenu("subTopic", { subject: st.subject, topic: st.topic, subTopic: st.subTopic }, e.currentTarget);
    })
  );
  headerControls.appendChild(
    iconBtn("fa-pen", "Rename", (e) => {
      e.stopPropagation();
      handlers.onRenameGroup("subTopic", { subject: st.subject, topic: st.topic, subTopic: st.subTopic });
    }, true)
  );
  headerControls.appendChild(
    iconBtn("fa-trash icon-duplicate", "Delete", (e) => {
      e.stopPropagation();
      handlers.onDeleteGroup("subTopic", { subject: st.subject, topic: st.topic, subTopic: st.subTopic });
    }, true)
  );
  headerControls.appendChild(
    iconBtn("fa-square-check", "Select mode", (e) => {
      e.stopPropagation();
      handlers.onToggleQuestionSelectMode(st.subject, st.topic, st.subTopic);
    }, true)
  );

  const bulkAddMount = document.createElement("div");
  bulkAddMount.className = "bulk-add-mount edit-gated";
  const selectBar = document.createElement("div");
  selectBar.className = "select-count-bar-mount";
  const questionList = document.createElement("div");
  questionList.className = "question-list";

  body.appendChild(selectBar);
  body.appendChild(bulkAddMount);
  body.appendChild(questionList);

  patchSubTopicNode(item, st, handlers);
  return item;
}

/**
 * @param {string} iconClass
 * @param {string} title
 * @param {(e: any) => void} onClick
 */
function iconBtn(iconClass, title, onClick, gated = false) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `btn btn-sm btn-light${gated ? " edit-gated" : ""}`;
  btn.title = title;
  btn.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
  btn.addEventListener("click", onClick);
  return btn;
}

/**
 * @param {HTMLElement} el
 * @param {SubTopicGroup} st
 * @param {Record<string, any>} handlers
 */
export function patchSubTopicNode(el, st, handlers) {
  const titleEl = el.querySelector(".acc-title");
  if (titleEl) titleEl.textContent = `${st.subTopic}${st.isEmpty ? " (empty)" : ""} (${st.questions.length})`;

  const header = el.querySelector(":scope > .acc-header");
  const body = el.querySelector(":scope > .acc-body");
  const key = `${st.subject}::${st.topic}::ST::${st.subTopic}`;
  if (header && body) {
    header.classList.toggle("expanded", appState.openNodeKeys.has(key));
    body.classList.toggle("open", appState.openNodeKeys.has(key));
  }

  const bulkAddMount = el.querySelector(".bulk-add-mount");
  if (bulkAddMount && handlers.onMountGroupPanels) {
    handlers.onMountGroupPanels("subTopic", { subject: st.subject, topic: st.topic, subTopic: st.subTopic }, bulkAddMount);
  }
  // Move Selected is mounted into the same row as the Bulk Add/Update/Copy buttons (rather than
  // its own separate mount) so all of a SubTopic's action buttons stay on one line; guarded by its
  // own class rather than bulkAddMount's childElementCount since that's already non-empty above.
  if (bulkAddMount && !bulkAddMount.querySelector(".move-selected-btn") && handlers.onMountMoveSelectedButton) {
    handlers.onMountMoveSelectedButton(/** @type {HTMLElement} */ (bulkAddMount));
  }

  const list = el.querySelector(".question-list");
  if (list) {
    reconcileKeyedList(
      /** @type {HTMLElement} */ (list),
      st.questions,
      (q) => `Q::${q.id}`,
      (q) => createQuestionNode(q, handlers),
      (qEl, q) => patchQuestionNode(qEl, q, handlers)
    );
  }
}
