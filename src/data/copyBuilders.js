// @ts-check
/**
 * copyBuilders.js — five pure text builders for the per-level copy menus (feature.md
 * "Per-Level Copy Menus") and the global "Copy Visible Questions". Scoped to just the given node
 * + its descendants — NEVER leaks the ancestor chain (a past bug in the old app). The one place a
 * full Subject-down path legitimately appears is the global "visible questions" builders, which
 * take a GroupedTree already rooted at Subject (no ancestor above Subject exists).
 * @typedef {import('../types.js').GroupedTree} GroupedTree
 * @typedef {import('../types.js').SubjectGroup} SubjectGroup
 * @typedef {import('../types.js').TopicGroup} TopicGroup
 * @typedef {import('../types.js').SubTopicGroup} SubTopicGroup
 * @typedef {import('../types.js').Question} Question
 */

/**
 * Normalizes any of Subject/Topic/SubTopic group shapes into a common descendant walker.
 * @param {SubjectGroup|TopicGroup|SubTopicGroup} node
 * @returns {{name: string, questions: Question[], children: Array<{name: string, questions: Question[], children: any[]}>}}
 */
function toWalkNode(node) {
  if ("questions" in node) {
    // SubTopicGroup: leaf level
    return { name: node.subTopic, questions: node.questions, children: [] };
  }
  if ("subTopics" in node) {
    // TopicGroup
    return {
      name: node.topic,
      questions: [],
      children: node.subTopics.map((st) => toWalkNode(st)),
    };
  }
  // SubjectGroup
  return {
    name: node.subject,
    questions: [],
    children: node.topics.map((t) => toWalkNode(t)),
  };
}

/** @param {{name:string, questions:Question[], children:any[]}} node @returns {Question[]} */
function collectQuestions(node) {
  /** @type {Question[]} */
  const out = [...node.questions];
  for (const c of node.children) out.push(...collectQuestions(c));
  return out;
}

/**
 * Questions (plain) — one question per line.
 * @param {SubjectGroup|TopicGroup|SubTopicGroup} node
 * @returns {string}
 */
export function buildPlainCopyText(node) {
  return collectQuestions(toWalkNode(node)).map((q) => q.question).join("\n");
}

/**
 * Structure + Answer — tab-separated Subject/Topic/SubTopic/Question rows, scoped to this node down.
 * @param {SubjectGroup|TopicGroup|SubTopicGroup} node
 * @returns {string}
 */
export function buildStructureWithAnswerCopyText(node) {
  const questions = collectQuestions(toWalkNode(node));
  return questions.map((q) => [q.subject, q.topic, q.subTopic, q.question, q.answer, q.difficulty ?? ""].join("\t")).join("\n");
}

/**
 * Structure only — tab-separated Subject/Topic/SubTopic rows, no questions.
 * @param {SubjectGroup|TopicGroup|SubTopicGroup} node
 * @returns {string}
 */
export function buildStructureOnlyCopyText(node) {
  const questions = collectQuestions(toWalkNode(node));
  return questions.map((q) => [q.subject, q.topic, q.subTopic].join("\t")).join("\n");
}

/**
 * Hierarchy (tab-indented) — names and questions, indented by level, scoped to this node down.
 * @param {SubjectGroup|TopicGroup|SubTopicGroup} node
 * @returns {string}
 */
export function buildHierarchyCopyText(node) {
  const lines = [];
  function walk(n, depth) {
    lines.push("\t".repeat(depth) + n.name);
    for (const q of n.questions) lines.push("\t".repeat(depth + 1) + q.question);
    for (const c of n.children) walk(c, depth + 1);
  }
  walk(toWalkNode(node), 0);
  return lines.join("\n");
}

/**
 * Hierarchy only — just the group names, tab-indented, no questions.
 * @param {SubjectGroup|TopicGroup|SubTopicGroup} node
 * @returns {string}
 */
export function buildHierarchyOnlyCopyText(node) {
  const lines = [];
  function walk(n, depth) {
    lines.push("\t".repeat(depth) + n.name);
    for (const c of n.children) walk(c, depth + 1);
  }
  walk(toWalkNode(node), 0);
  return lines.join("\n");
}

/**
 * Global "Copy Visible Questions" variants operate on a full GroupedTree (rooted at Subject, so a
 * full Subject-down path is legitimate here, not a leak).
 * @param {GroupedTree} tree
 * @param {"plain"|"structureWithAnswer"|"structureOnly"|"hierarchy"|"hierarchyOnly"} format
 * @returns {string}
 */
export function buildVisibleCopyText(tree, format) {
  const parts = tree.subjects.map((s) => {
    if (format === "plain") return buildPlainCopyText(s);
    if (format === "structureWithAnswer") return buildStructureWithAnswerCopyText(s);
    if (format === "structureOnly") return buildStructureOnlyCopyText(s);
    if (format === "hierarchy") return buildHierarchyCopyText(s);
    return buildHierarchyOnlyCopyText(s);
  });
  return parts.filter((p) => p.length > 0).join("\n");
}

/**
 * Flattens an entire GroupedTree (already filtered, e.g. appState.grouped) into its questions —
 * used by features/duplicateFinder.js to scan "the current filtered view" as one flat list.
 * @param {GroupedTree} tree
 * @returns {Question[]}
 */
export function flattenGroupedTree(tree) {
  return tree.subjects.flatMap((s) => collectQuestions(toWalkNode(s)));
}
