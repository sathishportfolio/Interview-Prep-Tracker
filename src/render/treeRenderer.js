// @ts-check
/**
 * render/treeRenderer.js — orchestrates the nested-accordion tree via keyedList + accordion +
 * nodeViews. This is the top-level entry point features/* calls to (re)paint the tree; it never
 * imports features/* itself — only takes a `handlers` object of callbacks.
 * @typedef {import('../types.js').GroupedTree} GroupedTree
 */
import { reconcileKeyedList } from "./keyedList.js";
import { createSubjectNode, patchSubjectNode } from "./nodeViews/subjectView.js";

/** @type {HTMLElement|null} */
let rootEl = null;
let currentHandlers = null;
/** @type {GroupedTree} */
let currentTree = { subjects: [] };

/**
 * @param {HTMLElement} container
 * @param {Record<string, any>} handlers
 */
export function initTreeRenderer(container, handlers) {
  rootEl = container;
  currentHandlers = handlers;
}

/**
 * Full (but still keyed/diffed) repaint of the tree from a new GroupedTree. Call after any
 * mutation whose blast radius isn't known to be narrower (bulk add, filter change, file switch).
 * For narrower changes (single status toggle), prefer patchAfterMutation with a scoped tree.
 * @param {GroupedTree} tree
 */
export function renderTree(tree) {
  currentTree = tree;
  if (!rootEl) return;
  reconcileKeyedList(
    rootEl,
    tree.subjects,
    (s) => `S::${s.subject}`,
    (s) => createSubjectNode(s, currentHandlers),
    (el, s) => patchSubjectNode(el, s, currentHandlers)
  );
}

/**
 * Re-renders the whole tree (keyed diff still applies — this only means "recompute what to show",
 * not "nuke the DOM"). Feature modules call this after any mutation; because reconciliation is
 * keyed, unaffected subtrees are patched in place cheaply and open/scroll state survives for free.
 * @param {GroupedTree} tree
 */
export function patchAfterMutation(tree) {
  renderTree(tree);
}

/** @returns {GroupedTree} */
export function getCurrentTree() {
  return currentTree;
}

/** @returns {HTMLElement|null} */
export function findQuestionHeaderEl(questionId) {
  if (!rootEl) return null;
  const item = rootEl.querySelector(`[data-qid="${cssEscape(questionId)}"]`);
  if (!item) return null;
  return /** @type {HTMLElement} */ (item.querySelector(":scope > .question-header"));
}

/** @param {string} s */
function cssEscape(s) {
  return window.CSS && window.CSS.escape ? window.CSS.escape(s) : s.replace(/["\\]/g, "\\$&");
}
