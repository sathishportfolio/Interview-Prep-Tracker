// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseMainCsv, serializeMainCsv } from "./mainCsv.js";

const fixturePath = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../docs/Data_JS_Import_Aug05_v001.csv"
);

test("parses required columns and rejects missing ones", () => {
  const result = parseMainCsv("Subject,Topic,SubTopic,Question,Answer,Done,ReviewLater\nS1,T1,ST1,Q1,A1,true,false\n");
  assert.equal(result.ok, true);
  assert.equal(result.rawData.length, 1);
  assert.equal(result.rawData[0].subject, "S1");
  assert.equal(result.rawData[0].done, true);

  const bad = parseMainCsv("Subject,Topic\nS1,T1\n");
  assert.equal(bad.ok, false);
});

test("blank-Question rows become empty-group markers", () => {
  const csv = "Subject,Topic,SubTopic,Question,Answer,Done,ReviewLater\nS1,T1,ST1,,,false,false\n";
  const result = parseMainCsv(csv);
  assert.equal(result.ok, true);
  assert.equal(result.rawData.length, 0);
  assert.equal(result.emptyGroups.length, 1);
  assert.equal(result.emptyGroups[0].subTopic, "ST1");
});

test("serializeMainCsv excludes Duplicate-flagged rows", () => {
  const rawData = [
    { id: "a", subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1", answer: "", done: false, reviewLater: false, duplicate: true, lessImportant: false, starred: false, failed: false, order: 0, subjectOrder: 0, topicOrder: 0, subTopicOrder: 0 },
    { id: "b", subject: "S1", topic: "T1", subTopic: "ST1", question: "Q2", answer: "", done: false, reviewLater: false, duplicate: false, lessImportant: false, starred: false, failed: false, order: 1, subjectOrder: 0, topicOrder: 0, subTopicOrder: 0 },
  ];
  const csv = serializeMainCsv(rawData, []);
  assert.ok(!csv.includes("Q1"));
  assert.ok(csv.includes("Q2"));
});

test("round-trips against the real docs fixture (parse -> serialize -> reparse gives same question count)", () => {
  const text = readFileSync(fixturePath, "utf8");
  const first = parseMainCsv(text);
  assert.equal(first.ok, true);
  assert.ok(first.rawData.length > 0);

  const serialized = serializeMainCsv(first.rawData, first.emptyGroups);
  const second = parseMainCsv(serialized);
  assert.equal(second.ok, true);
  assert.equal(second.rawData.length, first.rawData.length);
  assert.equal(second.emptyGroups.length, first.emptyGroups.length);
  // Spot check a field round-trips (answer HTML with embedded quotes/commas)
  assert.equal(second.rawData[0].subject, first.rawData[0].subject);
  assert.equal(second.rawData[0].answer, first.rawData[0].answer);
});

test("empty Subject/Topic/SubTopic groups round-trip through export/import", () => {
  const rawData = [
    { id: "a", subject: "S1", topic: "T1", subTopic: "ST1", question: "Q1", answer: "", done: false, reviewLater: false, duplicate: false, lessImportant: false, starred: false, failed: false, order: 0, subjectOrder: 0, topicOrder: 0, subTopicOrder: 0 },
  ];
  const emptyGroups = [{ subject: "S2", topic: null, subTopic: null, createdOrder: 0 }];
  const csv = serializeMainCsv(rawData, emptyGroups);
  const reparsed = parseMainCsv(csv);
  assert.equal(reparsed.ok, true);
  assert.equal(reparsed.emptyGroups.length, 1);
  assert.equal(reparsed.emptyGroups[0].subject, "S2");
});
