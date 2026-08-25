// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatRelativeTime } from "./relativeTime.js";

const NOW = Date.parse("2026-08-20T12:00:00Z");

test("Just now for anything under a minute", () => {
  assert.equal(formatRelativeTime(NOW - 30 * 1000, NOW), "Just now");
});

test("minutes", () => {
  assert.equal(formatRelativeTime(NOW - 5 * 60 * 1000, NOW), "5 min");
  assert.equal(formatRelativeTime(NOW - 1 * 60 * 1000, NOW), "1 min");
});

test("hours", () => {
  assert.equal(formatRelativeTime(NOW - 3 * 60 * 60 * 1000, NOW), "3 hr");
  assert.equal(formatRelativeTime(NOW - 1 * 60 * 60 * 1000, NOW), "1 hr");
});

test("days", () => {
  assert.equal(formatRelativeTime(NOW - 2 * 24 * 60 * 60 * 1000, NOW), "2 day");
});

test("months", () => {
  assert.equal(formatRelativeTime(NOW - 60 * 24 * 60 * 60 * 1000, NOW), "2 mon");
});

test("years", () => {
  assert.equal(formatRelativeTime(NOW - 400 * 24 * 60 * 60 * 1000, NOW), "1 yr");
});

test("future/equal timestamps clamp to Just now instead of going negative", () => {
  assert.equal(formatRelativeTime(NOW + 5000, NOW), "Just now");
  assert.equal(formatRelativeTime(NOW, NOW), "Just now");
});
