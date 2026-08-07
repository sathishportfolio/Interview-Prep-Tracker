// @ts-check
/**
 * render/flatRenderer.js — Flatten View: one "Subject/Topic/SubTopic" heading per non-empty group,
 * followed directly by its question accordions (no collapse on the heading itself, no bulk-select/
 * drag UI at group level — same rationale as the old app: flatten exists to scan within groups,
 * not to move things between them). Every per-question action still works identically since it
 * reuses questionView.js unchanged.
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
  /** @type {Array<{key: string, subject: string, topic: string, subTopic: string, questions: any[]}>} */
  const groups = [];
  for (const s of tree.subjects) {
    for (const t of s.topics) {
      for (const st of t.subTopics) {
        if (st.questions.length === 0) continue;
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

function createFlatGroup(g) {
  const wrap = document.createElement("div");
  wrap.className = "flat-group";
  wrap.dataset.key = g.key;

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
  if (heading) heading.textContent = `${g.subject}/${g.topic}/${g.subTopic}`;

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
