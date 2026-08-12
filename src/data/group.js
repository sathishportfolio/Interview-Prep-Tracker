// @ts-check
/**
 * group.js — pure grouping/sorting: Subject → Topic → SubTopic → Question.
 * Tiering within a SubTopic: Starred float to top, LessImportant sink to bottom, ties broken by
 * persisted `order`. Zero DOM, never imports render/persistence.
 * @typedef {import('../types.js').Question} Question
 * @typedef {import('../types.js').EmptyGroup} EmptyGroup
 * @typedef {import('../types.js').GroupedTree} GroupedTree
 */

const EMPTY_ORDER_BASE = 1e9;

/**
 * @param {Question} q
 * @returns {number} 0 = starred (top), 1 = normal, 2 = lessImportant (bottom)
 */
function tierOf(q) {
  if (q.starred) return 0;
  if (q.lessImportant) return 2;
  return 1;
}

/**
 * @param {Question[]} rawData
 * @param {EmptyGroup[]} emptyGroups
 * @returns {GroupedTree}
 */
export function groupData(rawData, emptyGroups) {
  /** @type {Map<string, {subject:string, order:number, topics: Map<string, {topic:string, order:number, subTopics: Map<string, {subTopic:string, order:number, questions: Question[]}>}>}>} */
  const subjectsMap = new Map();

  function ensureSubject(subject, order) {
    let s = subjectsMap.get(subject);
    if (!s) {
      s = { subject, order, topics: new Map() };
      subjectsMap.set(subject, s);
    } else if (order < s.order) {
      s.order = order;
    }
    return s;
  }
  function ensureTopic(s, topic, order) {
    let t = s.topics.get(topic);
    if (!t) {
      t = { topic, order, subTopics: new Map() };
      s.topics.set(topic, t);
    } else if (order < t.order) {
      t.order = order;
    }
    return t;
  }
  function ensureSubTopic(t, subTopic, order) {
    let st = t.subTopics.get(subTopic);
    if (!st) {
      st = { subTopic, order, questions: [] };
      t.subTopics.set(subTopic, st);
    } else if (order < st.order) {
      st.order = order;
    }
    return st;
  }

  for (const q of rawData) {
    const s = ensureSubject(q.subject, q.subjectOrder ?? 0);
    const t = ensureTopic(s, q.topic, q.topicOrder ?? 0);
    const st = ensureSubTopic(t, q.subTopic, q.subTopicOrder ?? 0);
    st.questions.push(q);
  }

  // Merge empty-group placeholders. order: EMPTY_ORDER_BASE + index (sorts after real siblings,
  // preserves creation order among placeholders).
  emptyGroups.forEach((eg, index) => {
    const order = EMPTY_ORDER_BASE + index;
    const s = ensureSubject(eg.subject, subjectsMap.has(eg.subject) ? /** @type {any} */ (subjectsMap.get(eg.subject)).order : order);
    if (eg.topic == null) return; // subject-level marker only
    const t = ensureTopic(s, eg.topic, s.topics.has(eg.topic) ? /** @type {any} */ (s.topics.get(eg.topic)).order : order);
    if (eg.subTopic == null) return; // topic-level marker only
    ensureSubTopic(t, eg.subTopic, t.subTopics.has(eg.subTopic) ? /** @type {any} */ (t.subTopics.get(eg.subTopic)).order : order);
  });

  const subjects = [...subjectsMap.values()]
    .sort((a, b) => a.order - b.order || a.subject.localeCompare(b.subject))
    .map((s) => {
      const topics = [...s.topics.values()]
        .sort((a, b) => a.order - b.order || a.topic.localeCompare(b.topic))
        .map((t) => {
          const subTopics = [...t.subTopics.values()]
            .sort((a, b) => a.order - b.order || a.subTopic.localeCompare(b.subTopic))
            .map((st) => {
              const questions = [...st.questions].sort((a, b) => {
                const ta = tierOf(a);
                const tb = tierOf(b);
                if (ta !== tb) return ta - tb;
                return (a.order ?? 0) - (b.order ?? 0);
              });
              return {
                subject: s.subject,
                topic: t.topic,
                subTopic: st.subTopic,
                isEmpty: questions.length === 0,
                order: st.order,
                questions,
              };
            });
          return {
            subject: s.subject,
            topic: t.topic,
            isEmpty: subTopics.every((st) => st.isEmpty),
            order: t.order,
            subTopics,
          };
        });
      return {
        subject: s.subject,
        isEmpty: topics.every((t) => t.isEmpty),
        order: s.order,
        topics,
      };
    });

  return { subjects };
}

/**
 * Flattens a GroupedTree back to a question array (useful for search/copy scoping).
 * @param {GroupedTree} tree
 * @returns {Question[]}
 */
export function flattenQuestions(tree) {
  /** @type {Question[]} */
  const out = [];
  for (const s of tree.subjects) {
    for (const t of s.topics) {
      for (const st of t.subTopics) {
        out.push(...st.questions);
      }
    }
  }
  return out;
}

/**
 * Flattens a GroupedTree to one "navigable position" per leaf branch, in the same order the tree
 * (and Flatten View — see render/flatRenderer.js's identical subject/topic/subTopic-with-no-children
 * handling) renders in. Most positions are `level: "subTopic"` with a real subTopic and questions,
 * but an empty-group placeholder Subject with no Topics, or a Topic with no SubTopics, has nothing
 * deeper to descend into — those surface as their own `level: "subject"`/`"topic"` position instead
 * of being silently skipped, so the Tab/Shift+Tab SubTopic-navigation shortcuts stop there rather
 * than jumping straight past an empty group to the next one with content.
 * `firstQuestionId`/`lastQuestionId` are only ever non-null for `level: "subTopic"` positions that
 * actually have questions (tiered display order — starred-first, see this module's tierOf).
 * @param {GroupedTree} tree
 * @returns {Array<{level: "subject"|"topic"|"subTopic", subject: string, topic?: string, subTopic?: string, firstQuestionId: string|null, lastQuestionId: string|null}>}
 */
export function flattenNavigablePositions(tree) {
  /** @type {Array<{level: "subject"|"topic"|"subTopic", subject: string, topic?: string, subTopic?: string, firstQuestionId: string|null, lastQuestionId: string|null}>} */
  const out = [];
  for (const s of tree.subjects) {
    if (s.topics.length === 0) {
      out.push({ level: "subject", subject: s.subject, firstQuestionId: null, lastQuestionId: null });
      continue;
    }
    for (const t of s.topics) {
      if (t.subTopics.length === 0) {
        out.push({ level: "topic", subject: s.subject, topic: t.topic, firstQuestionId: null, lastQuestionId: null });
        continue;
      }
      for (const st of t.subTopics) {
        out.push({
          level: "subTopic",
          subject: s.subject,
          topic: t.topic,
          subTopic: st.subTopic,
          firstQuestionId: st.questions[0]?.id ?? null,
          lastQuestionId: st.questions[st.questions.length - 1]?.id ?? null,
        });
      }
    }
  }
  return out;
}
