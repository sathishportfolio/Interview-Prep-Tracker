// @ts-check
/**
 * features/dragDrop.js — Drag & Drop Reordering + cross-hierarchy moves. Owns every
 * `Sortable.create()` call (Topic/SubTopic/Question lists — Subjects are never draggable, only
 * valid drop targets). Same-list drags (reorder) are handled entirely by Sortable's own onEnd/
 * onUpdate; a Question dropped into an EXPANDED SubTopic's own list is handled by Sortable's onAdd.
 *
 * Everything else goes through one shared document-level dragover/drop hit-test
 * (elementFromPoint-based, using the shared highlight.js overlay for the drop-target indicator):
 * dropping onto an accordion HEADER rather than into a list. That covers every cross-hierarchy move
 * — Question -> Topic/Subject accordion, SubTopic -> Topic/Subject accordion, Topic -> Subject
 * accordion — plus the pre-existing case of a Question -> a COLLAPSED SubTopic, which has no live
 * list DOM to target. `dropTargetFor` is the compatibility matrix: which header LEVELS are valid
 * drop targets for which drag KIND (a Topic can only ever land on a Subject; a SubTopic can land on
 * a Topic or a Subject; a Question can land on a SubTopic, Topic, or Subject).
 *
 * Every cross-hierarchy destination preserves the dragged item's own name(s) and merges into an
 * identically-named sibling at the destination if one exists, or creates it if not — that's just
 * group.js's string-keyed bucketing, so no separate "create vs merge" branching is needed here: see
 * data/mutations.js's moveQuestions (question-level) and moveGroup (SubTopic/Topic-level), which
 * this module calls with a computed destination and nothing else.
 */
import { reorderSiblingsByIdList } from "../data/order.js";
import { moveQuestions, moveGroup } from "../data/mutations.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { showDropTargetHighlight, clearDropTargetHighlight } from "../render/highlight.js";

const initializedContainers = new WeakSet();

/**
 * The item currently being drag-handled, or null between drags. `kind` drives which header levels
 * `dropTargetFor` treats as valid cross-hierarchy drop targets. `el` is the dragged DOM element
 * itself — a successful cross-hierarchy move calls applyDataChange mid-drag, which re-renders and
 * removes `el`'s original ancestry from the tree (it moved elsewhere); without proactively removing
 * `el` first, SortableJS's own native drag-revert (triggered by the browser's `dragend`, since no
 * Sortable list "accepted" this drop) reinserts it back into its now-stale cached parent reference,
 * leaving a phantom duplicate — see finishDrop. Mirrors the same `evt.item.remove()` guard the
 * pre-existing Question-onto-expanded-SubTopic path already used for the identical reason.
 * @type {null
 *   | {kind: "question", ids: string[], source: {subject: string, topic: string, subTopic: string}, el: HTMLElement}
 *   | {kind: "subTopic", source: {subject: string, topic: string, subTopic: string}, el: HTMLElement}
 *   | {kind: "topic", source: {subject: string, topic: string}, el: HTMLElement}}
 */
let dragState = null;

/** Call after every repaint to attach Sortable to any not-yet-initialized list container. */
export function refreshSortables() {
  if (typeof /** @type {any} */ (window).Sortable === "undefined") return;
  const Sortable = /** @type {any} */ (window).Sortable;

  const root = document.getElementById("treeRoot");
  if (root) {
    root.querySelectorAll(".topic-list").forEach((el) => initGroupSortable(el, Sortable, "topic"));
    root.querySelectorAll(".subtopic-list").forEach((el) => initGroupSortable(el, Sortable, "subTopic"));
    root.querySelectorAll(".question-list").forEach((el) => initQuestionSortable(el, Sortable));
  }

  // Flatten View: every group's question list shares the same Sortable `group` name as the tree's
  // question lists (see initQuestionSortable), so a Question can be dragged directly from one
  // Subject/Topic/SubTopic's flat group into any other's — same onAdd cross-hierarchy-move path,
  // just with the destination read off the .flat-group ancestor instead of .level-subtopic.
  const flatRoot = document.getElementById("flatRoot");
  if (flatRoot) {
    flatRoot.querySelectorAll(".flat-question-list").forEach((el) => initQuestionSortable(el, Sortable));
  }

  attachDocumentDragTracking();
}

