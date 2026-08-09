// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { findDuplicateClusters } from "./fuzzyHints.js";

function q(id, question) {
  return { id, subject: "S1", topic: "T1", subTopic: "ST1", question, answer: "" };
}

test("findDuplicateClusters groups exact-match questions into one cluster, flagged hasExactMatch", () => {
  const questions = [
    q("a", "What is the use of Default modifier?"),
    q("b", "What is the use of Default modifier?"),
    q("c", "Totally unrelated question about closures"),
  ];
  const clusters = findDuplicateClusters(questions);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].hasExactMatch, true);
  assert.deepEqual(
    clusters[0].questions.map((x) => x.id).sort(),
    ["a", "b"]
  );
});

test("findDuplicateClusters chains transitive near-duplicates (A~B, B~C) into a single cluster", () => {
  const questions = [
    q("a", "What is the use of the protected access modifier in Java"),
    q("b", "What is the use of the protected access modifier"),
    q("c", "Use of protected access modifier explained"),
    q("d", "How does garbage collection work"),
  ];
  const clusters = findDuplicateClusters(questions);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].questions.length, 3);
});

test("findDuplicateClusters returns no clusters when nothing is similar", () => {
  const questions = [
    q("a", "What is polymorphism"),
    q("b", "Explain garbage collection tuning"),
    q("c", "Describe CAP theorem tradeoffs"),
  ];
  assert.deepEqual(findDuplicateClusters(questions), []);
});

test("findDuplicateClusters ignores empty-question rows without false-matching each other", () => {
  const questions = [q("a", ""), q("b", ""), q("c", "Real question here")];
  assert.deepEqual(findDuplicateClusters(questions), []);
});
