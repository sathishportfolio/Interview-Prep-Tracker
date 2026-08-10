// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import { wrapAnswerAsList, minifyHtml, minifyAllAnswers } from "./answerFormat.js";

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

test("minifyHtml collapses whitespace between tags", () => {
  assert.equal(minifyHtml("<ul>\n  <li>Some text</li>\n</ul>"), "<ul><li>Some text</li></ul>");
});

test("minifyHtml collapses runs of whitespace inside text content to a single space", () => {
  assert.equal(minifyHtml("<ul><li>Some   text\n  here</li></ul>"), "<ul><li>Some text here</li></ul>");
});

test("minifyHtml trims leading/trailing whitespace", () => {
  assert.equal(minifyHtml("  <ul><li>Text</li></ul>  "), "<ul><li>Text</li></ul>");
});

test("minifyHtml is a no-op on already-minified HTML", () => {
  const minified = "<ul><li>Some text here</li></ul>";
  assert.equal(minifyHtml(minified), minified);
});

test("minifyAllAnswers minifies only answers that need it, reporting changed:true", () => {
  const rawData = [
    { id: "a", answer: "<ul>\n  <li>Needs minifying</li>\n</ul>" },
    { id: "b", answer: "<ul><li>Already minified</li></ul>" },
    { id: "c", answer: "" },
  ];
  const result = minifyAllAnswers(rawData);
  assert.equal(result.changed, true);
  assert.equal(result.rawData.find((q) => q.id === "a").answer, "<ul><li>Needs minifying</li></ul>");
  // Untouched questions keep their exact original object reference (no unnecessary churn).
  assert.equal(result.rawData.find((q) => q.id === "b"), rawData[1]);
  assert.equal(result.rawData.find((q) => q.id === "c"), rawData[2]);
});

test("minifyAllAnswers reports changed:false when nothing needs minifying", () => {
  const rawData = [{ id: "a", answer: "<ul><li>Already minified</li></ul>" }, { id: "b", answer: "" }];
  const result = minifyAllAnswers(rawData);
  assert.equal(result.changed, false);
  assert.deepEqual(result.rawData, rawData);
});
