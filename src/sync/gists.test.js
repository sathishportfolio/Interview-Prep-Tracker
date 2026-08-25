// @ts-check
// Exercises applyRemotePullResult's per-question merge (data/syncMerge.js) directly against a
// fabricated gist payload — no network mocking needed, since applyRemotePullResult takes an
// already-fetched `{files, updatedAt}` shape (see sync/github.js's pullFromGist return type).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { applyRemotePullResult } from "./gists.js";
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";

/** @param {Partial<import('../types.js').Question> & {id: string}} overrides */
function q(overrides) {
  return /** @type {any} */ ({
    subject: "S1", topic: "T1", subTopic: "ST1", question: "Q", answer: "",
    done: false, reviewLater: false, duplicate: false, notImportant: false, starred: false, failed: false, visited: false,
    difficulty: null, order: 0, subjectOrder: 0, topicOrder: 0, subTopicOrder: 0,
    srsDue: null, srsStreak: 0, doneCount: 0, doneHistory: [], tags: [], updatedAt: 0,
    ...overrides,
  });
}

const META_FILENAME = "_sync-meta.json";

/** @param {{version?: number}} [meta] */
function metaFileEntry(meta = {}) {
  return { content: JSON.stringify({ schemaVersion: 1, version: meta.version ?? 1, activeDevice: null, lastWriter: "test", lastWriteTimestamp: "now" }) };
}

beforeEach(() => {
  // Reset the appState singleton between tests (no test in this file touches window.localStorage —
  // store.js's default backend no-ops when `window` is undefined, per its own try/catch).
  appState.files = [];
  appState.sync = { ...appState.sync, githubToken: "t", configGistId: "g" };
  store.setEventTarget({ dispatchEvent: () => {} });
});

test("headline scenario: two different questions edited on each side both survive a pull-merge", () => {
  appState.files = [
    {
      id: "file1",
      fileName: "My File",
      rawData: [
        q({ id: "x", answer: "edited-on-device-a", updatedAt: 500 }),
        q({ id: "y", answer: "unedited", updatedAt: 100 }),
      ],
      emptyGroups: [],
      filters: /** @type {any} */ ({}),
      lastExportVersion: null,
      lastExportDate: null,
      gistFileName: "My File.json",
      lastPushedHash: null,
      tombstones: [],
    },
  ];

  const remoteContent = {
    id: "file1",
    fileName: "My File",
    rawData: [
      q({ id: "x", answer: "unedited", updatedAt: 100 }),
      q({ id: "y", answer: "edited-on-device-b", updatedAt: 500 }),
    ],
    emptyGroups: [],
    filters: {},
    lastExportVersion: null,
    lastExportDate: null,
    tombstones: [],
  };

  const result = applyRemotePullResult({
    files: { "My File.json": { content: JSON.stringify(remoteContent) }, [META_FILENAME]: metaFileEntry() },
    updatedAt: Date.now(),
  });

  assert.equal(result.ok, true);
  const merged = appState.files[0];
  const byId = Object.fromEntries(merged.rawData.map((r) => [r.id, r]));
  assert.equal(byId.x.answer, "edited-on-device-a");
  assert.equal(byId.y.answer, "edited-on-device-b");
});

test("a local delete (newer tombstone) beats an older remote copy", () => {
  appState.files = [
    {
      id: "file1",
      fileName: "My File",
      rawData: [],
      emptyGroups: [],
      filters: /** @type {any} */ ({}),
      lastExportVersion: null,
      lastExportDate: null,
      gistFileName: "My File.json",
      lastPushedHash: null,
      tombstones: [{ id: "z", deletedAt: 500 }],
    },
  ];

  const remoteContent = {
    id: "file1",
    fileName: "My File",
    rawData: [q({ id: "z", updatedAt: 100 })],
    emptyGroups: [],
    filters: {},
    lastExportVersion: null,
    lastExportDate: null,
    tombstones: [],
  };

  const result = applyRemotePullResult({
    files: { "My File.json": { content: JSON.stringify(remoteContent) }, [META_FILENAME]: metaFileEntry() },
    updatedAt: Date.now(),
  });

  assert.equal(result.ok, true);
  const merged = appState.files[0];
  assert.equal(merged.rawData.some((r) => r.id === "z"), false);
  assert.equal(merged.tombstones.some((t) => t.id === "z"), true);
});

test("a remote delete tombstone is overridden by a newer local edit (un-delete)", () => {
  appState.files = [
    {
      id: "file1",
      fileName: "My File",
      rawData: [q({ id: "z", answer: "revived-locally", updatedAt: 900 })],
      emptyGroups: [],
      filters: /** @type {any} */ ({}),
      lastExportVersion: null,
      lastExportDate: null,
      gistFileName: "My File.json",
      lastPushedHash: null,
      tombstones: [],
    },
  ];

  const remoteContent = {
    id: "file1",
    fileName: "My File",
    rawData: [],
    emptyGroups: [],
    filters: {},
    lastExportVersion: null,
    lastExportDate: null,
    tombstones: [{ id: "z", deletedAt: 500 }],
  };

  const result = applyRemotePullResult({
    files: { "My File.json": { content: JSON.stringify(remoteContent) }, [META_FILENAME]: metaFileEntry() },
    updatedAt: Date.now(),
  });

  assert.equal(result.ok, true);
  const merged = appState.files[0];
  assert.equal(merged.rawData.some((r) => r.id === "z" && r.answer === "revived-locally"), true);
  assert.equal(merged.tombstones.length, 0);
});

test("a file never pushed before (no gistFileName) has nothing local to merge against and takes the remote copy as-is", () => {
  appState.files = [];

  const remoteContent = {
    id: "file1",
    fileName: "New From Remote",
    rawData: [q({ id: "n", answer: "from-remote", updatedAt: 100 })],
    emptyGroups: [],
    filters: {},
    lastExportVersion: null,
    lastExportDate: null,
    tombstones: [],
  };

  const result = applyRemotePullResult({
    files: { "New From Remote.json": { content: JSON.stringify(remoteContent) }, [META_FILENAME]: metaFileEntry() },
    updatedAt: Date.now(),
  });

  assert.equal(result.ok, true);
  assert.equal(appState.files.length, 1);
  assert.equal(appState.files[0].rawData[0].answer, "from-remote");
});
