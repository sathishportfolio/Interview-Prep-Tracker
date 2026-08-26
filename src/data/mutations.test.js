// @ts-nocheck
// (Test-only type-narrowing noise from the {ok:true|false} discriminated unions is suppressed
// here; correctness is verified at runtime by `node --test`, and the production call sites in
// features/* properly narrow on `.ok` before use — see mutations.js itself, which is ts-checked.)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addQuestion, deleteQuestion, deleteQuestions, deleteGroup, deleteGroupCascade, renameGroup, moveQuestions, moveGroup,
  bulkAddRows, bulkUpdateRows, questionExists, scheduleReview, resetProgress,
  setGroupNotImportant, applyPatchToSelection, setDifficultyForQuestions, migrateLessImportantToNotImportant,
  markStatus, resetTriStateHistory, toggleQuestionTag, updateQuestion, toggleStatusFlag, backfillUpdatedAt,
  backfillTriStateTracking,
} from "./mutations.js";

function emptyData() {
  return { rawData: [], emptyGroups: [], tombstones: [] };
}

test("addQuestion appends and consumes a matching empty-group marker", () => {
  let data = { rawData: [], emptyGroups: [{ subject: "S1", topic: "T1", subTopic: "ST1", createdOrder: 0 }] };
  const result = addQuestion(data, { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  assert.equal(result.rawData.length, 1);
  assert.equal(result.emptyGroups.length, 0);
});

test("addQuestion carries difficulty through, defaulting to null", () => {
  const withDifficulty = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1", difficulty: "hard" });
  assert.equal(withDifficulty.question.difficulty, "hard");
  const withoutDifficulty = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q2" });
  assert.equal(withoutDifficulty.question.difficulty, null);
});

test("setGroupNotImportant cascades to every question under a Topic, leaving siblings under other Topics untouched", () => {
  let data = emptyData();
  data = addQuestion(data, { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  data = addQuestion(data, { subject: "S1", topic: "T1", subTopic: "ST2", question: "Q2" });
  data = addQuestion(data, { subject: "S1", topic: "T2", subTopic: "ST1", question: "Q3" });
  const result = setGroupNotImportant(data, "topic", { subject: "S1", topic: "T1" }, true);
  assert.ok(result.rawData.filter((q) => q.topic === "T1").every((q) => q.notImportant === true));
  assert.equal(result.rawData.find((q) => q.topic === "T2").notImportant, false);
});

test("applyPatchToSelection cascades to selected groups AND explicitly selected question ids together", () => {
  let data = emptyData();
  data = addQuestion(data, { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  data = addQuestion(data, { subject: "S2", topic: "T1", subTopic: "ST1", question: "Q2" });
  const otherQ = addQuestion(data, { subject: "S3", topic: "T1", subTopic: "ST1", question: "Q3" });
  data = { rawData: otherQ.rawData, emptyGroups: otherQ.emptyGroups };
  const otherQId = otherQ.question.id;

  const result = applyPatchToSelection(data, [{ level: "subject", scope: { subject: "S1" } }], [otherQId], { difficulty: "easy" });
  assert.equal(result.rawData.find((q) => q.subject === "S1").difficulty, "easy");
  assert.equal(result.rawData.find((q) => q.id === otherQId).difficulty, "easy");
  assert.equal(result.rawData.find((q) => q.subject === "S2").difficulty, null);
});

test("setDifficultyForQuestions sets difficulty only for the given ids", () => {
  let data = emptyData();
  const a = addQuestion(data, { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  const b = addQuestion({ rawData: a.rawData, emptyGroups: a.emptyGroups }, { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q2" });
  const out = setDifficultyForQuestions(b.rawData, [a.question.id], "medium");
  assert.equal(out.find((q) => q.id === a.question.id).difficulty, "medium");
  assert.equal(out.find((q) => q.id === b.question.id).difficulty, null);
});

test("migrateLessImportantToNotImportant copies the legacy field over once, then no-ops", () => {
  const legacy = [{ id: "a", lessImportant: true }, { id: "b", lessImportant: false }];
  const first = migrateLessImportantToNotImportant(legacy);
  assert.equal(first.changed, true);
  assert.equal(first.rawData.find((q) => q.id === "a").notImportant, true);
  assert.equal(first.rawData.find((q) => q.id === "b").notImportant, false);
  assert.equal(first.rawData.find((q) => q.id === "a").lessImportant, undefined);

  const second = migrateLessImportantToNotImportant(first.rawData);
  assert.equal(second.changed, false);
});

test("markStatus(done) increments doneCount and appends a timestamped history entry each call, clearing failed/reviewLater", () => {
  const data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1", failed: true });
  const id = data.question.id;
  const once = markStatus(data.rawData, id, "done", "first note");
  const q1 = once.find((q) => q.id === id);
  assert.equal(q1.done, true);
  assert.equal(q1.failed, false);
  assert.equal(q1.doneCount, 1);
  assert.equal(q1.doneHistory.length, 1);
  assert.equal(q1.doneHistory[0].note, "first note");

  const twice = markStatus(once, id, "done");
  const q2 = twice.find((q) => q.id === id);
  assert.equal(q2.doneCount, 2);
  assert.equal(q2.doneHistory.length, 2);
  assert.equal(q2.doneHistory[1].note, undefined);
});

test("markStatus(failed)/markStatus(reviewLater) track their own independent counters/history, distinct from Done's", () => {
  const data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  const id = data.question.id;
  let rawData = markStatus(data.rawData, id, "done");
  rawData = markStatus(rawData, id, "failed", "oops");
  rawData = markStatus(rawData, id, "reviewLater");
  const q = rawData.find((x) => x.id === id);
  assert.equal(q.done, false);
  assert.equal(q.failed, false);
  assert.equal(q.reviewLater, true);
  assert.equal(q.doneCount, 1); // preserved from the earlier markStatus(done) call
  assert.equal(q.failedCount, 1);
  assert.equal(q.failedHistory[0].note, "oops");
  assert.equal(q.reviewLaterCount, 1);
});

test("resetTriStateHistory clears done/failed/reviewLater flags, all three counters/histories, Visited, and SRS scheduling together", () => {
  const data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  const id = data.question.id;
  let rawData = markStatus(data.rawData, id, "done", "note");
  rawData = markStatus(rawData, id, "failed"); // leaves a stray doneCount/doneHistory behind
  rawData = updateQuestion(rawData, id, { visited: true, srsDue: "2099-01-01", srsStreak: 3 });
  const reset = resetTriStateHistory(rawData, id);
  const q = reset.find((x) => x.id === id);
  assert.equal(q.done, false);
  assert.equal(q.failed, false);
  assert.equal(q.reviewLater, false);
  assert.equal(q.visited, false);
  assert.equal(q.srsDue, null);
  assert.equal(q.srsStreak, 0);
  assert.equal(q.doneCount, 0);
  assert.deepEqual(q.doneHistory, []);
  assert.equal(q.failedCount, 0);
  assert.deepEqual(q.failedHistory, []);
  assert.equal(q.reviewLaterCount, 0);
  assert.deepEqual(q.reviewLaterHistory, []);
});

test("toggleQuestionTag adds then removes a tag, leaving other questions untouched", () => {
  const a = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  const b = addQuestion({ rawData: a.rawData, emptyGroups: a.emptyGroups }, { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q2" });
  const added = toggleQuestionTag(b.rawData, a.question.id, "java");
  assert.deepEqual(added.find((q) => q.id === a.question.id).tags, ["java"]);
  assert.deepEqual(added.find((q) => q.id === b.question.id).tags, []);
  const removed = toggleQuestionTag(added, a.question.id, "java");
  assert.deepEqual(removed.find((q) => q.id === a.question.id).tags, []);
});

test("deleteQuestion marks the SubTopic empty when it was the last question", () => {
  let data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  const q = data.question;
  const result = deleteQuestion({ rawData: data.rawData, emptyGroups: data.emptyGroups, tombstones: [] }, q.id);
  assert.equal(result.rawData.length, 0);
  assert.equal(result.emptyGroups.length, 1);
  assert.equal(result.emptyGroups[0].subTopic, "ST1");
  assert.deepEqual(result.tombstones, [{ id: q.id, deletedAt: result.tombstones[0].deletedAt }]);
});

test("deleteGroup is blocked while the group still has questions", () => {
  let data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  const result = deleteGroup({ rawData: data.rawData, emptyGroups: data.emptyGroups }, "subTopic", { subject: "S1", topic: "T1", subTopic: "ST1" });
  assert.equal(result.ok, false);
});

test("deleteGroup succeeds for a provably-empty group", () => {
  const data = { rawData: [], emptyGroups: [{ subject: "S1", topic: "T1", subTopic: "ST1", createdOrder: 0 }] };
  const result = deleteGroup(data, "subTopic", { subject: "S1", topic: "T1", subTopic: "ST1" });
  assert.equal(result.ok, true);
  assert.equal(result.emptyGroups.length, 0);
});

test("renameGroup cascades to questions and empty-group placeholders", () => {
  let data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  data = { rawData: data.rawData, emptyGroups: [{ subject: "S1", topic: "T1", subTopic: "ST2", createdOrder: 0 }, ...data.emptyGroups] };
  const result = renameGroup(data, "topic", { subject: "S1", topic: "T1" }, "T1-renamed");
  assert.equal(result.rawData[0].topic, "T1-renamed");
  assert.equal(result.emptyGroups.find((e) => e.subTopic === "ST2").topic, "T1-renamed");
});

test("moveQuestions relocates and marks source empty / consumes destination marker", () => {
  let data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  const q = data.question;
  data = { rawData: data.rawData, emptyGroups: [{ subject: "S2", topic: "T2", subTopic: "ST2", createdOrder: 0 }] };
  const result = moveQuestions(data, [q.id], { subject: "S2", topic: "T2", subTopic: "ST2" });
  assert.equal(result.rawData[0].subject, "S2");
  assert.equal(result.emptyGroups.some((e) => e.subTopic === "ST1"), true); // source marked empty
  assert.equal(result.emptyGroups.some((e) => e.subTopic === "ST2"), false); // destination marker consumed
});

test("moveGroup(subTopic) merges into an identically-named SubTopic at the destination Topic", () => {
  let data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  data = addQuestion(data, { subject: "S1", topic: "T2", subTopic: "ST1", question: "Q2" });
  const result = moveGroup(data, "subTopic", { subject: "S1", topic: "T1", subTopic: "ST1" }, { subject: "S1", topic: "T2" });
  const moved = result.rawData.find((q) => q.question === "Q1");
  assert.equal(moved.topic, "T2");
  assert.equal(moved.subTopic, "ST1"); // name preserved, merged with Q2's existing ST1
  // A whole-SubTopic move leaves nothing behind at the source — unlike a single-question move,
  // which intentionally leaves an "(empty)" placeholder so the vacated SubTopic stays visible.
  assert.equal(result.emptyGroups.some((e) => e.topic === "T1"), false);
});

test("moveGroup(subTopic) creates a new SubTopic when none matches at the destination Topic", () => {
  let data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  data = addQuestion(data, { subject: "S1", topic: "T2", subTopic: "Other", question: "Q2" });
  const result = moveGroup(data, "subTopic", { subject: "S1", topic: "T1", subTopic: "ST1" }, { subject: "S1", topic: "T2" });
  const moved = result.rawData.find((q) => q.question === "Q1");
  assert.equal(moved.topic, "T2");
  assert.equal(moved.subTopic, "ST1");
});

test("moveGroup(subTopic) transfers an empty placeholder SubTopic (no questions) to the destination", () => {
  const data = { rawData: [], emptyGroups: [{ subject: "S1", topic: "T1", subTopic: "ST1", createdOrder: 0 }] };
  const result = moveGroup(data, "subTopic", { subject: "S1", topic: "T1", subTopic: "ST1" }, { subject: "S1", topic: "T2" });
  assert.equal(result.emptyGroups.some((e) => e.subject === "S1" && e.topic === "T1"), false);
  assert.equal(result.emptyGroups.some((e) => e.subject === "S1" && e.topic === "T2" && e.subTopic === "ST1"), true);
});

test("moveGroup(subTopic) dropped onto its own current parent Topic is a no-op", () => {
  const data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  const result = moveGroup(data, "subTopic", { subject: "S1", topic: "T1", subTopic: "ST1" }, { subject: "S1", topic: "T1" });
  assert.deepEqual(result, data);
});

test("moveGroup(topic) moves every child SubTopic and question to the new Subject, merging by name", () => {
  let data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  data = addQuestion(data, { subject: "S1", topic: "T1", subTopic: "ST2", question: "Q2" });
  data = addQuestion(data, { subject: "S2", topic: "T1", subTopic: "ST1", question: "Q3" }); // pre-existing match at destination
  const result = moveGroup(data, "topic", { subject: "S1", topic: "T1" }, { subject: "S2" });
  const q1 = result.rawData.find((q) => q.question === "Q1");
  const q2 = result.rawData.find((q) => q.question === "Q2");
  assert.equal(q1.subject, "S2");
  assert.equal(q1.subTopic, "ST1"); // merged into Q3's existing S2::T1::ST1
  assert.equal(q2.subject, "S2");
  assert.equal(q2.subTopic, "ST2"); // no match at destination -> created
  assert.equal(result.rawData.some((q) => q.subject === "S1"), false); // source Subject fully vacated
  assert.equal(result.emptyGroups.some((e) => e.subject === "S1"), false); // no leftover "(empty)" ghost either
});

test("moveGroup(topic) dropped onto its own current parent Subject is a no-op", () => {
  const data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  const result = moveGroup(data, "topic", { subject: "S1", topic: "T1" }, { subject: "S1" });
  assert.deepEqual(result, data);
});

test("moveGroup(subject) merges every child Topic/SubTopic/question into the destination Subject", () => {
  let data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  data = addQuestion(data, { subject: "S1", topic: "T2", subTopic: "STx", question: "Q2" });
  data = addQuestion(data, { subject: "S2", topic: "T1", subTopic: "ST1", question: "Q3" }); // pre-existing match
  const result = moveGroup(data, "subject", { subject: "S1" }, { subject: "S2" });
  const q1 = result.rawData.find((q) => q.question === "Q1");
  const q2 = result.rawData.find((q) => q.question === "Q2");
  assert.equal(q1.subject, "S2");
  assert.equal(q1.topic, "T1");
  assert.equal(q1.subTopic, "ST1"); // merged into Q3's existing S2::T1::ST1
  assert.equal(q2.subject, "S2");
  assert.equal(q2.topic, "T2"); // no match at destination -> created
  assert.equal(result.rawData.some((q) => q.subject === "S1"), false);
  assert.equal(result.emptyGroups.some((e) => e.subject === "S1"), false);
});

test("moveGroup(subject) into itself is a no-op", () => {
  const data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  const result = moveGroup(data, "subject", { subject: "S1" }, { subject: "S1" });
  assert.deepEqual(result, data);
});

test("deleteGroupCascade removes a non-empty Topic and every question/placeholder nested under it", () => {
  let data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  data = addQuestion(data, { subject: "S1", topic: "T2", subTopic: "STx", question: "Q2" }); // sibling, untouched
  data = { rawData: data.rawData, emptyGroups: [{ subject: "S1", topic: "T1", subTopic: "ST2", createdOrder: 0 }, ...data.emptyGroups], tombstones: [] };
  const result = deleteGroupCascade(data, "topic", { subject: "S1", topic: "T1" });
  assert.equal(result.rawData.some((q) => q.topic === "T1"), false);
  assert.equal(result.rawData.some((q) => q.topic === "T2"), true); // sibling untouched
  assert.equal(result.emptyGroups.some((e) => e.topic === "T1"), false);
  assert.equal(result.tombstones.length, 1); // one question ("Q1") deleted under the T1 cascade
});

test("bulkAddRows skips case-insensitive duplicates and invalid rows, reports counts", () => {
  let data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Existing Q" });
  const rows = [
    { subject: "S1", topic: "T1", subTopic: "ST1", question: "existing q", answer: "", done: false, reviewLater: false, duplicate: false, notImportant: false, starred: false, rowIndex: 1 },
    { subject: "S1", topic: "T1", subTopic: "ST1", question: "New Q", answer: "", done: false, reviewLater: false, duplicate: false, notImportant: false, starred: false, rowIndex: 2 },
    { subject: "", topic: "", subTopic: "", question: "", answer: "", done: false, reviewLater: false, duplicate: false, notImportant: false, starred: false, rowIndex: 3 },
  ];
  const result = bulkAddRows({ rawData: data.rawData, emptyGroups: data.emptyGroups }, rows);
  assert.equal(result.summary.added, 1);
  assert.equal(result.summary.skippedDuplicate, 1);
  assert.equal(result.summary.skippedInvalid, 1);
});

test("bulkUpdateRows matches existing rows by S+T+ST+Question and adds unmatched rows instead of dropping them", () => {
  let data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1", answer: "old" });
  const rows = [
    { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1", answer: "new answer", done: true, reviewLater: false, duplicate: false, notImportant: false, starred: false, rowIndex: 1 },
    { subject: "S1", topic: "T1", subTopic: "ST1", question: "Brand New Q", answer: "a", done: false, reviewLater: false, duplicate: false, notImportant: false, starred: false, rowIndex: 2 },
  ];
  const result = bulkUpdateRows({ rawData: data.rawData, emptyGroups: data.emptyGroups }, rows);
  assert.equal(result.summary.updated, 1);
  assert.equal(result.summary.added, 1);
  assert.equal(result.rawData.find((q) => q.question === "Q1").answer, "new answer");
  assert.equal(result.rawData.find((q) => q.question === "Q1").done, true);
});

test("questionExists matches case-insensitively", () => {
  let data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Hello World" });
  assert.equal(questionExists(data.rawData, "s1", "t1", "st1", "HELLO WORLD"), true);
  assert.equal(questionExists(data.rawData, "s1", "t1", "st1", "Something Else"), false);
});

test("scheduleReview 'advance' grows the streak and pushes srsDue out by the matching Leitner interval", () => {
  const data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  const ref = new Date("2026-08-08T00:00:00Z");
  let rawData = scheduleReview(data.rawData, data.question.id, "advance", ref);
  let q = rawData.find((x) => x.id === data.question.id);
  assert.equal(q.srsStreak, 1);
  assert.equal(q.srsDue, "2026-08-09"); // +1 day

  rawData = scheduleReview(rawData, data.question.id, "advance", ref);
  q = rawData.find((x) => x.id === data.question.id);
  assert.equal(q.srsStreak, 2);
  assert.equal(q.srsDue, "2026-08-10"); // +2 days
});

test("scheduleReview 'reset' clears the streak and brings srsDue back to tomorrow", () => {
  const data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  const ref = new Date("2026-08-08T00:00:00Z");
  let rawData = scheduleReview(data.rawData, data.question.id, "advance", ref);
  rawData = scheduleReview(rawData, data.question.id, "advance", ref);
  rawData = scheduleReview(rawData, data.question.id, "reset", ref);
  const q = rawData.find((x) => x.id === data.question.id);
  assert.equal(q.srsStreak, 0);
  assert.equal(q.srsDue, "2026-08-09");
});

test("resetProgress clears done/reviewLater/visited/srsDue/srsStreak/doneCount/doneHistory for every question but leaves starred and structure untouched", () => {
  let data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1", done: true, reviewLater: true, starred: true, visited: true });
  const ref = new Date("2026-08-08T00:00:00Z");
  let rawData = scheduleReview(data.rawData, data.question.id, "advance", ref);
  rawData = markStatus(rawData, data.question.id, "done", "a note");

  rawData = resetProgress(rawData);
  const q = rawData.find((x) => x.id === data.question.id);
  assert.equal(q.done, false);
  assert.equal(q.reviewLater, false);
  assert.equal(q.visited, false);
  assert.equal(q.srsDue, null);
  assert.equal(q.srsStreak, 0);
  assert.equal(q.doneCount, 0);
  assert.deepEqual(q.doneHistory, []);
  assert.equal(q.starred, true);
  assert.equal(q.subject, "S1");
  assert.equal(q.question, "Q1");
});

test("resetProgress(rawData, questionIds) restricts the reset to just those ids, leaving other questions' progress untouched", () => {
  const a = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1", done: true, reviewLater: true });
  const b = addQuestion({ rawData: a.rawData, emptyGroups: a.emptyGroups }, { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q2", done: true });
  const rawData = resetProgress(b.rawData, [a.question.id]);
  const qa = rawData.find((x) => x.id === a.question.id);
  const qb = rawData.find((x) => x.id === b.question.id);
  assert.equal(qa.done, false);
  assert.equal(qa.reviewLater, false);
  assert.equal(qb.done, true); // outside the given id scope, untouched
});

test("addQuestion stamps a fresh updatedAt on the new question", () => {
  const before = Date.now();
  const result = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  assert.equal(typeof result.question.updatedAt, "number");
  assert.ok(result.question.updatedAt >= before);
});

test("updateQuestion/toggleStatusFlag/markStatus/resetTriStateHistory/toggleQuestionTag/scheduleReview/resetProgress/setDifficultyForQuestions/applyPatchToSelection/renameGroup/moveQuestions all bump updatedAt", () => {
  let data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  const id = data.question.id;
  const original = data.question.updatedAt;

  const bumpedBy = (rawData) => {
    const q = rawData.find((x) => x.id === id);
    assert.equal(typeof q.updatedAt, "number");
    assert.ok(q.updatedAt >= original);
    return q;
  };

  bumpedBy(updateQuestion(data.rawData, id, { answer: "a" }));
  bumpedBy(toggleStatusFlag(data.rawData, id, "starred"));
  bumpedBy(markStatus(data.rawData, id, "done"));
  bumpedBy(resetTriStateHistory(data.rawData, id));
  bumpedBy(toggleQuestionTag(data.rawData, id, "java"));
  bumpedBy(scheduleReview(data.rawData, id, "advance"));
  bumpedBy(resetProgress(data.rawData, [id]));
  bumpedBy(setDifficultyForQuestions(data.rawData, [id], "hard"));
  bumpedBy(applyPatchToSelection({ rawData: data.rawData, emptyGroups: data.emptyGroups }, [], [id], { starred: true }).rawData);
  bumpedBy(renameGroup({ rawData: data.rawData, emptyGroups: data.emptyGroups }, "subject", { subject: "S1" }, "S2").rawData);
  bumpedBy(moveQuestions({ rawData: data.rawData, emptyGroups: data.emptyGroups }, [id], { subject: "S1", topic: "T1", subTopic: "ST2" }).rawData);
});

test("deleteQuestion records a tombstone; a re-delete after undo updates (not duplicates) it", () => {
  let data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  const id = data.question.id;
  let result = deleteQuestion({ rawData: data.rawData, emptyGroups: data.emptyGroups, tombstones: [] }, id);
  assert.equal(result.tombstones.length, 1);
  assert.equal(result.tombstones[0].id, id);
  const firstDeletedAt = result.tombstones[0].deletedAt;

  // Simulate undo (question comes back) then re-delete — must replace, not duplicate, the tombstone.
  const undone = { rawData: data.rawData, emptyGroups: data.emptyGroups, tombstones: result.tombstones };
  result = deleteQuestion(undone, id);
  assert.equal(result.tombstones.length, 1);
  assert.ok(result.tombstones[0].deletedAt >= firstDeletedAt);
});

test("deleteQuestions records a tombstone per deleted id", () => {
  const a = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  const b = addQuestion({ rawData: a.rawData, emptyGroups: a.emptyGroups }, { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q2" });
  const result = deleteQuestions({ rawData: b.rawData, emptyGroups: b.emptyGroups, tombstones: [] }, [a.question.id, b.question.id]);
  assert.equal(result.tombstones.length, 2);
  assert.deepEqual(result.tombstones.map((t) => t.id).sort(), [a.question.id, b.question.id].sort());
});

test("backfillUpdatedAt no-ops once every question already has updatedAt", () => {
  const data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  const result = backfillUpdatedAt(data.rawData);
  assert.equal(result.changed, false);
  assert.equal(result.rawData[0], data.rawData[0]); // same question object reference, untouched
});

test("backfillUpdatedAt stamps missing updatedAt with the injected referenceDate", () => {
  const rawData = [{ id: "a", subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1", answer: "" }];
  const ref = new Date("2026-08-08T00:00:00Z");
  const result = backfillUpdatedAt(rawData, ref);
  assert.equal(result.changed, true);
  assert.equal(result.rawData[0].updatedAt, ref.getTime());
});

test("backfillTriStateTracking no-ops once every flagged question already has matching history", () => {
  const data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  const marked = markStatus(data.rawData, data.question.id, "done");
  const result = backfillTriStateTracking(marked);
  assert.equal(result.changed, false);
  assert.equal(result.rawData[0], marked[0]);
});

test("backfillTriStateTracking stamps missing counts/history for Done/Failed/Review Later independently", () => {
  const ref = new Date("2026-08-08T00:00:00Z");
  const rawData = [
    { id: "a", subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1", answer: "", done: true },
    { id: "b", subject: "S1", topic: "T1", subTopic: "ST1", question: "Q2", answer: "", failed: true },
    { id: "c", subject: "S1", topic: "T1", subTopic: "ST1", question: "Q3", answer: "", reviewLater: true },
    { id: "d", subject: "S1", topic: "T1", subTopic: "ST1", question: "Q4", answer: "" },
  ];
  const result = backfillTriStateTracking(rawData, ref);
  assert.equal(result.changed, true);
  const byId = Object.fromEntries(result.rawData.map((q) => [q.id, q]));
  assert.equal(byId.a.doneCount, 1);
  assert.deepEqual(byId.a.doneHistory, [{ ts: ref.getTime() }]);
  assert.equal(byId.b.failedCount, 1);
  assert.deepEqual(byId.b.failedHistory, [{ ts: ref.getTime() }]);
  assert.equal(byId.c.reviewLaterCount, 1);
  assert.deepEqual(byId.c.reviewLaterHistory, [{ ts: ref.getTime() }]);
  assert.equal(byId.d.doneCount, undefined); // untouched — no flags set
});
