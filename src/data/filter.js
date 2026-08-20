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
 * Exported for callers that need to test a question against a whole active status selection
 * directly (e.g. features/refresh.js's stats-row fraction counts, which intersect a row's own
 * single status against this same combined predicate).
 * @param {Question} q
 * @param {StatusFilterKey[]} statuses
 * @param {"OR"|"AND"|"NOT"} [mode] default "OR" — see FilterState.statusMode. "NOT" excludes a
 *   question that matches ANY selected status (the logical negation of "OR") — e.g. selecting
 *   Starred+Failed with NOT keeps only questions that are neither.
 * @returns {boolean}
 */
export function matchesStatus(q, statuses, mode) {
  if (!statuses || statuses.length === 0) return true;
  if (mode === "AND") return statuses.every((s) => matchesSingleStatus(q, s));
  if (mode === "NOT") return !statuses.some((s) => matchesSingleStatus(q, s));
  return statuses.some((s) => matchesSingleStatus(q, s));
}

/**
 * Single-status match, exported for callers that need one status's own predicate directly (e.g.
 * features/refresh.js's per-row stats counts).
 * @param {Question} q
 * @param {StatusFilterKey} status
 * @returns {boolean}
 */
export function matchesSingleStatus(q, status) {
  if (status === "dueForReview") return isDueForReview(q);
  if (status === "hasAnswer") return hasAnswer(q);
  if (status === "noAnswer") return !hasAnswer(q);
  if (status === "unmarked") return !q.done && !q.failed && !q.reviewLater;
  if (status === "difficultyEasy") return q.difficulty === "easy";
  if (status === "difficultyMedium") return q.difficulty === "medium";
  if (status === "difficultyHard") return q.difficulty === "hard";
  return q[status] === true;
}

/**
 * "dueForReview" isn't a stored boolean like the other status flags — it's a live comparison of
 * `srsDue` against today, so a question naturally falls in/out of this filter as days pass without
 * needing any write.
 * @param {Question} q
 * @returns {boolean}
 */
function isDueForReview(q) {
  return !!q.srsDue && q.srsDue <= new Date().toISOString().slice(0, 10);
}

/**
 * Tags filter predicate — a question passes if it carries ANY of the selected tags (OR), or always
 * passes when no tags are selected. Exported for stats' per-tag fraction counts (mirrors
 * matchesStatus/matchesSingleStatus's export pattern).
 * @param {Question} q
 * @param {string[]} tags
 * @returns {boolean}
 */
export function matchesTags(q, tags) {
  return !tags || tags.length === 0 || tags.some((t) => q.tags?.includes(t));
}

/**
 * "hasAnswer"/"noAnswer" aren't stored booleans either — computed from whether `answer` (HTML-
 * supporting rich text) has any non-whitespace/markup content.
 * @param {Question} q
 * @returns {boolean}
 */
export function hasAnswer(q) {
  return !!q.answer && q.answer.replace(/<[^>]*>/g, "").trim().length > 0;
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
  const { subjects: subjF, topics: topF, subTopics: stF, statuses, statusMode, tags } = filters;

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
              const questions = st.questions.filter((q) => matchesStatus(q, statuses, statusMode) && matchesTags(q, tags));
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
  return { subjects: [], topics: [], subTopics: [], statuses: [], statusMode: "OR", tags: [] };
}
