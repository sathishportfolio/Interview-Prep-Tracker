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
    srsDue: null,
    srsStreak: 0,
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
 * Leitner-style spaced-repetition intervals (days), indexed by consecutive "remembered" streak.
 * The last entry repeats for any streak beyond its length.
 */
const SRS_INTERVAL_DAYS = [1, 2, 4, 7, 14, 30, 60];

/**
 * Adds `days` to an ISO date string, doing the arithmetic in UTC throughout so it matches
 * `referenceDate.toISOString()` (also UTC) regardless of the machine's local timezone.
 * @param {string} iso @param {number} days @returns {string}
 */
function addDaysISO(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Schedules (or reschedules) a question's next spaced-repetition review. "advance" pushes the due
 * date further out and grows the streak (called when a question is marked Done — the user says
 * they know it); "reset" clears the streak and brings the due date back to tomorrow (called when
 * Done is unmarked, or when Review Later is turned on — either way, it needs re-surfacing soon).
 * @param {Question[]} rawData
 * @param {string} questionId
 * @param {"advance"|"reset"} outcome
 * @param {Date} [referenceDate] Injectable for tests; defaults to now.
 * @returns {Question[]}
 */
export function scheduleReview(rawData, questionId, outcome, referenceDate = new Date()) {
  const todayISO = referenceDate.toISOString().slice(0, 10);
  return rawData.map((q) => {
    if (q.id !== questionId) return q;
    if (outcome === "advance") {
      const streak = (q.srsStreak || 0) + 1;
      const days = SRS_INTERVAL_DAYS[Math.min(streak - 1, SRS_INTERVAL_DAYS.length - 1)];
      return { ...q, srsStreak: streak, srsDue: addDaysISO(todayISO, days) };
    }
    return { ...q, srsStreak: 0, srsDue: addDaysISO(todayISO, 1) };
  });
}

/**
 * Resets every question's progress tracking — Done, Review Later, and spaced-repetition scheduling
 * (srsDue/srsStreak) — back to their fresh-question defaults, across the ENTIRE dataset regardless
 * of any active filter. Leaves Starred/LessImportant/Duplicate (organizational flags, not progress)
 * and every Subject/Topic/SubTopic/Question structure untouched — this only clears tracking, it
 * never deletes or moves anything.
 * @param {Question[]} rawData
 * @returns {Question[]}
 */
export function resetProgress(rawData) {
  return rawData.map((q) => ({ ...q, done: false, reviewLater: false, srsDue: null, srsStreak: 0 }));
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
 * Deletes a Subject/Topic/SubTopic AND every question nested underneath it, bypassing deleteGroup's
 * non-empty guard entirely — used by bulk "Delete Selected" when the user has explicitly selected a
 * whole accordion (see features/bulkSelection.js, which confirms the nested question count with the
 * user first, since unlike deleteGroup this is never blocked).
 * @param {DataPair} data
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 * @returns {DataPair}
 */
export function deleteGroupCascade(data, level, scope) {
  const rawData = data.rawData.filter((q) => {
    if (level === "subject") return q.subject !== scope.subject;
    if (level === "topic") return !(q.subject === scope.subject && q.topic === scope.topic);
    return !(q.subject === scope.subject && q.topic === scope.topic && q.subTopic === scope.subTopic);
  });
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
  return { rawData, emptyGroups };
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
 * @param {DataPair} data
 * @param {string} subject
 * @param {string} topic
 * @returns {string[]} Every distinct SubTopic name under this Topic, whether it has real questions
 *   or is only an empty-group placeholder — both kinds must move together with the Topic.
 */
function subTopicNamesUnder(data, subject, topic) {
  const fromRows = data.rawData.filter((q) => q.subject === subject && q.topic === topic).map((q) => q.subTopic);
  const fromEmpty = data.emptyGroups
    .filter((eg) => eg.subject === subject && eg.topic === topic && eg.subTopic != null)
    .map((eg) => /** @type {string} */ (eg.subTopic));
  return [...new Set([...fromRows, ...fromEmpty])];
}

/**
 * Moves one SubTopic (by name) to a new Subject/Topic parent, preserving its own name. If it has
 * real questions, delegates to moveQuestions (which already merges into a same-named destination
 * SubTopic, or creates one, purely by string match — see group.js) — except moveQuestions' own
 * "mark the vacated source empty" bookkeeping is right for *its* use case (moving individual
 * questions out, where the SubTopic itself should stick around as a visible "(empty)" placeholder)
 * but wrong for this one: moving the WHOLE SubTopic away should leave nothing behind at the source
 * at all, so that placeholder is stripped back off immediately after. If it's a placeholder with no
 * questions yet, transfers the empty-group marker directly instead (never creating one behind it).
 * @param {DataPair} data
 * @param {{subject: string, topic: string, subTopic: string}} source
 * @param {string} destSubject
 * @param {string} destTopic
 * @returns {DataPair}
 */
function moveSubTopicInto(data, source, destSubject, destTopic) {
  if (source.subject === destSubject && source.topic === destTopic) return data; // dropped onto its own parent
  const ids = data.rawData
    .filter((q) => q.subject === source.subject && q.topic === source.topic && q.subTopic === source.subTopic)
    .map((q) => q.id);
  if (ids.length > 0) {
    const moved = moveQuestions(data, ids, { subject: destSubject, topic: destTopic, subTopic: source.subTopic });
    const emptyGroups = unmarkGroupEmpty(moved.emptyGroups, source.subject, source.topic, source.subTopic);
    return { rawData: moved.rawData, emptyGroups };
  }
  let emptyGroups = unmarkGroupEmpty(data.emptyGroups, source.subject, source.topic, source.subTopic);
  emptyGroups = markGroupEmpty(emptyGroups, destSubject, destTopic, source.subTopic);
  emptyGroups = pruneEmptyGroups(emptyGroups, data.rawData);
  return { rawData: data.rawData, emptyGroups };
}

/**
 * Moves one Topic (by name), with every SubTopic and question underneath it, to a new Subject,
 * preserving its own name. Each child SubTopic is moved individually via moveSubTopicInto so it
 * merges into (or creates) a same-named SubTopic at the destination Topic exactly as a direct
 * SubTopic-level move would; a wholly-empty Topic (no SubTopics at all yet) transfers its own
 * topic-level placeholder marker directly.
 * @param {DataPair} data
 * @param {{subject: string, topic: string}} source
 * @param {string} destSubject
 * @returns {DataPair}
 */
function moveTopicInto(data, source, destSubject) {
  if (source.subject === destSubject) return data; // dropped onto its own parent
  let acc = data;
  for (const subTopic of subTopicNamesUnder(acc, source.subject, source.topic)) {
    acc = moveSubTopicInto(acc, { subject: source.subject, topic: source.topic, subTopic }, destSubject, source.topic);
  }
  const hasTopicPlaceholder = acc.emptyGroups.some(
    (eg) => eg.subject === source.subject && eg.topic === source.topic && eg.subTopic == null
  );
  if (hasTopicPlaceholder) {
    let emptyGroups = unmarkGroupEmpty(acc.emptyGroups, source.subject, source.topic, null);
    emptyGroups = markGroupEmpty(emptyGroups, destSubject, source.topic, null);
    emptyGroups = pruneEmptyGroups(emptyGroups, acc.rawData);
    acc = { rawData: acc.rawData, emptyGroups };
  }
  return acc;
}

/**
 * @param {DataPair} data
 * @param {string} subject
 * @returns {string[]} Every distinct Topic name under this Subject, whether it has real questions,
 *   sub-placeholders, or is only a topic-level empty-group placeholder itself.
 */
function topicNamesUnder(data, subject) {
  const fromRows = data.rawData.filter((q) => q.subject === subject).map((q) => q.topic);
  const fromEmpty = data.emptyGroups.filter((eg) => eg.subject === subject && eg.topic != null).map((eg) => /** @type {string} */ (eg.topic));
  return [...new Set([...fromRows, ...fromEmpty])];
}

/**
 * Merges one Subject entirely into another (there's no "preserve the source Subject's own name"
 * case the way Topic/SubTopic moves have — merging IS the operation, since a Subject has no parent
 * to relocate within). Every child Topic is moved individually via moveTopicInto so it merges into
 * (or creates) a same-named Topic at the destination Subject; a wholly-empty source Subject (no
 * Topics at all) transfers its own subject-level placeholder marker directly.
 * @param {DataPair} data
 * @param {string} sourceSubject
 * @param {string} destSubject
 * @returns {DataPair}
 */
function moveSubjectInto(data, sourceSubject, destSubject) {
  if (sourceSubject === destSubject) return data;
  let acc = data;
  for (const topic of topicNamesUnder(acc, sourceSubject)) {
    acc = moveTopicInto(acc, { subject: sourceSubject, topic }, destSubject);
  }
  const hasSubjectPlaceholder = acc.emptyGroups.some((eg) => eg.subject === sourceSubject && eg.topic == null);
  if (hasSubjectPlaceholder) {
    let emptyGroups = unmarkGroupEmpty(acc.emptyGroups, sourceSubject, null, null);
    emptyGroups = markGroupEmpty(emptyGroups, destSubject, null, null);
    emptyGroups = pruneEmptyGroups(emptyGroups, acc.rawData);
    acc = { rawData: acc.rawData, emptyGroups };
  }
  return acc;
}

/**
 * Moves an entire Subject/Topic/SubTopic — with every child Topic/SubTopic/Question underneath it —
 * to (or, for "subject", into) a new parent, preserving its own name where it has one and merging
 * into an identically-named sibling that already exists at the destination (both purely via
 * group.js's string-keyed bucketing, same as moveQuestions). Used by drag-and-drop (a SubTopic
 * dropped on a Topic/Subject accordion, a Topic dropped on a Subject accordion — see
 * features/dragDrop.js) and by the bulk "Move Selected" flow for whole-group selections.
 * @param {DataPair} data
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope Source group being moved.
 * @param {{subject: string, topic?: string}} destination New parent — `topic` is required when
 *   `level` is "subTopic" (the SubTopic's own name is preserved, not overridden here); for
 *   `level: "subject"`, `destination.subject` is the Subject being merged into.
 * @returns {DataPair}
 */
export function moveGroup(data, level, scope, destination) {
  if (level === "subject") {
    return moveSubjectInto(data, scope.subject, destination.subject);
  }
  if (level === "subTopic") {
    return moveSubTopicInto(
      data,
      { subject: scope.subject, topic: /** @type {string} */ (scope.topic), subTopic: /** @type {string} */ (scope.subTopic) },
      destination.subject,
      /** @type {string} */ (destination.topic)
    );
  }
  return moveTopicInto(data, { subject: scope.subject, topic: /** @type {string} */ (scope.topic) }, destination.subject);
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
