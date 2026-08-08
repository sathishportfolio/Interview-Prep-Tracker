// @ts-nocheck
// (Test-only type-narrowing noise from the {ok:true|false} discriminated unions is suppressed
// here; correctness is verified at runtime by `node --test`, and the production call sites in
// features/* properly narrow on `.ok` before use — see mutations.js itself, which is ts-checked.)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addQuestion, deleteQuestion, deleteGroup, deleteGroupCascade, renameGroup, moveQuestions, moveGroup,
  bulkAddRows, bulkUpdateRows, questionExists, scheduleReview,
} from "./mutations.js";

function emptyData() {
  return { rawData: [], emptyGroups: [] };
}

test("addQuestion appends and consumes a matching empty-group marker", () => {
  let data = { rawData: [], emptyGroups: [{ subject: "S1", topic: "T1", subTopic: "ST1", createdOrder: 0 }] };
  const result = addQuestion(data, { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  assert.equal(result.rawData.length, 1);
  assert.equal(result.emptyGroups.length, 0);
});

test("deleteQuestion marks the SubTopic empty when it was the last question", () => {
  let data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1" });
  const q = data.question;
  const result = deleteQuestion({ rawData: data.rawData, emptyGroups: data.emptyGroups }, q.id);
  assert.equal(result.rawData.length, 0);
  assert.equal(result.emptyGroups.length, 1);
  assert.equal(result.emptyGroups[0].subTopic, "ST1");
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
  data = { rawData: data.rawData, emptyGroups: [{ subject: "S1", topic: "T1", subTopic: "ST2", createdOrder: 0 }, ...data.emptyGroups] };
  const result = deleteGroupCascade(data, "topic", { subject: "S1", topic: "T1" });
  assert.equal(result.rawData.some((q) => q.topic === "T1"), false);
  assert.equal(result.rawData.some((q) => q.topic === "T2"), true); // sibling untouched
  assert.equal(result.emptyGroups.some((e) => e.topic === "T1"), false);
});

test("bulkAddRows skips case-insensitive duplicates and invalid rows, reports counts", () => {
  let data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Existing Q" });
  const rows = [
    { subject: "S1", topic: "T1", subTopic: "ST1", question: "existing q", answer: "", done: false, reviewLater: false, duplicate: false, lessImportant: false, starred: false, rowIndex: 1 },
    { subject: "S1", topic: "T1", subTopic: "ST1", question: "New Q", answer: "", done: false, reviewLater: false, duplicate: false, lessImportant: false, starred: false, rowIndex: 2 },
    { subject: "", topic: "", subTopic: "", question: "", answer: "", done: false, reviewLater: false, duplicate: false, lessImportant: false, starred: false, rowIndex: 3 },
  ];
  const result = bulkAddRows({ rawData: data.rawData, emptyGroups: data.emptyGroups }, rows);
  assert.equal(result.summary.added, 1);
  assert.equal(result.summary.skippedDuplicate, 1);
  assert.equal(result.summary.skippedInvalid, 1);
});

test("bulkUpdateRows matches existing rows by S+T+ST+Question and adds unmatched rows instead of dropping them", () => {
  let data = addQuestion(emptyData(), { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1", answer: "old" });
  const rows = [
    { subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1", answer: "new answer", done: true, reviewLater: false, duplicate: false, lessImportant: false, starred: false, rowIndex: 1 },
    { subject: "S1", topic: "T1", subTopic: "ST1", question: "Brand New Q", answer: "a", done: false, reviewLater: false, duplicate: false, lessImportant: false, starred: false, rowIndex: 2 },
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
