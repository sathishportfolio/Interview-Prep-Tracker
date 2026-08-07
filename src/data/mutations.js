// @ts-check
/**
 * mutations.js — the ONLY place that mutates {rawData, emptyGroups}. Every function is pure:
 * takes the current pair (+ args), returns a NEW pair (or an {ok:false} result for blocked ops).
 * Never touches DOM/persistence/render. Consumers (features/*) call these, then hand the results
 * to render's patch API and persistence's store.
 * @typedef {import('../types.js').Question} Question
 * @typedef {import('../types.js').EmptyGroup} EmptyGroup
 */
import { newQuestionId } from "./id.js";
import { nextQuestionOrder, nextGroupOrder } from "./order.js";
import { markGroupEmpty, unmarkGroupEmpty, pruneEmptyGroups, renameInEmptyGroups } from "./emptyGroups.js";

/** @typedef {{rawData: Question[], emptyGroups: EmptyGroup[]}} DataPair */

/**
 * @param {Question[]} rawData
 * @param {string} subject
 * @param {string} topic
 * @param {string} subTopic
 * @param {string} questionText
 * @returns {boolean}
 */
export function questionExists(rawData, subject, topic, subTopic, questionText) {
  const norm = (s) => (s || "").trim().toLowerCase();
  return rawData.some(
    (q) =>
      norm(q.subject) === norm(subject) &&
      norm(q.topic) === norm(topic) &&
      norm(q.subTopic) === norm(subTopic) &&
      norm(q.question) === norm(questionText)
  );
}

/**
 * @param {DataPair} data
 * @param {{subject: string, topic: string, subTopic: string, question: string, answer?: string,
 *   done?: boolean, reviewLater?: boolean, duplicate?: boolean, lessImportant?: boolean, starred?: boolean}} input
 * @returns {DataPair & {question: Question}}
 */
export function addQuestion(data, input) {
  const order = nextQuestionOrder(data.rawData, input.subject, input.topic, input.subTopic);
  const subjectOrder = nextGroupOrder(data.rawData, "subject");
  const topicOrder = nextGroupOrder(data.rawData, "topic", { subject: input.subject });
  const subTopicOrder = nextGroupOrder(data.rawData, "subTopic", { subject: input.subject, topic: input.topic });

  const existing = data.rawData.find(
    (q) => q.subject === input.subject && q.topic === input.topic && q.subTopic === input.subTopic
  );

  const newQuestion = {
    id: newQuestionId(),
    subject: input.subject,
    topic: input.topic,
    subTopic: input.subTopic,
    question: input.question,
    answer: input.answer || "",
    done: !!input.done,
    reviewLater: !!input.reviewLater,
    duplicate: !!input.duplicate,
    lessImportant: !!input.lessImportant,
    starred: !!input.starred,
    order,
    subjectOrder: existing ? existing.subjectOrder : subjectOrder,
    topicOrder: existing ? existing.topicOrder : topicOrder,
    subTopicOrder: existing ? existing.subTopicOrder : subTopicOrder,
  };

  const rawData = [...data.rawData, newQuestion];
  let emptyGroups = unmarkGroupEmpty(data.emptyGroups, input.subject, input.topic, input.subTopic);
  emptyGroups = unmarkGroupEmpty(emptyGroups, input.subject, input.topic, null);
  emptyGroups = unmarkGroupEmpty(emptyGroups, input.subject, null, null);
  emptyGroups = pruneEmptyGroups(emptyGroups, rawData);
  return { rawData, emptyGroups, question: newQuestion };
}

/**
 * @param {Question[]} rawData
 * @param {string} questionId
 * @param {Partial<Question>} patch
 * @returns {Question[]}
 */
export function updateQuestion(rawData, questionId, patch) {
  return rawData.map((q) => (q.id === questionId ? { ...q, ...patch } : q));
}

/**
 * @param {Question[]} rawData
 * @param {string} questionId
 * @param {"done"|"reviewLater"|"duplicate"|"lessImportant"|"starred"} flag
 * @returns {Question[]}
 */
export function toggleStatusFlag(rawData, questionId, flag) {
  return rawData.map((q) => (q.id === questionId ? { ...q, [flag]: !q[flag] } : q));
}

/**
 * Deletes a single question, marking its SubTopic empty if it was the last question there.
 * @param {DataPair} data
 * @param {string} questionId
 * @returns {DataPair}
 */
