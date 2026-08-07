// @ts-check
/**
 * features/dragDrop.js — Drag & Drop Reordering. Owns every `Sortable.create()` call (Subject/
 * Topic/SubTopic/Question lists). On reorder/cross-list drop, reads the post-drag DOM key order,
 * maps to IDs, calls data/order.js + data/mutations.js.moveQuestions (the same function
 * moveForm.js uses), then the shared refresh pipeline reconciles just the affected part (any
 * tiering violation from the raw drag position self-corrects on that patch, since groupData()
 * re-sorts by tier on every recompute).
 *
 * Dropping onto a COLLAPSED SubTopic header is handled via a document-level hit-test during active
 * question drags (elementFromPoint-based, using the shared highlight.js overlay for the drop-target
 * indicator) that bypasses Sortable's own DOM-insertion path and calls moveQuestions directly,
 * since a collapsed target has no live list DOM to reconcile against.
 */
import { reorderSiblingsByIdList } from "../data/order.js";
import { moveQuestions } from "../data/mutations.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { showDropTargetHighlight, clearDropTargetHighlight } from "../render/highlight.js";

const initializedContainers = new WeakSet();

let draggingQuestionIds = null;
let draggingSourceScope = null;

/** Call after every repaint to attach Sortable to any not-yet-initialized list container. */
export function refreshSortables() {
  const root = document.getElementById("treeRoot");
  if (!root || typeof /** @type {any} */ (window).Sortable === "undefined") return;
  const Sortable = /** @type {any} */ (window).Sortable;

  root.querySelectorAll(".topic-list").forEach((el) => initGroupSortable(el, Sortable, "topic"));
  root.querySelectorAll(".subtopic-list").forEach((el) => initGroupSortable(el, Sortable, "subTopic"));
  root.querySelectorAll(".question-list").forEach((el) => initQuestionSortable(el, Sortable));

  attachDocumentDragTracking();
}

/**
 * @param {Element} el
 * @param {any} Sortable
 * @param {"topic"|"subTopic"} level
 */
function initGroupSortable(el, Sortable, level) {
  if (initializedContainers.has(el)) return;
  initializedContainers.add(el);
  Sortable.create(el, {
    handle: ".drag-handle",
    animation: 150,
    onEnd: () => {
      const orderedKeys = Array.from(el.children).map((c) => /** @type {string} */ (/** @type {HTMLElement} */ (c).dataset.key));
      reorderGroups(level, orderedKeys);
    },
  });
}

/**
 * @param {"topic"|"subTopic"} level
 * @param {string[]} orderedKeys
 */
function reorderGroups(level, orderedKeys) {
  // Renumber the relevant *Order field on rawData to match the new DOM order, reading full
  // unfiltered rawData (never a filtered view) — mirrors data/order.js's contract.
  const field = level === "topic" ? "topicOrder" : "subTopicOrder";
  const names = orderedKeys.map((k) => {
    const parts = k.split("::");
    return level === "topic" ? parts[2] : parts[3]; // "Subj::T::Topic" or "Subj::Topic::ST::Sub"
  });
  const orderByName = new Map(names.map((n, i) => [n, i]));
  const rawData = appState.rawData.map((q) => {
    const key = level === "topic" ? q.topic : q.subTopic;
    if (orderByName.has(key)) {
      return { ...q, [field]: orderByName.get(key) };
    }
    return q;
  });
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
}

/**
 * @param {Element} el
 * @param {any} Sortable
 */
function initQuestionSortable(el, Sortable) {
  if (initializedContainers.has(el)) return;
  initializedContainers.add(el);

  const subTopicItem = el.closest(".level-subtopic");
  const subject = /** @type {string} */ (/** @type {HTMLElement} */ (subTopicItem)?.dataset.subject);
  const topic = /** @type {string} */ (/** @type {HTMLElement} */ (subTopicItem)?.dataset.topic);
  const subTopic = /** @type {string} */ (/** @type {HTMLElement} */ (subTopicItem)?.dataset.subTopic);

  Sortable.create(el, {
    handle: ".drag-handle",
    animation: 150,
    group: "questions",
    onStart: (evt) => {
      const draggedId = /** @type {string} */ (/** @type {HTMLElement} */ (evt.item).dataset.qid);
      draggingQuestionIds = appState.selectedQuestionIds.has(draggedId)
        ? [...appState.selectedQuestionIds]
        : [draggedId];
      draggingSourceScope = { subject, topic, subTopic };
    },
    onEnd: () => {
      draggingQuestionIds = null;
      draggingSourceScope = null;
      clearDropTargetHighlight();
    },
    onUpdate: () => {
      // Same-list reorder.
      const orderedIds = Array.from(el.children).map((c) => /** @type {string} */ (/** @type {HTMLElement} */ (c).dataset.qid));
      const rawData = reorderSiblingsByIdList(appState.rawData, subject, topic, subTopic, orderedIds);
      applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
    },
    onAdd: (evt) => {
      // Cross-list drop onto a rendered (expanded) SubTopic's question list.
      const draggedId = /** @type {string} */ (/** @type {HTMLElement} */ (evt.item).dataset.qid);
      const ids = appState.selectedQuestionIds.has(draggedId) ? [...appState.selectedQuestionIds] : [draggedId];
      evt.item.remove(); // let the keyed re-render own placement, not Sortable's raw DOM insert
      const result = moveQuestions(
        { rawData: appState.rawData, emptyGroups: appState.emptyGroups },
        ids,
        { subject, topic, subTopic }
      );
      applyDataChange(result);
    },
  });
}

let documentTrackingAttached = false;

function attachDocumentDragTracking() {
  if (documentTrackingAttached) return;
  documentTrackingAttached = true;

  document.addEventListener("dragover", (e) => {
    if (!draggingQuestionIds) return;
    e.preventDefault();
    const target = /** @type {HTMLElement|null} */ (document.elementFromPoint(e.clientX, e.clientY));
    handleHoverForCollapsedDrop(target);
  });

  document.addEventListener("drop", (e) => {
    if (!draggingQuestionIds) return;
    const target = /** @type {HTMLElement|null} */ (document.elementFromPoint(e.clientX, e.clientY));
    finishDropOnCollapsedHeaderIfAny(target);
  });
}

/** @param {HTMLElement|null} target */
function handleHoverForCollapsedDrop(target) {
  clearDropTargetHighlight();
  if (!target) return;
  const header = target.closest(".level-subtopic > .acc-header");
  if (!header) return;
  const item = header.closest(".level-subtopic");
  const isCollapsed = !header.classList.contains("expanded");
  if (item && isCollapsed) {
    showDropTargetHighlight(/** @type {HTMLElement} */ (header));
  }
}

/** @param {HTMLElement|null} target */
function finishDropOnCollapsedHeaderIfAny(target) {
  if (!target || !draggingQuestionIds) return;
  const header = target.closest(".level-subtopic > .acc-header");
  if (!header) return;
  const item = /** @type {HTMLElement} */ (header.closest(".level-subtopic"));
  if (!item) return;
  const isCollapsed = !header.classList.contains("expanded");
  if (!isCollapsed) return; // expanded targets are handled by Sortable's own onAdd

  const destination = { subject: item.dataset.subject, topic: item.dataset.topic, subTopic: item.dataset.subTopic };
  const result = moveQuestions(
    { rawData: appState.rawData, emptyGroups: appState.emptyGroups },
    draggingQuestionIds,
    /** @type {any} */ (destination)
  );
  applyDataChange(result);
  clearDropTargetHighlight();
  draggingQuestionIds = null;
  draggingSourceScope = null;
}
