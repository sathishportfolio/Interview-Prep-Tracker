// @ts-check
/**
 * filter.js — filters a GroupedTree by FilterState, and computes interdependent filter option
 * lists (picking a Subject narrows which Topics are offered, etc). Pure, zero DOM.
 * @typedef {import('../types.js').GroupedTree} GroupedTree
 * @typedef {import('../types.js').FilterState} FilterState
 * @typedef {import('../types.js').Question} Question
 * @typedef {import('../types.js').StatusFilterKey} StatusFilterKey
 */

/**
 * @param {Question} q
 * @param {StatusFilterKey[]} statuses
 * @returns {boolean}
 */
function matchesStatus(q, statuses) {
  if (!statuses || statuses.length === 0) return true;
  return statuses.some((s) => q[s] === true);
}

/**
 * Filters a GroupedTree, keeping structurally-empty groups passing through the Status filter
 * (they always pass Status, since they have no questions to test — but still respect
 * Subject/Topic/SubTopic dropdown filters), per README-AI gotcha #6.
 * @param {GroupedTree} tree
 * @param {FilterState} filters
 * @returns {GroupedTree}
 */
export function filterGroupedData(tree, filters) {
  const { subjects: subjF, topics: topF, subTopics: stF, statuses } = filters;

  const subjects = tree.subjects
    .filter((s) => subjF.length === 0 || subjF.includes(s.subject))
    .map((s) => {
      const topics = s.topics
        .filter((t) => topF.length === 0 || topF.includes(t.topic))
        .map((t) => {
          const subTopics = t.subTopics
            .filter((st) => stF.length === 0 || stF.includes(st.subTopic))
            .map((st) => {
              if (st.isEmpty) {
                return { ...st, questions: [] };
              }
              const questions = st.questions.filter((q) => matchesStatus(q, statuses));
              return { ...st, questions, isEmpty: questions.length === 0 && st.questions.length === 0 };
            })
            .filter((st) => st.isEmpty || st.questions.length > 0);
          return { ...t, subTopics };
        })
        .filter((t) => t.subTopics.length > 0 || t.isEmpty);
      return { ...s, topics };
    })
    .filter((s) => s.topics.length > 0 || s.isEmpty);

  return { subjects };
}

/**
 * Computes the option lists for each dropdown, each narrowed by the OTHER active selections (not
 * its own), so picking a Subject narrows Topic/SubTopic options but not Subject's own list.
 * @param {GroupedTree} fullTree Ungrouped-by-status full tree (before status filtering).
 * @param {FilterState} filters
 * @returns {{subjects: string[], topics: string[], subTopics: string[]}}
 */
export function computeFilterOptions(fullTree, filters) {
  const subjectsSet = new Set();
  const topicsSet = new Set();
  const subTopicsSet = new Set();

  for (const s of fullTree.subjects) {
    subjectsSet.add(s.subject);
    if (filters.subjects.length > 0 && !filters.subjects.includes(s.subject)) continue;
    for (const t of s.topics) {
      topicsSet.add(t.topic);
      if (filters.topics.length > 0 && !filters.topics.includes(t.topic)) continue;
      for (const st of t.subTopics) {
        subTopicsSet.add(st.subTopic);
      }
    }
  }

  return {
    subjects: [...subjectsSet].sort(),
    topics: [...topicsSet].sort(),
    subTopics: [...subTopicsSet].sort(),
  };
}

/** @returns {FilterState} */
export function emptyFilterState() {
  return { subjects: [], topics: [], subTopics: [], statuses: [] };
}
