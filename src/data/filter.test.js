// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupData } from "./group.js";
import { filterGroupedData, computeFilterOptions, emptyFilterState } from "./filter.js";

function q(overrides) {
  return {
    id: overrides.id, subject: "S1", topic: "T1", subTopic: "ST1", question: "Q?", answer: "",
    done: false, reviewLater: false, duplicate: false, lessImportant: false, starred: false,
    order: 0, subjectOrder: 0, topicOrder: 0, subTopicOrder: 0, ...overrides,
  };
}

const rawData = [
  q({ id: "a", subject: "S1", topic: "T1", subTopic: "ST1", starred: true }),
  q({ id: "b", subject: "S1", topic: "T2", subTopic: "ST2", done: true }),
  q({ id: "c", subject: "S2", topic: "T3", subTopic: "ST3" }),
];

test("filterGroupedData narrows by subject", () => {
  const tree = groupData(rawData, []);
  const filtered = filterGroupedData(tree, { ...emptyFilterState(), subjects: ["S1"] });
  assert.equal(filtered.subjects.length, 1);
  assert.equal(filtered.subjects[0].subject, "S1");
});

test("filterGroupedData applies status filter only to non-empty groups", () => {
  const tree = groupData(rawData, [{ subject: "S1", topic: "T1", subTopic: "STempty", createdOrder: 0 }]);
  const filtered = filterGroupedData(tree, { ...emptyFilterState(), statuses: ["starred"] });
  const st1 = filtered.subjects.find((s) => s.subject === "S1").topics.find((t) => t.topic === "T1").subTopics;
  const names = st1.map((s) => s.subTopic);
  assert.ok(names.includes("ST1")); // has a starred question
  assert.ok(names.includes("STempty")); // empty group passes through status filter
});

test("computeFilterOptions narrows Topic/SubTopic options by selected Subject, not itself", () => {
  const tree = groupData(rawData, []);
  const opts = computeFilterOptions(tree, { ...emptyFilterState(), subjects: ["S1"] });
  assert.deepEqual(opts.subjects, ["S1", "S2"]); // subject list itself unaffected by its own filter
  assert.deepEqual(opts.topics, ["T1", "T2"]); // narrowed to S1's topics only
});

test("filterGroupedData 'dueForReview' status matches by comparing srsDue to today, not a stored boolean", () => {
  const past = q({ id: "d1", subject: "S1", topic: "T1", subTopic: "ST1", srsDue: "2000-01-01" });
  const future = q({ id: "d2", subject: "S1", topic: "T1", subTopic: "ST1", srsDue: "2999-01-01" });
  const never = q({ id: "d3", subject: "S1", topic: "T1", subTopic: "ST1", srsDue: null });
  const tree = groupData([past, future, never], []);
  const filtered = filterGroupedData(tree, { ...emptyFilterState(), statuses: ["dueForReview"] });
  const ids = filtered.subjects[0].topics[0].subTopics[0].questions.map((qq) => qq.id);
  assert.deepEqual(ids, ["d1"]);
});
