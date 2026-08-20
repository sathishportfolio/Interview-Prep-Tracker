// @ts-check
/**
 * mutations.js — the ONLY place that mutates {rawData, emptyGroups}. Every function is pure:
 * takes the current pair (+ args), returns a NEW pair (or an {ok:false} result for blocked ops).
 * Never touches DOM/persistence/render. Consumers (features/*) call these, then hand the results
 * to render's patch API and persistence's store.
 * @typedef {import('../types.js').Question} Question
 * @typedef {import('../types.js').EmptyGroup} EmptyGroup
 * @typedef {import('../types.js').Tombstone} Tombstone
 */
import { newQuestionId } from "./id.js";
import { nextQuestionOrder, nextGroupOrder } from "./order.js";
import { markGroupEmpty, unmarkGroupEmpty, pruneEmptyGroups, renameInEmptyGroups, markGroupsNotImportant } from "./emptyGroups.js";
import { toTitleCase } from "./textCase.js";

/** @typedef {{rawData: Question[], emptyGroups: EmptyGroup[]}} DataPair */
/** @typedef {{rawData: Question[], emptyGroups: EmptyGroup[], tombstones: Tombstone[]}} DataPairWithTombstones */

/**
 * Upserts a tombstone for `id` into `tombstones` — replaces an existing entry for the same id
 * (e.g. a re-delete after an undo/redo round-trip) rather than accumulating duplicates.
 * @param {Tombstone[]} tombstones
 * @param {string} id
 * @param {number} deletedAt
 * @returns {Tombstone[]}
 */
function upsertTombstone(tombstones, id, deletedAt) {
  return [...tombstones.filter((t) => t.id !== id), { id, deletedAt }];
}

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
 *   done?: boolean, reviewLater?: boolean, duplicate?: boolean, notImportant?: boolean, starred?: boolean, failed?: boolean, visited?: boolean,
 *   difficulty?: "easy"|"medium"|"hard"|null, tags?: string[]}} input
 * @returns {DataPair & {question: Question}}
 */
export function addQuestion(data, input) {
  const subject = toTitleCase(input.subject);
  const topic = toTitleCase(input.topic);
  const subTopic = toTitleCase(input.subTopic);
  const order = nextQuestionOrder(data.rawData, subject, topic, subTopic);
  const subjectOrder = nextGroupOrder(data.rawData, "subject");
  const topicOrder = nextGroupOrder(data.rawData, "topic", { subject });
  const subTopicOrder = nextGroupOrder(data.rawData, "subTopic", { subject, topic });

  const existing = data.rawData.find(
    (q) => q.subject === subject && q.topic === topic && q.subTopic === subTopic
  );

  const newQuestion = {
    id: newQuestionId(),
    subject,
    topic,
    subTopic,
    question: input.question,
    answer: input.answer || "",
    done: !!input.done,
    reviewLater: !!input.reviewLater,
    duplicate: !!input.duplicate,
    notImportant: !!input.notImportant,
    starred: !!input.starred,
    failed: !!input.failed,
    visited: !!input.visited,
    difficulty: input.difficulty ?? null,
    order,
    subjectOrder: existing ? existing.subjectOrder : subjectOrder,
    topicOrder: existing ? existing.topicOrder : topicOrder,
    subTopicOrder: existing ? existing.subTopicOrder : subTopicOrder,
    srsDue: null,
    srsStreak: 0,
    doneCount: 0,
    doneHistory: [],
    tags: input.tags ?? [],
    updatedAt: Date.now(),
  };

  const rawData = [...data.rawData, newQuestion];
  let emptyGroups = unmarkGroupEmpty(data.emptyGroups, subject, topic, subTopic);
  emptyGroups = unmarkGroupEmpty(emptyGroups, subject, topic, null);
  emptyGroups = unmarkGroupEmpty(emptyGroups, subject, null, null);
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
  return rawData.map((q) => (q.id === questionId ? { ...q, ...patch, updatedAt: Date.now() } : q));
}

/**
 * @param {Question[]} rawData
 * @param {string} questionId
 * @param {"done"|"reviewLater"|"duplicate"|"notImportant"|"starred"|"failed"|"visited"} flag
 * @returns {Question[]}
 */
export function toggleStatusFlag(rawData, questionId, flag) {
  return rawData.map((q) => (q.id === questionId ? { ...q, [flag]: !q[flag], updatedAt: Date.now() } : q));
}

/**
 * Sets a question's Done/Failed/Review Later to exactly one of the three (clearing the other two),
 * or clears all three when `flag` is null. These are mutually exclusive — a question can't be "I
 * know this" and "I got this wrong" and "I need to review this" at once.
 * @param {Question[]} rawData
 * @param {string} questionId
 * @param {"done"|"failed"|"reviewLater"|null} flag
 * @returns {Question[]}
 */
