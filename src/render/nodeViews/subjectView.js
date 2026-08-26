// @ts-check
/**
 * render/nodeViews/subjectView.js — create/patch for a Subject node: header + its Topic list.
 * @typedef {import('../../types.js').SubjectGroup} SubjectGroup
 */
import { createAccordionShell } from "../accordion.js";
import { reconcileKeyedList } from "../keyedList.js";
import { createTopicNode, patchTopicNode } from "./topicView.js";
import { appState } from "../../state/appState.js";
import { groupKey } from "../../data/selectionKeys.js";
import { isReorderTarget } from "../reorderEligibility.js";
import { createStatusSummary, patchStatusSummary } from "../statusSummary.js";
import { createGroupLinksControl, patchGroupLinksControl, createGroupLinksDisplayRow, patchGroupLinksDisplayRow } from "./groupLinksPanel.js";
import { getGroupLinks } from "../../data/groupLinks.js";
import { createGroupCompleteButton, patchGroupCompleteButton } from "../groupCompleteButton.js";

/**
 * @param {SubjectGroup} s
 * @param {Record<string, any>} handlers
 * @returns {HTMLElement}
 */
export function createSubjectNode(s, handlers) {
  const key = `S::${s.subject}`;
  const { item, header, headerControls, body } = createAccordionShell(key, "level-subject", () =>
    handlers.onGroupAutoExpand("subject", { subject: s.subject })
  );
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

  const completeBtn = createGroupCompleteButton();
  header.insertBefore(completeBtn, header.children[2]);

  const reorderBadge = document.createElement("span");
  reorderBadge.className = "reorder-badge";
  header.insertBefore(reorderBadge, header.children[3]);

  // Reorder-mode click interception — capture phase, fires before the normal expand/collapse
  // listener bindHeader already wired inside createAccordionShell. See features/reorderMode.js.
  header.addEventListener(
    "click",
    (e) => {
      if (!isReorderTarget("subject", { subject: s.subject })) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      handlers.onReorderSelect("subject", { subject: s.subject });
    },
    true
  );

  headerControls.appendChild(iconBtn("fa-ban", "Not Important", (e) => {
    e.stopPropagation();
    handlers.onToggleGroupNotImportant("subject", { subject: s.subject });
  }, true));
  headerControls.appendChild(iconBtn("fa-copy", "Copy", (e) => {
    e.stopPropagation();
    handlers.onOpenCopyMenu("subject", { subject: s.subject }, e.currentTarget);
  }));
  headerControls.appendChild(iconBtn("fa-plus", "Quick Add Topic", (e) => {
    e.stopPropagation();
    handlers.onQuickAddTopic(s.subject);
  }, true));
  headerControls.appendChild(iconBtn("fa-pen", "Rename", (e) => {
    e.stopPropagation();
    handlers.onRenameGroup("subject", { subject: s.subject });
  }, true));
  headerControls.appendChild(iconBtn("fa-trash icon-duplicate", "Delete", (e) => {
    e.stopPropagation();
    handlers.onDeleteGroup("subject", { subject: s.subject });
  }, true));
  headerControls.appendChild(iconBtn("fa-square-check", "Select Topics", (e) => {
    e.stopPropagation();
    handlers.onToggleChildSelectMode("subject", { subject: s.subject });
  }, true));
  headerControls.appendChild(createGroupLinksControl("subject", { subject: s.subject }, handlers));

  const bulkAddMount = document.createElement("div");
  bulkAddMount.className = "bulk-add-mount edit-gated";
  const topicList = document.createElement("div");
  topicList.className = "topic-list";
  const groupLinksRow = createGroupLinksDisplayRow();
  const statusSummary = createStatusSummary();
  body.appendChild(bulkAddMount);
  body.appendChild(topicList);
  body.appendChild(groupLinksRow);
  body.appendChild(statusSummary);

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

/** @param {SubjectGroup} s @returns {{total: number, notImportant: number}} */
function countQuestions(s) {
  let total = 0;
  let notImportant = 0;
  for (const t of s.topics) {
    for (const st of t.subTopics) {
      total += st.questions.length;
      notImportant += st.questions.filter((q) => q.notImportant).length;
    }
  }
  return { total, notImportant };
}

/** @param {SubjectGroup} s @returns {import('../../types.js').Question[]} every question under this Subject */
function collectQuestions(s) {
  return s.topics.flatMap((t) => t.subTopics.flatMap((st) => st.questions));
}

/**
 * @param {HTMLElement} el
 * @param {SubjectGroup} s
 * @param {Record<string, any>} handlers
 */
export function patchSubjectNode(el, s, handlers) {
  const titleEl = el.querySelector(".acc-title");
  if (titleEl) {
    const { total, notImportant } = countQuestions(s);
    titleEl.textContent = `${s.subject}${s.isEmpty ? " (empty)" : ` (${total - notImportant}/${total})`}`;
  }

  const header = el.querySelector(":scope > .acc-header");
  const body = el.querySelector(":scope > .acc-body");
  const key = `S::${s.subject}`;
  if (header && body) {
    header.classList.toggle("expanded", appState.openNodeKeys.has(key));
    body.classList.toggle("open", appState.openNodeKeys.has(key));
  }
  el.classList.toggle("child-select-on", appState.childSelectModeKeys.has(groupKey("subject", { subject: s.subject })));
  el.classList.toggle("not-important", !!s.notImportant);

  patchGroupCompleteButton(el.querySelector(":scope > .acc-header > .group-complete-indicator"), s.completePercent, s.doneCount, s.totalCount, s.ignoredCount);

  const scope = { subject: s.subject };
  const groupLinks = getGroupLinks(appState.groupLinks, scope.subject, null, null);
  const linksControl = el.querySelector(":scope > .acc-header > .acc-header-controls > .links-dropdown-wrap");
  if (linksControl) patchGroupLinksControl(/** @type {HTMLElement} */ (linksControl), "subject", scope, groupLinks, handlers);
  const groupLinksRow = /** @type {HTMLElement|null} */ (el.querySelector(":scope > .acc-body > .group-links-row"));
  if (groupLinksRow) patchGroupLinksDisplayRow(groupLinksRow, groupLinks);

  const selectBox = /** @type {HTMLInputElement|null} */ (el.querySelector(":scope > .acc-header > .group-select-checkbox"));
  if (selectBox) selectBox.checked = appState.selectedGroupKeys.has(groupKey("subject", { subject: s.subject }));

  const reorderEligible = isReorderTarget("subject", { subject: s.subject });
  const reorderBadge = el.querySelector(":scope > .acc-header > .reorder-badge");
  if (reorderBadge) {
    const idx = reorderEligible ? appState.reorderMode?.selections.indexOf(s.subject) ?? -1 : -1;
    reorderBadge.textContent = idx >= 0 ? String(idx + 1) : "";
    reorderBadge.classList.toggle("reorder-eligible", reorderEligible);
    reorderBadge.classList.toggle("reorder-picked", idx >= 0);
  }
  if (header) header.classList.toggle("reorder-mode-target", reorderEligible);

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

  const statusSummary = /** @type {HTMLElement|null} */ (el.querySelector(":scope > .acc-body > .status-summary-row"));
  if (statusSummary) patchStatusSummary(statusSummary, collectQuestions(s));
}
