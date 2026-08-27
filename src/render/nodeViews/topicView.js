// @ts-check
/**
 * render/nodeViews/topicView.js — create/patch for a Topic node: header + its SubTopic list.
 * @typedef {import('../../types.js').TopicGroup} TopicGroup
 */
import { createAccordionShell } from "../accordion.js";
import { reconcileKeyedList } from "../keyedList.js";
import { createSubTopicNode, patchSubTopicNode } from "./subTopicView.js";
import { appState } from "../../state/appState.js";
import { groupKey } from "../../data/selectionKeys.js";
import { isReorderTarget } from "../reorderEligibility.js";
import { createStatusSummary, patchStatusSummary } from "../statusSummary.js";
import { createGroupLinksControl, patchGroupLinksControl, createGroupLinksDisplayRow, patchGroupLinksDisplayRow } from "./groupLinksPanel.js";
import { getGroupLinks } from "../../data/groupLinks.js";
import { createGroupCompleteButton, patchGroupCompleteButton } from "../groupCompleteButton.js";

/**
 * @param {TopicGroup} t
 * @param {Record<string, any>} handlers
 * @returns {HTMLElement}
 */
export function createTopicNode(t, handlers) {
  const key = `${t.subject}::T::${t.topic}`;
  const { item, header, headerControls, body } = createAccordionShell(key, "level-topic", () =>
    handlers.onGroupAutoExpand("topic", { subject: t.subject, topic: t.topic })
  );
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

  const completeBtn = createGroupCompleteButton();
  header.insertBefore(completeBtn, header.children[2]);

  const reorderBadge = document.createElement("span");
  reorderBadge.className = "reorder-badge";
  header.insertBefore(reorderBadge, header.children[3]);

  header.addEventListener(
    "click",
    (e) => {
      if (!isReorderTarget("topic", { subject: t.subject })) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      handlers.onReorderSelect("topic", { subject: t.subject, topic: t.topic });
    },
    true
  );

  headerControls.appendChild(iconBtn("fa-ban", "Not Important", (e) => {
    e.stopPropagation();
    handlers.onToggleGroupNotImportant("topic", { subject: t.subject, topic: t.topic });
  }, true));
  headerControls.appendChild(iconBtn("fa-copy", "Copy", (e) => {
    e.stopPropagation();
    handlers.onOpenCopyMenu("topic", { subject: t.subject, topic: t.topic }, e.currentTarget);
  }));
  headerControls.appendChild(iconBtn("fa-filter", "Filter by this Topic", (e) => {
    e.stopPropagation();
    handlers.onFilterByGroup("topic", { subject: t.subject, topic: t.topic });
  }));
  headerControls.appendChild(iconBtn("fa-plus", "Quick Add SubTopic", (e) => {
    e.stopPropagation();
    handlers.onQuickAddSubTopic(t.subject, t.topic);
  }, true));
  headerControls.appendChild(iconBtn("fa-pen", "Rename", (e) => {
    e.stopPropagation();
    handlers.onRenameGroup("topic", { subject: t.subject, topic: t.topic });
  }, true));
  headerControls.appendChild(iconBtn("fa-trash icon-duplicate", "Delete", (e) => {
    e.stopPropagation();
    handlers.onDeleteGroup("topic", { subject: t.subject, topic: t.topic });
  }, true));
  headerControls.appendChild(iconBtn("fa-square-check", "Select SubTopics", (e) => {
    e.stopPropagation();
    handlers.onToggleChildSelectMode("topic", { subject: t.subject, topic: t.topic });
  }, true));
  headerControls.appendChild(createGroupLinksControl("topic", { subject: t.subject, topic: t.topic }, handlers));

  const bulkAddMount = document.createElement("div");
  bulkAddMount.className = "bulk-add-mount edit-gated";
  const subTopicList = document.createElement("div");
  subTopicList.className = "subtopic-list";
  const groupLinksRow = createGroupLinksDisplayRow();
  const statusSummary = createStatusSummary();
  body.appendChild(bulkAddMount);
  body.appendChild(subTopicList);
  body.appendChild(groupLinksRow);
  body.appendChild(statusSummary);

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

/** @param {TopicGroup} t @returns {{total: number, notImportant: number}} */
function countQuestions(t) {
  let total = 0;
  let notImportant = 0;
  for (const st of t.subTopics) {
    total += st.questions.length;
    notImportant += st.questions.filter((q) => q.notImportant).length;
  }
  return { total, notImportant };
}

/** @param {TopicGroup} t @returns {import('../../types.js').Question[]} every question under this Topic */
function collectQuestions(t) {
  return t.subTopics.flatMap((st) => st.questions);
}

/**
 * @param {HTMLElement} el
 * @param {TopicGroup} t
 * @param {Record<string, any>} handlers
 */
export function patchTopicNode(el, t, handlers) {
  const titleEl = el.querySelector(".acc-title");
  if (titleEl) {
    const { total, notImportant } = countQuestions(t);
    titleEl.textContent = `${t.topic}${t.isEmpty ? " (empty)" : ` (${total - notImportant}/${total})`}`;
  }

  const header = el.querySelector(":scope > .acc-header");
  const body = el.querySelector(":scope > .acc-body");
  const key = `${t.subject}::T::${t.topic}`;
  if (header && body) {
    header.classList.toggle("expanded", appState.openNodeKeys.has(key));
    body.classList.toggle("open", appState.openNodeKeys.has(key));
  }
  el.classList.toggle("child-select-on", appState.childSelectModeKeys.has(groupKey("topic", { subject: t.subject, topic: t.topic })));
  el.classList.toggle("not-important", !!t.notImportant);

  patchGroupCompleteButton(el.querySelector(":scope > .acc-header > .group-complete-indicator"), t.completePercent, t.doneCount, t.totalCount, t.ignoredCount);

  const scope = { subject: t.subject, topic: t.topic };
  const groupLinks = getGroupLinks(appState.groupLinks, scope.subject, scope.topic, null);
  const linksControl = el.querySelector(":scope > .acc-header > .acc-header-controls > .links-dropdown-wrap");
  if (linksControl) patchGroupLinksControl(/** @type {HTMLElement} */ (linksControl), "topic", scope, groupLinks, handlers);
  const groupLinksRow = /** @type {HTMLElement|null} */ (el.querySelector(":scope > .acc-body > .group-links-row"));
  if (groupLinksRow) patchGroupLinksDisplayRow(groupLinksRow, groupLinks);

  const selectBox = /** @type {HTMLInputElement|null} */ (el.querySelector(":scope > .acc-header > .group-select-checkbox"));
  if (selectBox) selectBox.checked = appState.selectedGroupKeys.has(groupKey("topic", { subject: t.subject, topic: t.topic }));

  const reorderEligible = isReorderTarget("topic", { subject: t.subject });
  const reorderBadge = el.querySelector(":scope > .acc-header > .reorder-badge");
  if (reorderBadge) {
    const idx = reorderEligible ? appState.reorderMode?.selections.indexOf(t.topic) ?? -1 : -1;
    reorderBadge.textContent = idx >= 0 ? String(idx + 1) : "";
    reorderBadge.classList.toggle("reorder-eligible", reorderEligible);
    reorderBadge.classList.toggle("reorder-picked", idx >= 0);
  }
  if (header) header.classList.toggle("reorder-mode-target", reorderEligible);

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

  const statusSummary = /** @type {HTMLElement|null} */ (el.querySelector(":scope > .acc-body > .status-summary-row"));
  if (statusSummary) patchStatusSummary(statusSummary, collectQuestions(t));
}
