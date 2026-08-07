// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextQuestionOrder, moveQuestionOrder, reorderSiblingsByIdList } from "./order.js";

function q(id, order) {
  return { id, subject: "S", topic: "T", subTopic: "ST", question: "Q", answer: "", done: false, reviewLater: false, duplicate: false, lessImportant: false, starred: false, order, subjectOrder: 0, topicOrder: 0, subTopicOrder: 0 };
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
