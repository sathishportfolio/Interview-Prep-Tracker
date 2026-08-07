// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import { markGroupEmpty, unmarkGroupEmpty, pruneEmptyGroups, renameInEmptyGroups } from "./emptyGroups.js";

test("markGroupEmpty adds a placeholder, no dupes", () => {
  let groups = markGroupEmpty([], "S1", "T1", "ST1");
  assert.equal(groups.length, 1);
  groups = markGroupEmpty(groups, "S1", "T1", "ST1");
  assert.equal(groups.length, 1);
});

test("unmarkGroupEmpty removes exact match only", () => {
  let groups = markGroupEmpty([], "S1", "T1", "ST1");
  groups = markGroupEmpty(groups, "S1", "T1", "ST2");
  groups = unmarkGroupEmpty(groups, "S1", "T1", "ST1");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].subTopic, "ST2");
});

test("pruneEmptyGroups removes markers whose group now has real questions", () => {
  let groups = markGroupEmpty([], "S1", "T1", "ST1");
  const rawData = [{ subject: "S1", topic: "T1", subTopic: "ST1" }];
  groups = pruneEmptyGroups(groups, rawData);
  assert.equal(groups.length, 0);
});

test("renameInEmptyGroups rewrites matching entries at the right level", () => {
  let groups = markGroupEmpty([], "S1", "T1", "ST1");
  groups = renameInEmptyGroups(groups, { level: "subTopic", subject: "S1", topic: "T1", subTopic: "ST1", newName: "STNew" });
  assert.equal(groups[0].subTopic, "STNew");
});
