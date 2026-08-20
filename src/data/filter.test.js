// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupData } from "./group.js";
import { filterGroupedData, computeFilterOptions, emptyFilterState, matchesSingleStatus, matchesTags } from "./filter.js";

function q(overrides) {
  return {
    id: overrides.id, subject: "S1", topic: "T1", subTopic: "ST1", question: "Q?", answer: "",
    done: false, reviewLater: false, duplicate: false, notImportant: false, starred: false, tags: [],
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

test("filterGroupedData statusMode 'OR' (default) matches ANY selected status, 'AND' requires ALL", () => {
  const both = q({ id: "e1", subject: "S1", topic: "T1", subTopic: "ST1", done: true, starred: true });
  const doneOnly = q({ id: "e2", subject: "S1", topic: "T1", subTopic: "ST1", done: true, starred: false });
  const starredOnly = q({ id: "e3", subject: "S1", topic: "T1", subTopic: "ST1", done: false, starred: true });
  const tree = groupData([both, doneOnly, starredOnly], []);

  const orFiltered = filterGroupedData(tree, { ...emptyFilterState(), statuses: ["done", "starred"] });
  const orIds = orFiltered.subjects[0].topics[0].subTopics[0].questions.map((qq) => qq.id).sort();
  assert.deepEqual(orIds, ["e1", "e2", "e3"]); // matches any of done/starred

  const andFiltered = filterGroupedData(tree, { ...emptyFilterState(), statuses: ["done", "starred"], statusMode: "AND" });
  const andIds = andFiltered.subjects[0].topics[0].subTopics[0].questions.map((qq) => qq.id);
  assert.deepEqual(andIds, ["e1"]); // only the one matching both

  const neither = q({ id: "e4", subject: "S1", topic: "T1", subTopic: "ST1", done: false, starred: false });
  const treeWithNeither = groupData([both, doneOnly, starredOnly, neither], []);
  const notFiltered = filterGroupedData(treeWithNeither, { ...emptyFilterState(), statuses: ["done", "starred"], statusMode: "NOT" });
  const notIds = notFiltered.subjects[0].topics[0].subTopics[0].questions.map((qq) => qq.id);
  assert.deepEqual(notIds, ["e4"]); // excludes anything matching done OR starred
});

test("matchesSingleStatus difficultyEasy/Medium/Hard match Question.difficulty, notImportant matches the renamed field", () => {
  assert.equal(matchesSingleStatus(q({ id: "x", difficulty: "easy" }), "difficultyEasy"), true);
  assert.equal(matchesSingleStatus(q({ id: "x", difficulty: "easy" }), "difficultyMedium"), false);
  assert.equal(matchesSingleStatus(q({ id: "x", difficulty: null }), "difficultyEasy"), false);
  assert.equal(matchesSingleStatus(q({ id: "x", notImportant: true }), "notImportant"), true);
});

test("matchesSingleStatus falls through to a plain boolean field lookup for 'visited'", () => {
  assert.equal(matchesSingleStatus(q({ id: "x", visited: true }), "visited"), true);
  assert.equal(matchesSingleStatus(q({ id: "x", visited: false }), "visited"), false);
});

test("matchesTags: no tags selected passes everything; selected tags OR-match against Question.tags", () => {
  assert.equal(matchesTags(q({ id: "x", tags: [] }), []), true);
  assert.equal(matchesTags(q({ id: "x", tags: ["java"] }), []), true);
  assert.equal(matchesTags(q({ id: "x", tags: ["java"] }), ["java"]), true);
  assert.equal(matchesTags(q({ id: "x", tags: ["java"] }), ["sql"]), false);
  assert.equal(matchesTags(q({ id: "x", tags: ["java", "sql"] }), ["sql", "python"]), true);
});

test("filterGroupedData narrows by tags (OR), alongside the status filter", () => {
  const withTag = q({ id: "t1", subject: "S1", topic: "T1", subTopic: "ST1", tags: ["java"] });
  const withoutTag = q({ id: "t2", subject: "S1", topic: "T1", subTopic: "ST1", tags: [] });
  const tree = groupData([withTag, withoutTag], []);
  const filtered = filterGroupedData(tree, { ...emptyFilterState(), tags: ["java"] });
  const ids = filtered.subjects[0].topics[0].subTopics[0].questions.map((qq) => qq.id);
  assert.deepEqual(ids, ["t1"]);
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