export function setTriStatusFlag(rawData, questionId, flag) {
  return rawData.map((q) =>
    q.id === questionId
      ? { ...q, done: flag === "done", failed: flag === "failed", reviewLater: flag === "reviewLater", updatedAt: Date.now() }
      : q
  );
}

/**
 * Marks a question Done via the Done menu ("Mark Done"/"Mark Done with Notes"): sets the tri-state
 * to Done (clearing Failed/Review Later, same as setTriStatusFlag), increments `doneCount`, and
 * appends a timestamped entry to `doneHistory`. Unlike the plain tri-state toggle, this ALWAYS
 * records a fresh entry — even if the question was already Done — so repeat review passes each get
 * their own counted, timestamped mark.
 * @param {Question[]} rawData
 * @param {string} questionId
 * @param {string} [note]
 * @returns {Question[]}
 */
export function markDone(rawData, questionId, note) {
  return rawData.map((q) =>
    q.id === questionId
      ? {
          ...q,
          done: true,
          failed: false,
          reviewLater: false,
          doneCount: (q.doneCount ?? 0) + 1,
          doneHistory: [...(q.doneHistory ?? []), { ts: Date.now(), ...(note ? { note } : {}) }],
          updatedAt: Date.now(),
        }
      : q
  );
}

/**
 * Resets a question's Done counter/timeline entirely, per the Ctrl+click/long-press "reset" gesture
 * on the Done button (feature layer confirms with the user first — see features/statusFlags.js).
 * Also clears the Done flag itself, mirroring unmarking Done today.
 * @param {Question[]} rawData
 * @param {string} questionId
 * @returns {Question[]}
 */
export function resetDoneHistory(rawData, questionId) {
  return rawData.map((q) => (q.id === questionId ? { ...q, done: false, doneCount: 0, doneHistory: [], updatedAt: Date.now() } : q));
}

/**
 * Adds or removes one tag on a single question (question-level side of the Tags feature — the
 * global tag registry itself lives on appState.globalTags/StorageSchemaV1.globalTags, not here).
 * @param {Question[]} rawData
 * @param {string} questionId
 * @param {string} tag
 * @returns {Question[]}
 */
export function toggleQuestionTag(rawData, questionId, tag) {
  return rawData.map((q) => {
    if (q.id !== questionId) return q;
    const tags = q.tags ?? [];
    return { ...q, tags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag], updatedAt: Date.now() };
  });
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
      return { ...q, srsStreak: streak, srsDue: addDaysISO(todayISO, days), updatedAt: Date.now() };
    }
    return { ...q, srsStreak: 0, srsDue: addDaysISO(todayISO, 1), updatedAt: Date.now() };
  });
}

/**
 * Resets progress tracking — Done, Review Later, Visited, spaced-repetition scheduling (srsDue/
 * srsStreak), and the Done History timeline (doneCount/doneHistory, see markDone/resetDoneHistory)
 * — back to fresh-question defaults. Leaves Starred/NotImportant/Duplicate/Difficulty (organizational
 * flags, not progress) and every Subject/Topic/SubTopic/Question structure untouched — this only
 * clears tracking, it never deletes or moves anything.
 * @param {Question[]} rawData
 * @param {string[]} [questionIds] Restricts the reset to just these question ids — the currently
 *   filtered/visible set (see app.js's Reset Progress handler, which passes
 *   `flattenQuestions(appState.grouped).map(q => q.id)`). Omitted/undefined resets every question in
 *   `rawData` regardless of any active filter, same as before this parameter existed.
 * @returns {Question[]}
 */
export function resetProgress(rawData, questionIds) {
  const idSet = questionIds ? new Set(questionIds) : null;
  return rawData.map((q) =>
    !idSet || idSet.has(q.id)
      ? { ...q, done: false, reviewLater: false, visited: false, srsDue: null, srsStreak: 0, doneCount: 0, doneHistory: [], updatedAt: Date.now() }
      : q
  );
}

