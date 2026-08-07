// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBulkCsv, serializeBulkCsv } from "./bulkCsv.js";

test("parses required columns, rejects missing", () => {
  const ok = parseBulkCsv("Subject,Topic,SubTopic,Question,Answer\nS1,T1,ST1,Q1,A1\n");
  assert.equal(ok.ok, true);
  assert.equal(ok.rows.length, 1);

  const bad = parseBulkCsv("Subject,Topic\nS1,T1\n");
  assert.equal(bad.ok, false);
});

test("blank Subject/Topic/SubTopic cells inherit the previous row's value", () => {
  const csv = "Subject,Topic,SubTopic,Question,Answer\nS1,T1,ST1,Q1,A1\n,,,Q2,A2\n";
  const result = parseBulkCsv(csv);
  assert.equal(result.ok, true);
  assert.equal(result.rows[1].subject, "S1");
  assert.equal(result.rows[1].topic, "T1");
  assert.equal(result.rows[1].subTopic, "ST1");
});

test("fixed scope (panel opened at a Subject/Topic level) overrides row values", () => {
  const csv = "Subject,Topic,SubTopic,Question,Answer\nIgnoredSubj,IgnoredTopic,ST1,Q1,A1\n";
  const result = parseBulkCsv(csv, { fixedSubject: "PinnedSubj", fixedTopic: "PinnedTopic" });
  assert.equal(result.ok, true);
  assert.equal(result.rows[0].subject, "PinnedSubj");
  assert.equal(result.rows[0].topic, "PinnedTopic");
  assert.equal(result.rows[0].subTopic, "ST1");
});

test("serializeBulkCsv round-trips through parseBulkCsv", () => {
  const questions = [
    { id: "a", subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1", answer: "A1", done: true, reviewLater: false, duplicate: false, lessImportant: false, starred: true, order: 0, subjectOrder: 0, topicOrder: 0, subTopicOrder: 0 },
  ];
  const csv = serializeBulkCsv(questions);
  const reparsed = parseBulkCsv(csv);
  assert.equal(reparsed.ok, true);
  assert.equal(reparsed.rows[0].question, "Q1");
  assert.equal(reparsed.rows[0].done, true);
  assert.equal(reparsed.rows[0].starred, true);
});
