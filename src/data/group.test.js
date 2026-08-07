// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupData, flattenQuestions } from "./group.js";

function q(overrides) {
  return {
    id: overrides.id ?? "q1",
    subject: "S1",
    topic: "T1",
    subTopic: "ST1",
    question: "Q?",
    answer: "",
    done: false,
    reviewLater: false,
    duplicate: false,
    lessImportant: false,
    starred: false,
    order: 0,
    subjectOrder: 0,
    topicOrder: 0,
    subTopicOrder: 0,
    ...overrides,
  };
}

test("groups into Subject > Topic > SubTopic > Question", () => {
  const rawData = [
    q({ id: "a", subject: "S1", topic: "T1", subTopic: "ST1", order: 0 }),
    q({ id: "b", subject: "S1", topic: "T1", subTopic: "ST2", order: 0 }),
    q({ id: "c", subject: "S2", topic: "T1", subTopic: "ST1", order: 0 }),
  ];
  const tree = groupData(rawData, []);
  assert.equal(tree.subjects.length, 2);
  const s1 = tree.subjects.find((s) => s.subject === "S1");
  assert.equal(s1.topics.length, 1);
  assert.equal(s1.topics[0].subTopics.length, 2);
});

test("tiering: starred first, normal middle, lessImportant last, tie-break by order", () => {
  const rawData = [
    q({ id: "normal2", order: 2 }),
    q({ id: "less", order: 0, lessImportant: true }),
    q({ id: "star", order: 5, starred: true }),
    q({ id: "normal1", order: 1 }),
  ];
  const tree = groupData(rawData, []);
  const ids = tree.subjects[0].topics[0].subTopics[0].questions.map((x) => x.id);
  assert.deepEqual(ids, ["star", "normal1", "normal2", "less"]);
});

test("empty groups merge in and sort after real siblings by creation order", () => {
  const rawData = [q({ id: "a", subTopic: "ST1" })];
  const emptyGroups = [
    { subject: "S1", topic: "T1", subTopic: "STempty1", createdOrder: 0 },
    { subject: "S1", topic: "T1", subTopic: "STempty2", createdOrder: 1 },
  ];
  const tree = groupData(rawData, emptyGroups);
  const names = tree.subjects[0].topics[0].subTopics.map((st) => st.subTopic);
  assert.deepEqual(names, ["ST1", "STempty1", "STempty2"]);
  assert.equal(tree.subjects[0].topics[0].subTopics[1].isEmpty, true);
});

test("subject/topic-level empty markers (null subTopic/topic) create empty branches", () => {
  const emptyGroups = [
    { subject: "NewSubj", topic: null, subTopic: null, createdOrder: 0 },
    { subject: "S1", topic: "NewTopic", subTopic: null, createdOrder: 1 },
  ];
  const tree = groupData([], emptyGroups);
  const newSubj = tree.subjects.find((s) => s.subject === "NewSubj");
  assert.ok(newSubj);
  assert.equal(newSubj.isEmpty, true);
  assert.equal(newSubj.topics.length, 0);

  const s1 = tree.subjects.find((s) => s.subject === "S1");
  assert.ok(s1.topics.find((t) => t.topic === "NewTopic"));
});

test("flattenQuestions returns all questions across the tree", () => {
  const rawData = [q({ id: "a" }), q({ id: "b", subTopic: "ST2" })];
  const tree = groupData(rawData, []);
  const flat = flattenQuestions(tree);
  assert.equal(flat.length, 2);
});
