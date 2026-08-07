// @ts-check
/**
 * data/emptyGroups.js — pure placeholder-group tracking (README-AI gotcha #6). Separate from
 * rawData. `mark*` adds a marker (no-op if one already covers it or if real questions still
 * exist there); `prune*` self-cleans markers once a group is non-empty again or explicitly removed.
 * @typedef {import('../types.js').EmptyGroup} EmptyGroup
 * @typedef {import('../types.js').Question} Question
 */

/**
 * @param {EmptyGroup[]} emptyGroups
 * @param {string} subject
 * @param {string|null} topic
 * @param {string|null} subTopic
 * @returns {boolean}
 */
function alreadyMarked(emptyGroups, subject, topic, subTopic) {
  return emptyGroups.some(
    (eg) => eg.subject === subject && eg.topic === topic && eg.subTopic === subTopic
  );
}

/**
 * Adds an empty-group placeholder if not already present. Returns a NEW array.
 * @param {EmptyGroup[]} emptyGroups
 * @param {string} subject
 * @param {string|null} [topic]
 * @param {string|null} [subTopic]
 * @returns {EmptyGroup[]}
 */
export function markGroupEmpty(emptyGroups, subject, topic = null, subTopic = null) {
  if (alreadyMarked(emptyGroups, subject, topic, subTopic)) return emptyGroups;
  const createdOrder =
    emptyGroups.length === 0 ? 0 : Math.max(...emptyGroups.map((e) => e.createdOrder)) + 1;
  return [...emptyGroups, { subject, topic, subTopic, createdOrder }];
}

/**
 * Removes an exact-match placeholder (e.g. group deleted, or explicitly consumed by a new question).
 * @param {EmptyGroup[]} emptyGroups
 * @param {string} subject
 * @param {string|null} [topic]
 * @param {string|null} [subTopic]
 * @returns {EmptyGroup[]}
 */
export function unmarkGroupEmpty(emptyGroups, subject, topic = null, subTopic = null) {
  return emptyGroups.filter(
    (eg) => !(eg.subject === subject && eg.topic === topic && eg.subTopic === subTopic)
  );
}

/**
 * Self-prunes: removes any placeholder whose group now has real questions in rawData (i.e. it's no
 * longer empty), and any subTopic/topic placeholder whose parent-level placeholder already subsumes
 * it more shallowly is left intact (shallow markers are independent entries). Call after any
 * mutation that could have added a question into a previously-empty group.
 * @param {EmptyGroup[]} emptyGroups
 * @param {Question[]} rawData
 * @returns {EmptyGroup[]}
 */
export function pruneEmptyGroups(emptyGroups, rawData) {
  return emptyGroups.filter((eg) => {
    if (eg.subTopic != null) {
      return !rawData.some(
        (q) => q.subject === eg.subject && q.topic === eg.topic && q.subTopic === eg.subTopic
      );
    }
    if (eg.topic != null) {
      return !rawData.some((q) => q.subject === eg.subject && q.topic === eg.topic);
    }
    return !rawData.some((q) => q.subject === eg.subject);
  });
}

/**
 * Rewrites matching placeholder entries when a Subject/Topic/SubTopic is renamed.
 * @param {EmptyGroup[]} emptyGroups
 * @param {{level: "subject"|"topic"|"subTopic", subject: string, topic?: string, subTopic?: string, newName: string}} rename
 * @returns {EmptyGroup[]}
 */
export function renameInEmptyGroups(emptyGroups, rename) {
  return emptyGroups.map((eg) => {
    if (rename.level === "subject" && eg.subject === rename.subject) {
      return { ...eg, subject: rename.newName };
    }
    if (
      rename.level === "topic" &&
      eg.subject === rename.subject &&
      eg.topic === rename.topic
    ) {
      return { ...eg, topic: rename.newName };
    }
    if (
      rename.level === "subTopic" &&
      eg.subject === rename.subject &&
      eg.topic === rename.topic &&
      eg.subTopic === rename.subTopic
    ) {
      return { ...eg, subTopic: rename.newName };
    }
    return eg;
  });
}