/**
 * Wires a Topic-list or SubTopic-list for same-list reordering (unchanged from before). Also now
 * tracks `dragState` on drag start so the shared document-level hit-test can offer this item as a
 * cross-hierarchy drop candidate on OTHER lists' headers — see module doc comment.
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
    onStart: (evt) => {
      const item = /** @type {HTMLElement} */ (evt.item);
      const key = /** @type {string} */ (item.dataset.key);
      const parts = key.split("::");
      dragState =
        level === "topic"
          ? { kind: "topic", source: { subject: parts[0], topic: parts[2] }, el: item } // "Subject::T::Topic"
          : { kind: "subTopic", source: { subject: parts[0], topic: parts[1], subTopic: parts[3] }, el: item }; // "Subject::Topic::ST::SubTopic"
    },
    onEnd: () => {
      const orderedKeys = Array.from(el.children).map((c) => /** @type {string} */ (/** @type {HTMLElement} */ (c).dataset.key));
      reorderGroups(level, orderedKeys);
      dragState = null;
      clearDropTargetHighlight();
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
 * Resolves which Subject/Topic/SubTopic a question-list container belongs to — either a tree
 * SubTopic accordion body or a Flatten View group, whichever ancestor is present. A Flatten View
 * group can be missing its Topic and/or SubTopic (see render/flatRenderer.js's doc comment — a
 * Subject with no Topics, or a Topic with no SubTopics, still gets a heading there as a drop
 * target); dropping a question into one creates that missing level named "Unnamed" rather than
 * writing an incomplete destination.
 * @param {Element} el
 * @returns {{subject: string, topic: string, subTopic: string}}
 */
function questionListScope(el) {
  const flatGroupEl = /** @type {HTMLElement|null} */ (el.closest(".flat-group"));
  if (flatGroupEl) {
    return {
      subject: /** @type {string} */ (flatGroupEl.dataset.subject),
      topic: flatGroupEl.dataset.topic || "Unnamed",
      subTopic: flatGroupEl.dataset.subTopic || "Unnamed",
    };
  }
  const scopeEl = /** @type {HTMLElement|null} */ (el.closest(".level-subtopic"));
  return {
    subject: /** @type {string} */ (scopeEl?.dataset.subject),
    topic: /** @type {string} */ (scopeEl?.dataset.topic),
    subTopic: /** @type {string} */ (scopeEl?.dataset.subTopic),
  };
}

/**
 * @param {Element} el
 * @param {any} Sortable
 */
function initQuestionSortable(el, Sortable) {
  if (initializedContainers.has(el)) return;
  initializedContainers.add(el);

  const { subject, topic, subTopic } = questionListScope(el);

  Sortable.create(el, {
    handle: ".drag-handle",
    animation: 150,
    group: "questions",
    onStart: (evt) => {
      const item = /** @type {HTMLElement} */ (evt.item);
      const draggedId = /** @type {string} */ (item.dataset.qid);
      const ids = appState.selectedQuestionIds.has(draggedId) ? [...appState.selectedQuestionIds] : [draggedId];
      dragState = { kind: "question", ids, source: { subject, topic, subTopic }, el: item };
    },
    onEnd: () => {
      dragState = null;
      clearDropTargetHighlight();
    },
    onUpdate: () => {
      // Same-list reorder.
      const orderedIds = Array.from(el.children).map((c) => /** @type {string} */ (/** @type {HTMLElement} */ (c).dataset.qid));
      const rawData = reorderSiblingsByIdList(appState.rawData, subject, topic, subTopic, orderedIds);
      applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
    },
    onAdd: (evt) => {
      // Cross-list drop onto a rendered (expanded) SubTopic's question list, or onto any Flatten
      // View group's question list — exact target, no creation/merge ambiguity since the
      // destination SubTopic already exists and is on-screen.
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

/**
 * Compatibility matrix for cross-hierarchy drops: given the in-progress drag and a candidate
 * header's accordion item, returns the move's destination if this is a valid target, or null if
 * not (wrong kind/level pairing, or — for a Question over a SubTopic header — an EXPANDED SubTopic,
 * whose own list Sortable's onAdd already owns). Destinations always carry over the dragged item's
 * own name(s) from `dragState.source`, letting moveQuestions/moveGroup's string-keyed bucketing
 * decide merge-vs-create.
 * @param {NonNullable<typeof dragState>} state The in-progress drag — passed explicitly (not read
 *   off the module-level `dragState`) so callers can still resolve a target after already clearing
 *   `dragState` themselves (see finishDrop, which nulls it up front to guard against re-entrancy).
 * @param {HTMLElement} header
 * @returns {{kind: "question"|"subTopic"|"topic", destination: any} | null}
 */
function dropTargetFor(state, header) {
  const item = /** @type {HTMLElement} */ (header.parentElement);

  if (state.kind === "question") {
    const source = state.source;
    if (item.classList.contains("level-subtopic")) {
      if (header.classList.contains("expanded")) return null; // Sortable's onAdd handles this one
      return { kind: "question", destination: { subject: item.dataset.subject, topic: item.dataset.topic, subTopic: item.dataset.subTopic } };
    }
    if (item.classList.contains("level-topic")) {
      return { kind: "question", destination: { subject: item.dataset.subject, topic: item.dataset.topic, subTopic: source.subTopic } };
    }
    if (item.classList.contains("level-subject")) {
      return { kind: "question", destination: { subject: item.dataset.subject, topic: source.topic, subTopic: source.subTopic } };
    }
    return null;
  }

  if (state.kind === "subTopic") {
    const source = state.source;
    if (item.classList.contains("level-topic")) {
      return { kind: "subTopic", destination: { subject: item.dataset.subject, topic: item.dataset.topic } };
    }
    if (item.classList.contains("level-subject")) {
      return { kind: "subTopic", destination: { subject: item.dataset.subject, topic: source.topic } };
    }
    return null;
  }

  // state.kind === "topic"
  if (item.classList.contains("level-subject")) {
    return { kind: "topic", destination: { subject: item.dataset.subject } };
  }
  return null;
}

let documentTrackingAttached = false;

function attachDocumentDragTracking() {
  if (documentTrackingAttached) return;
  documentTrackingAttached = true;

  document.addEventListener("dragover", (e) => {
    if (!dragState) return;
    e.preventDefault();
    const target = /** @type {HTMLElement|null} */ (document.elementFromPoint(e.clientX, e.clientY));
    handleHover(target);
  });

  document.addEventListener("drop", (e) => {
    if (!dragState) return;
    const target = /** @type {HTMLElement|null} */ (document.elementFromPoint(e.clientX, e.clientY));
    finishDrop(target);
  });
}

/** @param {HTMLElement|null} target */
function handleHover(target) {
  clearDropTargetHighlight();
  if (!target || !dragState) return;
  const header = /** @type {HTMLElement|null} */ (target.closest(".acc-header"));
  if (!header) return;
  if (dropTargetFor(dragState, header)) showDropTargetHighlight(header);
}

/** @param {HTMLElement|null} target */
function finishDrop(target) {
  const state = dragState;
  dragState = null;
  clearDropTargetHighlight();
  if (!target || !state) return;
  const header = /** @type {HTMLElement|null} */ (target.closest(".acc-header"));
  if (!header) return;
  const match = dropTargetFor(state, header);
  if (!match) return;

  // Proactively remove the dragged element before mutating — see dragState's doc comment for why
  // (SortableJS's own native-drag-revert would otherwise reinsert a stale duplicate on `dragend`).
  state.el.remove();

  const data = { rawData: appState.rawData, emptyGroups: appState.emptyGroups };
  if (state.kind === "question") {
    applyDataChange(moveQuestions(data, state.ids, match.destination));
  } else {
    applyDataChange(moveGroup(data, state.kind, state.source, match.destination));
  }
}
