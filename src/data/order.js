// @ts-check
/**
 * order.js — order/reorder math. CRITICAL: every function here reads the FULL unfiltered
 * `rawData` array passed in, never a filtered/shorter view (README-AI gotcha #4) — callers must
 * always pass the complete rawData, not a filtered subset.
 * @typedef {import('../types.js').Question} Question
 */

/**
 * Computes the next `order` value for a new question appended to the end of a SubTopic.
 * @param {Question[]} rawData Full unfiltered array.
 * @param {string} subject
 * @param {string} topic
 * @param {string} subTopic
 * @returns {number}
 */
export function nextQuestionOrder(rawData, subject, topic, subTopic) {
  const siblings = rawData.filter(
    (q) => q.subject === subject && q.topic === topic && q.subTopic === subTopic
  );
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((q) => q.order ?? 0)) + 1;
}

/**
 * @param {Question[]} rawData
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject?: string, topic?: string}} scope
 * @returns {number}
 */
export function nextGroupOrder(rawData, level, scope = {}) {
  let siblings;
  let orderField;
  if (level === "subject") {
    siblings = rawData;
    orderField = "subjectOrder";
  } else if (level === "topic") {
    siblings = rawData.filter((q) => q.subject === scope.subject);
    orderField = "topicOrder";
  } else {
    siblings = rawData.filter((q) => q.subject === scope.subject && q.topic === scope.topic);
    orderField = "subTopicOrder";
  }
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((q) => q[orderField] ?? 0)) + 1;
}

/**
 * Returns the ordered list of sibling question IDs within a SubTopic, honoring the caller-supplied
 * comparator (tiering must be applied by caller via group.js semantics if needed) — here we sort
 * purely by `order` since move operations operate within one tier context at a time by directly
 * reading rawData (full, unfiltered).
 * @param {Question[]} rawData
 * @param {string} subject
 * @param {string} topic
 * @param {string} subTopic
 * @returns {Question[]}
 */
function siblingsOf(rawData, subject, topic, subTopic) {
  return rawData
    .filter((q) => q.subject === subject && q.topic === topic && q.subTopic === subTopic)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Moves a question up/down/top/bottom within its SubTopic by renumbering `order` on all siblings.
 * Returns a NEW array (rawData with updated question objects); does not mutate in place.
 * @param {Question[]} rawData Full unfiltered array.
 * @param {string} questionId
 * @param {"up"|"down"|"top"|"bottom"} direction
 * @returns {Question[]}
 */
export function moveQuestionOrder(rawData, questionId, direction) {
  const target = rawData.find((q) => q.id === questionId);
  if (!target) return rawData;
  const siblings = siblingsOf(rawData, target.subject, target.topic, target.subTopic);
  const idx = siblings.findIndex((q) => q.id === questionId);
  if (idx === -1) return rawData;

  let newIdx = idx;
  if (direction === "up") newIdx = Math.max(0, idx - 1);
  else if (direction === "down") newIdx = Math.min(siblings.length - 1, idx + 1);
  else if (direction === "top") newIdx = 0;
  else if (direction === "bottom") newIdx = siblings.length - 1;

  if (newIdx === idx) return rawData;

  const reordered = [...siblings];
  const [moved] = reordered.splice(idx, 1);
  reordered.splice(newIdx, 0, moved);

  const newOrderById = new Map(reordered.map((q, i) => [q.id, i]));
  return rawData.map((q) =>
    newOrderById.has(q.id) ? { ...q, order: /** @type {number} */ (newOrderById.get(q.id)) } : q
  );
}

/**
 * Renumbers all siblings of a SubTopic to a caller-supplied ID order (used by drag-and-drop and
 * cross-SubTopic moves after the target list is known).
 * @param {Question[]} rawData Full unfiltered array.
 * @param {string} subject
 * @param {string} topic
 * @param {string} subTopic
 * @param {string[]} orderedIds
 * @returns {Question[]}
 */
export function reorderSiblingsByIdList(rawData, subject, topic, subTopic, orderedIds) {
  const orderById = new Map(orderedIds.map((id, i) => [id, i]));
  return rawData.map((q) => {
    if (q.subject === subject && q.topic === topic && q.subTopic === subTopic && orderById.has(q.id)) {
      return { ...q, order: /** @type {number} */ (orderById.get(q.id)) };
    }
    return q;
  });
}
