// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextQuestionOrder, moveQuestionOrder, reorderSiblingsByIdList, applyGroupReorder, reorderGroupSiblings } from "./order.js";

function q(id, order) {
  return { id, subject: "S", topic: "T", subTopic: "ST", question: "Q", answer: "", done: false, reviewLater: false, duplicate: false, notImportant: false, starred: false, order, subjectOrder: 0, topicOrder: 0, subTopicOrder: 0 };
}

test("nextQuestionOrder derives from full rawData, not a filtered/shorter array", () => {
  const rawData = [q("a", 0), q("b", 1), q("c", 2)];
  // Simulate a caller accidentally holding a filtered (shorter) array elsewhere but always
  // passing the FULL rawData here, per the contract.
  const filtered = rawData.slice(0, 1);
  assert.notEqual(filtered.length, rawData.length);
  const next = nextQuestionOrder(rawData, "S", "T", "ST");
  assert.equal(next, 3);
  // If someone mistakenly passed the filtered array, the answer would be wrong (1) — assert the
  // full-array answer is what we actually get, proving the function itself doesn't special-case.
  const wrongIfFiltered = nextQuestionOrder(filtered, "S", "T", "ST");
  assert.equal(wrongIfFiltered, 1);
  assert.notEqual(next, wrongIfFiltered);
});

test("moveQuestionOrder up/down/top/bottom renumbers siblings only", () => {
  let rawData = [q("a", 0), q("b", 1), q("c", 2)];
  rawData = moveQuestionOrder(rawData, "c", "top");
  let order = [...rawData].sort((x, y) => x.order - y.order).map((x) => x.id);
  assert.deepEqual(order, ["c", "a", "b"]);

  rawData = moveQuestionOrder(rawData, "c", "down");
  order = [...rawData].sort((x, y) => x.order - y.order).map((x) => x.id);
  assert.deepEqual(order, ["a", "c", "b"]);

  rawData = moveQuestionOrder(rawData, "a", "bottom");
  order = [...rawData].sort((x, y) => x.order - y.order).map((x) => x.id);
  assert.deepEqual(order, ["c", "b", "a"]);
});

test("reorderSiblingsByIdList only touches matching subject/topic/subTopic", () => {
  const rawData = [q("a", 0), q("b", 1), { ...q("c", 0), subTopic: "OTHER" }];
  const out = reorderSiblingsByIdList(rawData, "S", "T", "ST", ["b", "a"]);
  assert.equal(out.find((x) => x.id === "b").order, 0);
  assert.equal(out.find((x) => x.id === "a").order, 1);
  assert.equal(out.find((x) => x.id === "c").order, 0); // untouched
});

test("applyGroupReorder moves every selected sibling together, preserving their own relative order", () => {
  const rawData = [q("a", 0), q("b", 1), q("c", 2), q("d", 3), q("e", 4)];
  // a and c are selected; only "a" is the one SortableJS physically dragged (dropped between d and
  // e) — the DOM-post-drop order reflects that single move, "c" is still sitting where it started.
  const orderedIds = ["b", "c", "d", "a", "e"];
  const result = applyGroupReorder(rawData, "S", "T", "ST", orderedIds, ["a", "c"], "a");
  // Both a and c relocate as a block (a before c, their original relative order) to land where "a"
  // was dropped — right after "d", before "e".
  assert.deepEqual(result, ["b", "d", "a", "c", "e"]);
});

test("applyGroupReorder handles a non-contiguous selection dragged to the end of the list", () => {
  const rawData = [q("a", 0), q("b", 1), q("c", 2), q("d", 3), q("e", 4)];
  // b and d selected; "b" physically dragged past the end.
  const orderedIds = ["a", "c", "d", "e", "b"];
  const result = applyGroupReorder(rawData, "S", "T", "ST", orderedIds, ["b", "d"], "b");
  assert.deepEqual(result, ["a", "c", "e", "b", "d"]);
});

test("reorderGroupSiblings renumbers topicOrder for every question sharing a topic name, scoped to the parent subject", () => {
  const rawData = [
    { ...q("a", 0), topic: "T1", topicOrder: 0 },
    { ...q("b", 0), topic: "T2", topicOrder: 1 },
    { ...q("c", 0), subject: "OTHER", topic: "T1", topicOrder: 0 }, // different subject, untouched
  ];
  const out = reorderGroupSiblings(rawData, "topic", { subject: "S" }, ["T2", "T1"]);
  assert.equal(out.find((x) => x.id === "b").topicOrder, 0);
  assert.equal(out.find((x) => x.id === "a").topicOrder, 1);
  assert.equal(out.find((x) => x.id === "c").topicOrder, 0); // untouched — different subject
});

test("reorderGroupSiblings at subject level ignores parentScope (every subject is a root sibling)", () => {
  const rawData = [
    { ...q("a", 0), subject: "S1", subjectOrder: 0 },
    { ...q("b", 0), subject: "S2", subjectOrder: 1 },
  ];
  const out = reorderGroupSiblings(rawData, "subject", {}, ["S2", "S1"]);
  assert.equal(out.find((x) => x.id === "a").subjectOrder, 1);
  assert.equal(out.find((x) => x.id === "b").subjectOrder, 0);
});

test("applyGroupReorder dragging the group to the very front", () => {
  const rawData = [q("a", 0), q("b", 1), q("c", 2), q("d", 3)];
  // c and d selected; "d" physically dragged to the front.
  const orderedIds = ["d", "a", "b", "c"];
  const result = applyGroupReorder(rawData, "S", "T", "ST", orderedIds, ["c", "d"], "d");
  assert.deepEqual(result, ["c", "d", "a", "b"]);
});
