// @ts-check
/**
 * render/flatRenderer.js — Flatten View: one "Subject/Topic/SubTopic" heading per group, followed
 * directly by its question accordions (no collapse on the heading itself, no bulk-select/drag UI at
 * group level — same rationale as the old app: flatten exists to scan within groups, not to move
 * things between them). Every per-question action still works identically since it reuses
 * questionView.js unchanged.
 *
 * Empty Subjects/Topics/SubTopics get their own heading here too (with no question rows under it)
 * rather than being omitted — that's what lets them act as drag-and-drop targets in this view (see
 * features/dragDrop.js), since a fully flat view has no accordion tree to drop onto otherwise. A
 * Subject with no Topics, or a Topic with no SubTopics, renders as a path one/two segments short —
 * dropping a question there creates the missing Topic and/or SubTopic named "Unnamed" (see
 * dragDrop.js's questionListScope).
 * @typedef {import('../types.js').GroupedTree} GroupedTree
 */
import { reconcileKeyedList } from "./keyedList.js";
import { createQuestionNode, patchQuestionNode } from "./nodeViews/questionView.js";

let rootEl = null;
let currentHandlers = null;

/**
 * @param {HTMLElement} container
 * @param {Record<string, any>} handlers
 */
export function initFlatRenderer(container, handlers) {
  rootEl = container;
  currentHandlers = handlers;
}

/**
 * @param {GroupedTree} tree
 */
export function renderFlat(tree) {
  if (!rootEl) return;
  /** @type {Array<{key: string, subject: string, topic: string|null, subTopic: string|null, questions: any[]}>} */
  const groups = [];
  for (const s of tree.subjects) {
    if (s.topics.length === 0) {
      groups.push({ key: `FLAT::${s.subject}`, subject: s.subject, topic: null, subTopic: null, questions: [] });
      continue;
    }
    for (const t of s.topics) {
      if (t.subTopics.length === 0) {
        groups.push({ key: `FLAT::${s.subject}::${t.topic}`, subject: s.subject, topic: t.topic, subTopic: null, questions: [] });
        continue;
      }
      for (const st of t.subTopics) {
        groups.push({
          key: `FLAT::${s.subject}::${t.topic}::${st.subTopic}`,
          subject: s.subject,
          topic: t.topic,
          subTopic: st.subTopic,
          questions: st.questions,
        });
      }
    }
  }

  reconcileKeyedList(
    rootEl,
    groups,
    (g) => g.key,
    (g) => createFlatGroup(g),
    (el, g) => patchFlatGroup(el, g)
  );
}

/**
 * Looks up a Flatten View group's own element by its subject/topic/subTopic dataset (mirrors
 * render/accordion.js's findNodeElement for the tree view) — used by features/reviewShortcuts.js's
 * Tab/Shift+Tab SubTopic navigation to scroll an empty Subject/Topic/SubTopic group into view when
 * there's no question to activate/scroll to instead. `topic`/`subTopic` pass `null` for a
 * subject-only or topic-only empty-group position, matching how createFlatGroup only sets those
 * dataset attributes when the group actually has them.
 * @param {string} subject
 * @param {string|null} topic
 * @param {string|null} subTopic
 * @returns {HTMLElement|null}
 */
export function findFlatGroupEl(subject, topic, subTopic) {
  if (!rootEl) return null;
  return (
    /** @type {HTMLElement|null} */ (
      [...rootEl.querySelectorAll(".flat-group")].find((el) => {
        const d = /** @type {HTMLElement} */ (el).dataset;
        return d.subject === subject && (topic == null ? d.topic === undefined : d.topic === topic) && (subTopic == null ? d.subTopic === undefined : d.subTopic === subTopic);
      }) ?? null
    )
  );
}

function createFlatGroup(g) {
  const wrap = document.createElement("div");
  wrap.className = "flat-group";
  wrap.dataset.key = g.key;
  wrap.dataset.subject = g.subject;
  if (g.topic) wrap.dataset.topic = g.topic;
  if (g.subTopic) wrap.dataset.subTopic = g.subTopic;

  const heading = document.createElement("p");
  heading.className = "flat-group-path";
  wrap.appendChild(heading);

  const list = document.createElement("div");
  list.className = "flat-question-list";
  wrap.appendChild(list);

  patchFlatGroup(wrap, g);
  return wrap;
}

function patchFlatGroup(el, g) {
  const heading = el.querySelector(".flat-group-path");
  if (heading) heading.textContent = [g.subject, g.topic, g.subTopic].filter(Boolean).join("/");
  el.classList.toggle("flat-group-empty", g.questions.length === 0);

  const list = el.querySelector(".flat-question-list");
  if (list) {
    reconcileKeyedList(
      /** @type {HTMLElement} */ (list),
      g.questions,
      (q) => `Q::${q.id}`,
      (q) => createQuestionNode(q, currentHandlers),
      (qEl, q) => patchQuestionNode(qEl, q, currentHandlers)
    );
  }
}
