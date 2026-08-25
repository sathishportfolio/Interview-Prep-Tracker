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
  if (status === "hasAnswer") return hasAnswer(q);
  if (status === "noAnswer") return !hasAnswer(q);
  if (status === "unmarked") return !q.done && !q.failed && !q.reviewLater;
  if (status === "difficultyEasy") return q.difficulty === "easy";
  if (status === "difficultyMedium") return q.difficulty === "medium";
  if (status === "difficultyHard") return q.difficulty === "hard";
  if (status === "noDifficulty") return !q.difficulty;
  if (status === "notVisited") return !q.visited;
  return q[status] === true;
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

  // Insertion order, NOT alphabetical — `fullTree` is already ordered to match the accordion's own
  // custom Subject/Topic/SubTopic order (see data/group.js's groupData), and a Set preserves the
  // order values were first added in, so the filter dropdowns list options in that same order.
  return {
    subjects: [...subjectsSet],
    topics: [...topicsSet],
    subTopics: [...subTopicsSet],
  };
}

/** @returns {FilterState} */
export function emptyFilterState() {
  return { subjects: [], topics: [], subTopics: [], statuses: [], statusMode: "OR", tags: [] };
}

/**
 * Flattens every Question out of a GroupedTree, dropping the Subject/Topic/SubTopic grouping.
 * Exported (moved from features/refresh.js, its original single caller) so data/filter.js's own
 * fraction helpers below can share it too.
 * @param {GroupedTree} tree
 * @returns {Question[]}
 */
export function flattenTreeQuestions(tree) {
  const out = [];
  for (const s of tree.subjects) for (const t of s.topics) for (const st of t.subTopics) out.push(...st.questions);
  return out;
}

/**
 * @param {Question[]} questions
 * @param {(q: Question) => string} keyFn
 * @returns {Record<string, number>}
 */
function countBy(questions, keyFn) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const q of questions) {
    const k = keyFn(q);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

/**
 * Per-option "count/total" fractions for the Subject/Topic/SubTopic filter dropdowns (see
 * features/filters.js's filterCardBody) — mirrors the Status/Tags "count/total" fraction pattern
 * already used by the Stats dropdown (features/refresh.js's statusFraction/tagFraction), but for the
 * three hierarchy dimensions. For each dimension, `total` is that value's fixed count across the
 * WHOLE file (every question with that Subject/Topic/SubTopic, ignoring every active filter — a
 * denominator that never changes), and `count` is how many of those also match every OTHER
 * currently-active filter (every dimension except this one's own selection, so picking more values
 * within the SAME dimension doesn't shrink its siblings' own counts).
 * @param {GroupedTree} fullTree Ungrouped-by-status full tree (appState.groupedUnfiltered).
 * @param {FilterState} filters
 * @returns {{subjects: Record<string, {count: number, total: number}>, topics: Record<string, {count: number, total: number}>, subTopics: Record<string, {count: number, total: number}>}}
 */
export function computeOptionFractions(fullTree, filters) {
  const allQuestions = flattenTreeQuestions(fullTree);
  const subjectTotals = countBy(allQuestions, (q) => q.subject);
  const topicTotals = countBy(allQuestions, (q) => q.topic);
  const subTopicTotals = countBy(allQuestions, (q) => q.subTopic);

  const subjectCounts = countBy(flattenTreeQuestions(filterGroupedData(fullTree, { ...filters, subjects: [] })), (q) => q.subject);
  const topicCounts = countBy(flattenTreeQuestions(filterGroupedData(fullTree, { ...filters, topics: [] })), (q) => q.topic);
  const subTopicCounts = countBy(flattenTreeQuestions(filterGroupedData(fullTree, { ...filters, subTopics: [] })), (q) => q.subTopic);

  /**
   * @param {Record<string, number>} totals
   * @param {Record<string, number>} counts
   */
  const buildFractions = (totals, counts) => {
    /** @type {Record<string, {count: number, total: number}>} */
    const out = {};
    for (const k of Object.keys(totals)) out[k] = { count: counts[k] || 0, total: totals[k] };
    return out;
  };

  return {
    subjects: buildFractions(subjectTotals, subjectCounts),
    topics: buildFractions(topicTotals, topicCounts),
    subTopics: buildFractions(subTopicTotals, subTopicCounts),
  };
}

/**
 * Orders tag names by their fraction's `total` count descending (most-tagged first), ties broken
 * alphabetically for a stable order — shared by the Stats dropdown's Tags section
 * (features/refresh.js's repaint()) and the filterCardBody Tags multiselect (features/filters.js).
 * @param {string[]} tagNames
 * @param {Record<string, {count: number, total: number}>} fractionsByTag
 * @returns {string[]}
 */
export function sortTagsByCount(tagNames, fractionsByTag) {
  return [...tagNames].sort((a, b) => {
    const diff = (fractionsByTag[b]?.total || 0) - (fractionsByTag[a]?.total || 0);
    return diff !== 0 ? diff : a.localeCompare(b);
  });
}
