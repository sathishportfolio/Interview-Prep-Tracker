// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupData, flattenQuestions, flattenNavigablePositions } from "./group.js";

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
    notImportant: false,
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

test("questions sort by persisted order regardless of starred/notImportant flags", () => {
  const rawData = [
    q({ id: "normal2", order: 2 }),
    q({ id: "less", order: 0, notImportant: true }),
    q({ id: "star", order: 5, starred: true }),
    q({ id: "normal1", order: 1 }),
  ];
  const tree = groupData(rawData, []);
  const ids = tree.subjects[0].topics[0].subTopics[0].questions.map((x) => x.id);
  assert.deepEqual(ids, ["less", "normal1", "normal2", "star"]);
});

test("notImportant is derived bottom-up: a SubTopic is notImportant only when every question in it is, and a childless placeholder falls back to its EmptyGroup marker", () => {
  const allMarked = [q({ id: "a", subTopic: "ST1", notImportant: true }), q({ id: "b", subTopic: "ST1", notImportant: true })];
  const mixed = [q({ id: "c", subTopic: "ST2", notImportant: true }), q({ id: "d", subTopic: "ST2", notImportant: false })];
  const emptyGroups = [{ subject: "S1", topic: "T1", subTopic: "ST3", createdOrder: 0, notImportant: true }];
  const tree = groupData([...allMarked, ...mixed], emptyGroups);
  const subTopics = tree.subjects[0].topics[0].subTopics;
  assert.equal(subTopics.find((st) => st.subTopic === "ST1").notImportant, true);
  assert.equal(subTopics.find((st) => st.subTopic === "ST2").notImportant, false);
  assert.equal(subTopics.find((st) => st.subTopic === "ST3").notImportant, true);
  // Never affects order/visibility — same tie-break as before, purely a label.
  assert.equal(tree.subjects[0].topics[0].isEmpty, false);
});

test("notImportant never reorders siblings — a mixed-flag SubTopic keeps persisted order", () => {
  const rawData = [q({ id: "a", order: 1, notImportant: true }), q({ id: "b", order: 0, notImportant: false })];
  const tree = groupData(rawData, []);
  const ids = tree.subjects[0].topics[0].subTopics[0].questions.map((x) => x.id);
  assert.deepEqual(ids, ["b", "a"]);
});

test("completePercent: SubTopic/Topic use a raw question-done fraction, Subject uses a fraction of fully-complete child Topics", () => {
  // Subject S1: Topic T1 has 2 SubTopics, one 2/2 done (ST1) and one 0/2 done (ST2) -> T1 is 2/4 = 50%
  // question-done, and NOT itself complete (ST2 isn't 100%). Topic T2 is fully done -> 100%, complete.
  // Subject S1 then has 1 of 2 Topics fully complete -> completePercent 50%.
  const rawData = [
    q({ id: "a", topic: "T1", subTopic: "ST1", done: true }),
    q({ id: "b", topic: "T1", subTopic: "ST1", done: true }),
    q({ id: "c", topic: "T1", subTopic: "ST2", done: false }),
    q({ id: "d", topic: "T1", subTopic: "ST2", done: false }),
    q({ id: "e", topic: "T2", subTopic: "ST1", done: true }),
  ];
  const tree = groupData(rawData, []);
  const t1 = tree.subjects[0].topics.find((t) => t.topic === "T1");
  const t2 = tree.subjects[0].topics.find((t) => t.topic === "T2");
  assert.equal(t1.subTopics.find((st) => st.subTopic === "ST1").completePercent, 100);
  assert.equal(t1.subTopics.find((st) => st.subTopic === "ST2").completePercent, 0);
  assert.equal(t1.completePercent, 50);
  assert.equal(t2.completePercent, 100);
  assert.equal(tree.subjects[0].completePercent, 50);
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

test("flattenNavigablePositions walks SubTopics in Subject > Topic > SubTopic display order, with each SubTopic's first/last question id", () => {
  const rawData = [
    q({ id: "a", subject: "S2", topic: "T1", subTopic: "ST1", subjectOrder: 1 }),
    q({ id: "b", subject: "S1", topic: "T2", subTopic: "ST1", subjectOrder: 0, topicOrder: 1 }),
    q({ id: "c", subject: "S1", topic: "T1", subTopic: "ST2", subjectOrder: 0, topicOrder: 0, subTopicOrder: 1 }),
    q({ id: "d1", subject: "S1", topic: "T1", subTopic: "ST1", subjectOrder: 0, topicOrder: 0, subTopicOrder: 0, order: 0 }),
    q({ id: "d2", subject: "S1", topic: "T1", subTopic: "ST1", subjectOrder: 0, topicOrder: 0, subTopicOrder: 0, order: 1 }),
  ];
  const tree = groupData(rawData, []);
  const flat = flattenNavigablePositions(tree);
  assert.deepEqual(flat, [
    { level: "subTopic", subject: "S1", topic: "T1", subTopic: "ST1", firstQuestionId: "d1", lastQuestionId: "d2" },
    { level: "subTopic", subject: "S1", topic: "T1", subTopic: "ST2", firstQuestionId: "c", lastQuestionId: "c" },
    { level: "subTopic", subject: "S1", topic: "T2", subTopic: "ST1", firstQuestionId: "b", lastQuestionId: "b" },
    { level: "subTopic", subject: "S2", topic: "T1", subTopic: "ST1", firstQuestionId: "a", lastQuestionId: "a" },
  ]);
});

test("flattenNavigablePositions reports firstQuestionId/lastQuestionId: null for an empty-group placeholder SubTopic", () => {
  const tree = groupData([], [{ subject: "S1", topic: "T1", subTopic: "ST1" }]);
  const flat = flattenNavigablePositions(tree);
  assert.deepEqual(flat, [{ level: "subTopic", subject: "S1", topic: "T1", subTopic: "ST1", firstQuestionId: null, lastQuestionId: null }]);
});

test("flattenNavigablePositions surfaces an empty Subject (no Topics) as its own level:'subject' stop", () => {
  const tree = groupData([], [{ subject: "S1", topic: null, subTopic: null }]);
  const flat = flattenNavigablePositions(tree);
  assert.deepEqual(flat, [{ level: "subject", subject: "S1", firstQuestionId: null, lastQuestionId: null }]);
});

test("flattenNavigablePositions surfaces an empty Topic (no SubTopics) as its own level:'topic' stop, alongside a real sibling SubTopic", () => {
  const rawData = [q({ id: "a", subject: "S1", topic: "T2", subTopic: "ST1" })];
  const tree = groupData(rawData, [{ subject: "S1", topic: "T1", subTopic: null }]);
  const flat = flattenNavigablePositions(tree);
  assert.deepEqual(flat, [
    { level: "subTopic", subject: "S1", topic: "T2", subTopic: "ST1", firstQuestionId: "a", lastQuestionId: "a" },
    { level: "topic", subject: "S1", topic: "T1", firstQuestionId: null, lastQuestionId: null },
  ]);
});
