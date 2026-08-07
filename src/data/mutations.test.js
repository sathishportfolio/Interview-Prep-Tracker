// @ts-nocheck
// (Test-only type-narrowing noise from the {ok:true|false} discriminated unions is suppressed
// here; correctness is verified at runtime by `node --test`, and the production call sites in
// features/* properly narrow on `.ok` before use — see mutations.js itself, which is ts-checked.)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addQuestion, deleteQuestion, deleteGroup, renameGroup, moveQuestions,
  bulkAddRows, bulkUpdateRows, questionExists,
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
