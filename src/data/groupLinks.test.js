// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getGroupLinks, addGroupLink, updateGroupLink, removeGroupLink, reorderGroupLinks,
  renameInGroupLinks, moveGroupLinksScope, removeGroupLinksForScope,
} from "./groupLinks.js";

test("addGroupLink creates a new entry, then appends to the existing one at the same scope", () => {
  let links = addGroupLink([], "S1", "T1", "ST1", { label: "A", url: "https://a" });
  assert.equal(links.length, 1);
  assert.equal(links[0].links.length, 1);
  links = addGroupLink(links, "S1", "T1", "ST1", { label: "B", url: "https://b" });
  assert.equal(links.length, 1);
  assert.equal(links[0].links.length, 2);
});

test("getGroupLinks returns [] for a scope with no entry, and only that scope's links otherwise", () => {
  let links = addGroupLink([], "S1", "T1", null, { label: "A", url: "https://a" });
  assert.deepEqual(getGroupLinks(links, "S1", "T1", "ST1"), []);
  assert.equal(getGroupLinks(links, "S1", "T1", null).length, 1);
});

test("updateGroupLink edits in place; removeGroupLink drops the link and prunes the entry once empty", () => {
  let links = addGroupLink([], "S1", null, null, { label: "A", url: "https://a" });
  const linkId = links[0].links[0].id;
  links = updateGroupLink(links, "S1", null, null, linkId, { label: "A2", url: "https://a2" });
  assert.equal(links[0].links[0].label, "A2");
  links = removeGroupLink(links, "S1", null, null, linkId);
  assert.equal(links.length, 0);
});

test("reorderGroupLinks reorders only the matching scope's links", () => {
  let links = addGroupLink([], "S1", "T1", "ST1", { label: "A", url: "https://a" });
  links = addGroupLink(links, "S1", "T1", "ST1", { label: "B", url: "https://b" });
  const [a, b] = links[0].links;
  links = reorderGroupLinks(links, "S1", "T1", "ST1", [b.id, a.id]);
  assert.deepEqual(links[0].links.map((l) => l.label), ["B", "A"]);
});

test("renameInGroupLinks cascades a Topic rename onto its own entry AND every SubTopic entry under it", () => {
  let links = addGroupLink([], "S1", "T1", null, { label: "Topic link", url: "https://t" });
  links = addGroupLink(links, "S1", "T1", "ST1", { label: "SubTopic link", url: "https://st" });
  links = renameInGroupLinks(links, { level: "topic", subject: "S1", topic: "T1", newName: "T1-renamed" });
  assert.ok(links.every((e) => e.topic === "T1-renamed"));
});

test("renameInGroupLinks merges (not clobbers) when the rename collides with an existing entry at the same scope", () => {
  let links = addGroupLink([], "S1", "T1", "ST1", { label: "A", url: "https://a" });
  links = addGroupLink(links, "S1", "T1", "ST2", { label: "B", url: "https://b" });
  links = renameInGroupLinks(links, { level: "subTopic", subject: "S1", topic: "T1", subTopic: "ST2", newName: "ST1" });
  assert.equal(links.length, 1);
  assert.equal(links[0].links.length, 2);
});

test("moveGroupLinksScope(topic) moves the topic's own entry and its SubTopic entries to the new Subject, preserving the topic name", () => {
  let links = addGroupLink([], "S1", "T1", null, { label: "Topic link", url: "https://t" });
  links = addGroupLink(links, "S1", "T1", "ST1", { label: "SubTopic link", url: "https://st" });
  links = moveGroupLinksScope(links, "topic", { subject: "S1", topic: "T1" }, { subject: "S2" });
  assert.ok(links.every((e) => e.subject === "S2" && e.topic === "T1"));
});

test("removeGroupLinksForScope(topic) removes the topic's own entry and every SubTopic entry under it, leaving other Topics untouched", () => {
  let links = addGroupLink([], "S1", "T1", "ST1", { label: "A", url: "https://a" });
  links = addGroupLink(links, "S1", "T2", "ST1", { label: "B", url: "https://b" });
  links = removeGroupLinksForScope(links, "topic", { subject: "S1", topic: "T1" });
  assert.equal(links.length, 1);
  assert.equal(links[0].topic, "T2");
});