export function deleteQuestion(data, questionId) {
  const target = data.rawData.find((q) => q.id === questionId);
  if (!target) return data;
  const rawData = data.rawData.filter((q) => q.id !== questionId);
  const stillHasSiblings = rawData.some(
    (q) => q.subject === target.subject && q.topic === target.topic && q.subTopic === target.subTopic
  );
  let emptyGroups = data.emptyGroups;
  if (!stillHasSiblings) {
    emptyGroups = markGroupEmpty(emptyGroups, target.subject, target.topic, target.subTopic);
  }
  return { rawData, emptyGroups };
}

/**
 * Deletes multiple questions in one pass (bulk delete of a selection).
 * @param {DataPair} data
 * @param {string[]} questionIds
 * @returns {DataPair}
 */
export function deleteQuestions(data, questionIds) {
  return questionIds.reduce((acc, id) => deleteQuestion(acc, id), data);
}

/**
 * Renames a Subject/Topic/SubTopic in place, cascading to every question underneath and any
 * matching empty-group placeholder.
 * @param {DataPair} data
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 * @param {string} newName
 * @returns {DataPair}
 */
export function renameGroup(data, level, scope, newName) {
  const rawData = data.rawData.map((q) => {
    if (level === "subject" && q.subject === scope.subject) {
      return { ...q, subject: newName };
    }
    if (level === "topic" && q.subject === scope.subject && q.topic === scope.topic) {
      return { ...q, topic: newName };
    }
    if (
      level === "subTopic" &&
      q.subject === scope.subject &&
      q.topic === scope.topic &&
      q.subTopic === scope.subTopic
    ) {
      return { ...q, subTopic: newName };
    }
    return q;
  });
  const emptyGroups = renameInEmptyGroups(data.emptyGroups, {
    level,
    subject: scope.subject,
    topic: scope.topic,
    subTopic: scope.subTopic,
    newName,
  });
  return { rawData, emptyGroups };
}

/**
 * Counts questions under a Subject/Topic/SubTopic scope (used to block delete-while-nonempty).
 * @param {Question[]} rawData
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 * @returns {number}
 */
export function countQuestionsIn(rawData, level, scope) {
  return rawData.filter((q) => {
    if (level === "subject") return q.subject === scope.subject;
    if (level === "topic") return q.subject === scope.subject && q.topic === scope.topic;
    return q.subject === scope.subject && q.topic === scope.topic && q.subTopic === scope.subTopic;
  }).length;
}

/**
 * Deletes an empty Subject/Topic/SubTopic. Blocked (returns {ok:false}) if it still has questions.
 * @param {DataPair} data
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 * @returns {{ok: true, rawData: Question[], emptyGroups: EmptyGroup[]} | {ok: false, error: string}}
 */
export function deleteGroup(data, level, scope) {
  const count = countQuestionsIn(data.rawData, level, scope);
  if (count > 0) {
    return { ok: false, error: `Cannot delete: this ${level} still contains ${count} question(s). Move or delete them first.` };
  }
  let emptyGroups;
  if (level === "subject") {
    emptyGroups = data.emptyGroups.filter((eg) => eg.subject !== scope.subject);
  } else if (level === "topic") {
    emptyGroups = data.emptyGroups.filter((eg) => !(eg.subject === scope.subject && eg.topic === scope.topic));
  } else {
    emptyGroups = data.emptyGroups.filter(
      (eg) => !(eg.subject === scope.subject && eg.topic === scope.topic && eg.subTopic === scope.subTopic)
    );
  }
  return { ok: true, rawData: data.rawData, emptyGroups };
}

/**
 * Moves one or more questions to a new Subject/Topic/SubTopic destination. Marks any source
 * SubTopic empty if it becomes empty; unmarks/consumes a destination empty-group marker if present.
 * @param {DataPair} data
 * @param {string[]} questionIds
 * @param {{subject: string, topic: string, subTopic: string}} destination
 * @returns {DataPair}
 */
