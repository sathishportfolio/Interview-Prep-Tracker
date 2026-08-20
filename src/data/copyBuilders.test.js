// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupData } from "./group.js";
import {
  buildPlainCopyText, buildStructureWithAnswerCopyText, buildStructureOnlyCopyText,
  buildHierarchyCopyText, buildHierarchyOnlyCopyText, buildVisibleCopyText,
} from "./copyBuilders.js";

function q(overrides) {
  return {
    id: overrides.id, subject: "S1", topic: "T1", subTopic: "ST1", question: "Q?", answer: "A",
    done: false, reviewLater: false, duplicate: false, notImportant: false, starred: false,
    order: 0, subjectOrder: 0, topicOrder: 0, subTopicOrder: 0, ...overrides,
  };
}

const rawData = [
  q({ id: "a", subject: "SubjA", topic: "TopicA", subTopic: "SubA", question: "Q1" }),
  q({ id: "b", subject: "SubjA", topic: "TopicB", subTopic: "SubB", question: "Q2" }),
];
const tree = groupData(rawData, []);
const s1 = tree.subjects.find((s) => s.subject === "SubjA");
const t1 = s1.topics.find((t) => t.topic === "TopicA");
const st1 = t1.subTopics.find((st) => st.subTopic === "SubA");

test("copy builders scoped to a SubTopic never leak ancestor Subject/Topic names", () => {
  const plain = buildPlainCopyText(st1);
  assert.equal(plain, "Q1");
  const hierarchy = buildHierarchyCopyText(st1);
  assert.ok(!hierarchy.includes("SubjA"));
  assert.ok(!hierarchy.includes("TopicA"));
  assert.ok(hierarchy.includes("SubA"));
  assert.ok(hierarchy.includes("Q1"));
});

test("copy builders scoped to a Topic include its SubTopics but not the Subject", () => {
  const hierarchyOnly = buildHierarchyOnlyCopyText(t1);
  assert.ok(!hierarchyOnly.includes("SubjA"));
  assert.ok(hierarchyOnly.includes("TopicA"));
  assert.ok(hierarchyOnly.includes("SubA"));
});

test("structure-with-answer and structure-only produce tab-separated rows", () => {
  const withAnswer = buildStructureWithAnswerCopyText(s1);
  assert.ok(withAnswer.includes("SubjA\tTopicA\tSubA\tQ1\tA"));
  const structOnly = buildStructureOnlyCopyText(s1);
  assert.ok(structOnly.includes("SubjA\tTopicA\tSubA"));
  assert.ok(!structOnly.includes("Q1"));
});

test("global visible copy DOES legitimately include the full Subject-down path", () => {
  const text = buildVisibleCopyText(tree, "structureWithAnswer");
  assert.ok(text.includes("SubjA\tTopicA\tSubA\tQ1\tA"));
  assert.ok(text.includes("SubjA\tTopicB\tSubB\tQ2\tA"));
});