/**
 * Deletes a single question, marking its SubTopic empty if it was the last question there, and
 * recording a tombstone (see data/syncMerge.js) so a pull-merge from a device that never saw this
 * delete doesn't resurrect the question.
 * @param {DataPairWithTombstones} data
 * @param {string} questionId
 * @returns {DataPairWithTombstones}
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
  const tombstones = upsertTombstone(data.tombstones, questionId, Date.now());
  return { rawData, emptyGroups, tombstones };
}

/**
 * Deletes multiple questions in one pass (bulk delete of a selection).
 * @param {DataPairWithTombstones} data
 * @param {string[]} questionIds
 * @returns {DataPairWithTombstones}
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
  newName = toTitleCase(newName);
  const now = Date.now();
  const rawData = data.rawData.map((q) => {
    if (level === "subject" && q.subject === scope.subject) {
      return { ...q, subject: newName, updatedAt: now };
    }
    if (level === "topic" && q.subject === scope.subject && q.topic === scope.topic) {
      return { ...q, topic: newName, updatedAt: now };
    }
    if (
      level === "subTopic" &&
      q.subject === scope.subject &&
      q.topic === scope.topic &&
      q.subTopic === scope.subTopic
    ) {
      return { ...q, subTopic: newName, updatedAt: now };
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
 * Sets Not Important on/off for a whole Subject/Topic/SubTopic, cascading onto every question
 * underneath (and any matching empty-group placeholder) — the same scope-match cascade renameGroup
 * uses. Never touches order/visibility, only the `notImportant` label.
 * @param {DataPair} data
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 * @param {boolean} value
 * @returns {DataPair}
 */
export function setGroupNotImportant(data, level, scope, value) {
  return applyPatchToSelection(data, [{ level, scope }], [], { notImportant: value });
}

/**
 * Cascades a patch (e.g. `{notImportant: true}` or `{difficulty: "hard"}`) onto every question under
 * each selected Subject/Topic/SubTopic group, plus every explicitly selected question id — the
 * shared primitive behind setGroupNotImportant, the Difficulty bulk action, and any future bulk
 * per-selection edit (see features/bulkSelection.js's getSelection()). `notImportant` patches also
 * cascade onto matching EmptyGroup placeholders (see data/emptyGroups.js's markGroupsNotImportant)
 * since a childless group has no question row to carry the flag on.
 * @param {DataPair} data
 * @param {{level: "subject"|"topic"|"subTopic", scope: {subject: string, topic?: string, subTopic?: string}}[]} groups
 * @param {string[]} questionIds
 * @param {Partial<Question>} patch
 * @returns {DataPair}
 */
export function applyPatchToSelection(data, groups, questionIds, patch) {
  const idSet = new Set(questionIds);
  const matchesAnyGroup = (q) =>
    groups.some(({ level, scope }) => {
      if (level === "subject") return q.subject === scope.subject;
      if (level === "topic") return q.subject === scope.subject && q.topic === scope.topic;
      return q.subject === scope.subject && q.topic === scope.topic && q.subTopic === scope.subTopic;
    });
  const rawData = data.rawData.map((q) => (idSet.has(q.id) || matchesAnyGroup(q) ? { ...q, ...patch, updatedAt: Date.now() } : q));

  let emptyGroups = data.emptyGroups;
  if ("notImportant" in patch) {
    for (const { level, scope } of groups) {
      emptyGroups = markGroupsNotImportant(emptyGroups, level, scope, !!patch.notImportant);
    }
  }
  return { rawData, emptyGroups };
}

/**
 * Sets Difficulty for a batch of question ids (bulk action across a multi-selection).
 * @param {Question[]} rawData
 * @param {string[]} questionIds
 * @param {"easy"|"medium"|"hard"|null} difficulty
 * @returns {Question[]}
 */
export function setDifficultyForQuestions(rawData, questionIds, difficulty) {
  const idSet = new Set(questionIds);
  return rawData.map((q) => (idSet.has(q.id) ? { ...q, difficulty, updatedAt: Date.now() } : q));
}

/**
 * One-time migration: older persisted data has `lessImportant` (this field's previous name) but no
 * `notImportant` yet — copies it over so existing marks survive the rename instead of silently
 * reading as unmarked. No-ops (returns {changed: false}, same object references) once every question
 * already has `notImportant` set. See features/fileManager.js's bootstrapFromStorage, called the same
 * way as data/answerFormat.js's minifyAllAnswers.
 * @param {Question[]} rawData
 * @returns {{rawData: Question[], changed: boolean}}
 */
export function migrateLessImportantToNotImportant(rawData) {
  let changed = false;
  const next = rawData.map((q) => {
    const anyQ = /** @type {any} */ (q);
    if (anyQ.notImportant !== undefined || anyQ.lessImportant === undefined) return q;
    changed = true;
    const { lessImportant, ...rest } = anyQ;
    return { ...rest, notImportant: !!lessImportant };
  });
  return { rawData: next, changed };
}

/**
 * One-time migration: normalizes every Subject/Topic/SubTopic name (on both questions and
 * empty-group placeholders) to Title Case, so data imported/typed before this normalization
 * existed reads consistently with everything created afterward. No-ops (same object references)
 * once every name is already title-cased.
 * @param {Question[]} rawData
 * @param {EmptyGroup[]} emptyGroups
 * @returns {{rawData: Question[], emptyGroups: EmptyGroup[], changed: boolean}}
 */
