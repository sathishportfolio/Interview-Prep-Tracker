// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractHostname, isYouTubeUrl, domainLabelFromUrl, faviconUrlFor } from "./linkIcons.js";

test("extractHostname strips a leading www. and lowercases the host", () => {
  assert.equal(extractHostname("https://WWW.Example.com/path?x=1"), "example.com");
});

test("extractHostname assumes https:// for a bare domain with no scheme", () => {
  assert.equal(extractHostname("example.com/page"), "example.com");
});

test("extractHostname returns empty string for unparseable input", () => {
  assert.equal(extractHostname(""), "");
  assert.equal(extractHostname("   "), "");
});

test("isYouTubeUrl matches youtube.com, www.youtube.com, and youtu.be", () => {
  assert.equal(isYouTubeUrl("https://www.youtube.com/watch?v=abc"), true);
  assert.equal(isYouTubeUrl("https://youtube.com/watch?v=abc"), true);
  assert.equal(isYouTubeUrl("https://youtu.be/abc"), true);
  assert.equal(isYouTubeUrl("https://music.youtube.com/watch?v=abc"), true);
});

test("isYouTubeUrl is false for other domains, including a lookalike", () => {
  assert.equal(isYouTubeUrl("https://example.com"), false);
  assert.equal(isYouTubeUrl("https://notyoutube.com"), false);
});

test("domainLabelFromUrl returns the bare hostname", () => {
  assert.equal(domainLabelFromUrl("https://developer.mozilla.org/en-US/docs/Web"), "developer.mozilla.org");
});

test("domainLabelFromUrl falls back to the trimmed raw url when it doesn't parse", () => {
  assert.equal(domainLabelFromUrl("   not a url   "), "not a url");
});

test("faviconUrlFor builds a favicon service URL keyed by hostname", () => {
  assert.equal(faviconUrlFor("https://example.com/page"), "https://www.google.com/s2/favicons?domain=example.com&sz=32");
});

test("faviconUrlFor returns empty string when the hostname can't be determined", () => {
  assert.equal(faviconUrlFor(""), "");
});
