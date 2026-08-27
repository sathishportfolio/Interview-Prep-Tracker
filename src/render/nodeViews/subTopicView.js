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
import { groupKey } from "../../data/selectionKeys.js";
import { isReorderTarget } from "../reorderEligibility.js";
import { createStatusSummary, patchStatusSummary } from "../statusSummary.js";
import { createGroupLinksControl, patchGroupLinksControl, createGroupLinksDisplayRow, patchGroupLinksDisplayRow } from "./groupLinksPanel.js";
import { getGroupLinks } from "../../data/groupLinks.js";
import { createGroupCompleteButton, patchGroupCompleteButton } from "../groupCompleteButton.js";

/**
 * @param {SubTopicGroup} st
 * @param {Record<string, any>} handlers
 * @returns {HTMLElement}
 */
export function createSubTopicNode(st, handlers) {
  const key = `${st.subject}::${st.topic}::ST::${st.subTopic}`;
  const { item, header, headerControls, body, titleEl } = createAccordionShell(key, "level-subtopic", () =>
    handlers.onGroupAutoExpand("subTopic", { subject: st.subject, topic: st.topic, subTopic: st.subTopic })
  );
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

  const completeBtn = createGroupCompleteButton();
  header.insertBefore(completeBtn, header.children[2]);

  const reorderBadge = document.createElement("span");
  reorderBadge.className = "reorder-badge";
  header.insertBefore(reorderBadge, header.children[3]);

  header.addEventListener(
    "click",
    (e) => {
      if (!isReorderTarget("subTopic", { subject: st.subject, topic: st.topic })) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      handlers.onReorderSelect("subTopic", { subject: st.subject, topic: st.topic, subTopic: st.subTopic });
    },
    true
  );

  headerControls.appendChild(
    iconBtn("fa-ban", "Not Important", (e) => {
      e.stopPropagation();
      handlers.onToggleGroupNotImportant("subTopic", { subject: st.subject, topic: st.topic, subTopic: st.subTopic });
    }, true)
  );
  headerControls.appendChild(
    iconBtn("fa-copy", "Copy", (e) => {
      e.stopPropagation();
      handlers.onOpenCopyMenu("subTopic", { subject: st.subject, topic: st.topic, subTopic: st.subTopic }, e.currentTarget);
    })
  );
  headerControls.appendChild(
    iconBtn("fa-filter", "Filter by this SubTopic", (e) => {
      e.stopPropagation();
      handlers.onFilterByGroup("subTopic", { subject: st.subject, topic: st.topic, subTopic: st.subTopic });
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
    iconBtn("fa-square-check", "Select Questions", (e) => {
      e.stopPropagation();
      handlers.onToggleChildSelectMode("subTopic", { subject: st.subject, topic: st.topic, subTopic: st.subTopic });
    }, true)
  );
  headerControls.appendChild(createGroupLinksControl("subTopic", { subject: st.subject, topic: st.topic, subTopic: st.subTopic }, handlers));

  const bulkAddMount = document.createElement("div");
  bulkAddMount.className = "bulk-add-mount edit-gated";
  const selectBar = document.createElement("div");
  selectBar.className = "select-count-bar-mount";
  const questionList = document.createElement("div");
  questionList.className = "question-list";
  const groupLinksRow = createGroupLinksDisplayRow();
  const statusSummary = createStatusSummary();

  body.appendChild(selectBar);
  body.appendChild(bulkAddMount);
  body.appendChild(questionList);
  body.appendChild(groupLinksRow);
  body.appendChild(statusSummary);

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
  if (titleEl) {
    const total = st.questions.length;
    const notImportant = st.questions.filter((q) => q.notImportant).length;
    titleEl.textContent = `${st.subTopic}${st.isEmpty ? " (empty)" : ""} (${total - notImportant}/${total})`;
  }

  const header = el.querySelector(":scope > .acc-header");
  const body = el.querySelector(":scope > .acc-body");
  const key = `${st.subject}::${st.topic}::ST::${st.subTopic}`;
  if (header && body) {
    header.classList.toggle("expanded", appState.openNodeKeys.has(key));
    body.classList.toggle("open", appState.openNodeKeys.has(key));
  }
  el.classList.toggle(
    "child-select-on",
    appState.childSelectModeKeys.has(groupKey("subTopic", { subject: st.subject, topic: st.topic, subTopic: st.subTopic }))
  );

  el.classList.toggle("not-important", !!st.notImportant);

  patchGroupCompleteButton(el.querySelector(":scope > .acc-header > .group-complete-indicator"), st.completePercent, st.doneCount, st.totalCount, st.ignoredCount);

  const scope = { subject: st.subject, topic: st.topic, subTopic: st.subTopic };
  const groupLinks = getGroupLinks(appState.groupLinks, scope.subject, scope.topic, scope.subTopic);
  const linksControl = el.querySelector(":scope > .acc-header > .acc-header-controls > .links-dropdown-wrap");
  if (linksControl) patchGroupLinksControl(/** @type {HTMLElement} */ (linksControl), "subTopic", scope, groupLinks, handlers);
  const groupLinksRow = /** @type {HTMLElement|null} */ (el.querySelector(":scope > .acc-body > .group-links-row"));
  if (groupLinksRow) patchGroupLinksDisplayRow(groupLinksRow, groupLinks);

  const selectBox = /** @type {HTMLInputElement|null} */ (el.querySelector(":scope > .acc-header > .group-select-checkbox"));
  if (selectBox) selectBox.checked = appState.selectedGroupKeys.has(groupKey("subTopic", { subject: st.subject, topic: st.topic, subTopic: st.subTopic }));

  const reorderEligible = isReorderTarget("subTopic", { subject: st.subject, topic: st.topic });
  const reorderBadge = el.querySelector(":scope > .acc-header > .reorder-badge");
  if (reorderBadge) {
    const idx = reorderEligible ? appState.reorderMode?.selections.indexOf(st.subTopic) ?? -1 : -1;
    reorderBadge.textContent = idx >= 0 ? String(idx + 1) : "";
    reorderBadge.classList.toggle("reorder-eligible", reorderEligible);
    reorderBadge.classList.toggle("reorder-picked", idx >= 0);
  }
  if (header) header.classList.toggle("reorder-mode-target", reorderEligible);

  const bulkAddMount = el.querySelector(".bulk-add-mount");
  if (bulkAddMount && handlers.onMountGroupPanels) {
    handlers.onMountGroupPanels("subTopic", { subject: st.subject, topic: st.topic, subTopic: st.subTopic }, bulkAddMount);
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

  const statusSummary = /** @type {HTMLElement|null} */ (el.querySelector(":scope > .acc-body > .status-summary-row"));
  if (statusSummary) patchStatusSummary(statusSummary, st.questions);
}