export function moveQuestions(data, questionIds, destination) {
  const idSet = new Set(questionIds);
  const movingSources = new Set();
  data.rawData.forEach((q) => {
    if (idSet.has(q.id)) movingSources.add(`${q.subject} ${q.topic} ${q.subTopic}`);
  });

  let nextOrder = nextQuestionOrder(data.rawData, destination.subject, destination.topic, destination.subTopic);
  const rawData = data.rawData.map((q) => {
    if (!idSet.has(q.id)) return q;
    const updated = { ...q, subject: destination.subject, topic: destination.topic, subTopic: destination.subTopic, order: nextOrder };
    nextOrder += 1;
    return updated;
  });

  let emptyGroups = data.emptyGroups;
  for (const key of movingSources) {
    const [subject, topic, subTopic] = key.split(" ");
    const stillHas = rawData.some((q) => q.subject === subject && q.topic === topic && q.subTopic === subTopic);
    if (!stillHas) {
      emptyGroups = markGroupEmpty(emptyGroups, subject, topic, subTopic);
    }
  }
  emptyGroups = unmarkGroupEmpty(emptyGroups, destination.subject, destination.topic, destination.subTopic);
  emptyGroups = pruneEmptyGroups(emptyGroups, rawData);

  return { rawData, emptyGroups };
}

/**
 * Creates a brand-new empty Subject/Topic/SubTopic placeholder (Quick Add / "+ Add New" pickers).
 * @param {DataPair} data
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 * @returns {DataPair}
 */
export function createEmptyGroup(data, level, scope) {
  const emptyGroups = markGroupEmpty(
    data.emptyGroups,
    scope.subject,
    level === "subject" ? null : scope.topic,
    level === "subTopic" ? scope.subTopic : null
  );
  return { rawData: data.rawData, emptyGroups };
}

/**
 * Bulk Add: one question created per row; rows matching an existing question (case-insensitive,
 * Subject+Topic+SubTopic+Question) are silently skipped; rows missing hierarchy or question text
 * are ignored. Returns a summary for the result panel.
 * @param {DataPair} data
 * @param {import('./csv/bulkCsv.js').BulkRow[]} rows
 * @returns {DataPair & {summary: {added: number, skippedDuplicate: number, skippedInvalid: number}}}
 */
export function bulkAddRows(data, rows) {
  let acc = data;
  let added = 0;
  let skippedDuplicate = 0;
  let skippedInvalid = 0;

  for (const row of rows) {
    if (!row.subject || !row.topic || !row.subTopic || !row.question) {
      skippedInvalid += 1;
      continue;
    }
    if (questionExists(acc.rawData, row.subject, row.topic, row.subTopic, row.question)) {
      skippedDuplicate += 1;
      continue;
    }
    const result = addQuestion(acc, row);
    acc = { rawData: result.rawData, emptyGroups: result.emptyGroups };
    added += 1;
  }

  return { ...acc, summary: { added, skippedDuplicate, skippedInvalid } };
}

/**
 * Bulk Update: matches each row against an existing question by Subject+Topic+SubTopic+Question
 * (case-insensitive) and overwrites its answer + status flags; unmatched rows are added as new
 * questions instead (nothing pasted is silently dropped).
 * @param {DataPair} data
 * @param {import('./csv/bulkCsv.js').BulkRow[]} rows
 * @returns {DataPair & {summary: {updated: number, added: number, skippedInvalid: number}}}
 */
export function bulkUpdateRows(data, rows) {
  let rawData = [...data.rawData];
  let emptyGroups = data.emptyGroups;
  let updated = 0;
  let added = 0;
  let skippedInvalid = 0;
  const norm = (s) => (s || "").trim().toLowerCase();

  for (const row of rows) {
    if (!row.subject || !row.topic || !row.subTopic || !row.question) {
      skippedInvalid += 1;
      continue;
    }
    const idx = rawData.findIndex(
      (q) =>
        norm(q.subject) === norm(row.subject) &&
        norm(q.topic) === norm(row.topic) &&
        norm(q.subTopic) === norm(row.subTopic) &&
        norm(q.question) === norm(row.question)
    );
    if (idx >= 0) {
      rawData[idx] = {
        ...rawData[idx],
        answer: row.answer,
        done: row.done,
        reviewLater: row.reviewLater,
        duplicate: row.duplicate,
        lessImportant: row.lessImportant,
        starred: row.starred,
      };
      updated += 1;
    } else {
      const result = addQuestion({ rawData, emptyGroups }, row);
      rawData = result.rawData;
      emptyGroups = result.emptyGroups;
      added += 1;
    }
  }

  return { rawData, emptyGroups, summary: { updated, added, skippedInvalid } };
}