export function migrateGroupNamesToTitleCase(rawData, emptyGroups) {
  let changed = false;
  const next = rawData.map((q) => {
    const subject = toTitleCase(q.subject);
    const topic = toTitleCase(q.topic);
    const subTopic = toTitleCase(q.subTopic);
    if (subject === q.subject && topic === q.topic && subTopic === q.subTopic) return q;
    changed = true;
    return { ...q, subject, topic, subTopic };
  });
  const nextEmptyGroups = emptyGroups.map((eg) => {
    const subject = toTitleCase(eg.subject);
    const topic = eg.topic != null ? toTitleCase(eg.topic) : eg.topic;
    const subTopic = eg.subTopic != null ? toTitleCase(eg.subTopic) : eg.subTopic;
    if (subject === eg.subject && topic === eg.topic && subTopic === eg.subTopic) return eg;
    changed = true;
    return { ...eg, subject, topic, subTopic };
  });
  return { rawData: next, emptyGroups: nextEmptyGroups, changed };
}

/**
 * One-time migration/backfill: a question already marked Done before per-review-pass tracking
 * (doneCount/doneHistory) existed has done=true but doneCount=0 and no history entry — this stamps
 * exactly one "today" entry onto it, matching what a fresh Mark Done would have recorded, rather
 * than leaving it looking like it's never been reviewed. No-ops (same object references) once every
 * Done question already has at least one doneHistory entry.
 * @param {Question[]} rawData
 * @param {Date} [referenceDate] Injectable for tests; defaults to now.
 * @returns {{rawData: Question[], changed: boolean}}
 */
export function backfillDoneTracking(rawData, referenceDate = new Date()) {
  let changed = false;
  const next = rawData.map((q) => {
    if (!q.done || (q.doneHistory && q.doneHistory.length > 0)) return q;
    changed = true;
    return { ...q, doneCount: q.doneCount && q.doneCount > 0 ? q.doneCount : 1, doneHistory: [{ ts: referenceDate.getTime() }] };
  });
  return { rawData: next, changed };
}

/**
 * One-time migration/backfill: a question persisted before per-question `updatedAt` existed has no
 * timestamp at all — stamps it with "now" (NOT a backdated/zero value). Backdating would make every
 * pre-migration question always LOSE any future sync-merge comparison (data/syncMerge.js) against
 * literally any edit made anywhere after upgrade, even a trivial no-op re-save — silently discarding
 * pre-existing data on the very first post-upgrade sync on any device. Stamping "now" is the
 * conservative, non-destructive default. No-ops (same object references) once every question already
 * has `updatedAt`.
 * @param {Question[]} rawData
 * @param {Date} [referenceDate] Injectable for tests; defaults to now.
 * @returns {{rawData: Question[], changed: boolean}}
 */
export function backfillUpdatedAt(rawData, referenceDate = new Date()) {
  let changed = false;
  const next = rawData.map((q) => {
    if (typeof q.updatedAt === "number") return q;
    changed = true;
    return { ...q, updatedAt: referenceDate.getTime() };
  });
  return { rawData: next, changed };
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
 * user first, since unlike deleteGroup this is never blocked). Records a tombstone for every deleted
 * question id (see deleteQuestion).
 * @param {DataPairWithTombstones} data
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 * @returns {DataPairWithTombstones}
 */
export function deleteGroupCascade(data, level, scope) {
  const matches = (q) => {
    if (level === "subject") return q.subject === scope.subject;
    if (level === "topic") return q.subject === scope.subject && q.topic === scope.topic;
    return q.subject === scope.subject && q.topic === scope.topic && q.subTopic === scope.subTopic;
  };
  const now = Date.now();
  let tombstones = data.tombstones;
  for (const q of data.rawData) {
    if (matches(q)) tombstones = upsertTombstone(tombstones, q.id, now);
  }
  const rawData = data.rawData.filter((q) => !matches(q));
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
  return { rawData, emptyGroups, tombstones };
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
  const now = Date.now();
  const rawData = data.rawData.map((q) => {
    if (!idSet.has(q.id)) return q;
    const updated = { ...q, subject: destination.subject, topic: destination.topic, subTopic: destination.subTopic, order: nextOrder, updatedAt: now };
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
    toTitleCase(scope.subject),
    level === "subject" ? null : toTitleCase(scope.topic),
    level === "subTopic" ? toTitleCase(scope.subTopic) : null
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
        notImportant: row.notImportant,
        starred: row.starred,
        failed: row.failed,
        visited: row.visited,
        difficulty: row.difficulty ?? null,
        updatedAt: Date.now(),
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
