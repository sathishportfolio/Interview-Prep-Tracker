// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import { wrapAnswerAsList } from "./answerFormat.js";

test("wrapAnswerAsList wraps plain text in <ul><li>", () => {
  assert.equal(wrapAnswerAsList("Plain answer text"), "<ul><li>Plain answer text</li></ul>");
});

test("wrapAnswerAsList leaves an already-wrapped answer untouched", () => {
  const already = "<ul><li>Already a list</li></ul>";
  assert.equal(wrapAnswerAsList(already), already);
});

test("wrapAnswerAsList is case-insensitive when detecting an existing list", () => {
  const already = "<UL><LI>Already a list</LI></UL>";
  assert.equal(wrapAnswerAsList(already), already);
});

test("wrapAnswerAsList leaves a blank/whitespace-only answer untouched", () => {
  assert.equal(wrapAnswerAsList(""), "");
  assert.equal(wrapAnswerAsList("   "), "   ");
});

test("wrapAnswerAsList trims surrounding whitespace when wrapping", () => {
  assert.equal(wrapAnswerAsList("  Plain answer  "), "<ul><li>Plain answer</li></ul>");
});

test("wrapAnswerAsList wraps HTML that isn't already a top-level <ul><li>", () => {
  assert.equal(wrapAnswerAsList("<p>Some paragraph</p>"), "<ul><li><p>Some paragraph</p></li></ul>");
});
