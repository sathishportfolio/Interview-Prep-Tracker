// @ts-check
/**
 * search.js — Jump to Question search. Matches Subject/Topic/SubTopic/question text, scoped to
 * the currently-visible (already-filtered) tree, max 10 grouped results. Zero DOM.
 * @typedef {import('../types.js').GroupedTree} GroupedTree
 * @typedef {import('../types.js').Question} Question
 */
import { flattenQuestions } from "./group.js";

/**
 * @typedef {Object} SearchResultGroup
 * @property {string} subject
 * @property {string} topic
 * @property {string} subTopic
 * @property {Question[]} questions
 */

const MAX_RESULTS = 10;

/**
 * @param {GroupedTree} filteredTree The tree already narrowed by active filters.
 * @param {string} queryText
 * @returns {SearchResultGroup[]}
 */
export function searchQuestions(filteredTree, queryText) {
  const query = queryText.trim().toLowerCase();
  if (!query) return [];

  const all = flattenQuestions(filteredTree);
  const matches = all.filter((q) =>
    [q.subject, q.topic, q.subTopic, q.question].some((f) => (f || "").toLowerCase().includes(query))
  );

  const limited = matches.slice(0, MAX_RESULTS);

  /** @type {Map<string, SearchResultGroup>} */
  const groups = new Map();
  for (const q of limited) {
    const key = `${q.subject}::${q.topic}::${q.subTopic}`;
    if (!groups.has(key)) {
      groups.set(key, { subject: q.subject, topic: q.topic, subTopic: q.subTopic, questions: [] });
    }
    /** @type {SearchResultGroup} */ (groups.get(key)).questions.push(q);
  }
  return [...groups.values()];
}
