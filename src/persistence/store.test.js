// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  setBackend, setEventTarget, readSchema, writeSchema, writeFiles,
  writeActiveFileId, writeGlobalToggles, clearAll,
} from "./store.js";
import { emptySchema, coerceSchema } from "./schema.js";

function makeMemoryBackend() {
  let value = null;
  return {
    getItem: () => value,
    setItem: (v) => { value = v; },
  };
}

test("every write emits iqv:persisted", () => {
  setBackend(makeMemoryBackend());
  let eventCount = 0;
  /** @type {{dispatchEvent: (e:any)=>void}} */
  const fakeTarget = { dispatchEvent: () => { eventCount += 1; } };
  setEventTarget(fakeTarget);

  writeSchema(emptySchema());
  assert.equal(eventCount, 1);

  writeFiles([]);
  assert.equal(eventCount, 2);

  writeActiveFileId("f1");
  assert.equal(eventCount, 3);

  writeGlobalToggles({ flatGroupView: true, dragDropOn: true, editModeOn: true, tempMode: false, autoExpandChildrenOn: false, themeDark: false });
  assert.equal(eventCount, 4);

  clearAll();
  assert.equal(eventCount, 5);
});

test("readSchema round-trips a written schema", () => {
  setBackend(makeMemoryBackend());
  setEventTarget({ dispatchEvent: () => {} });
  const schema = emptySchema();
  schema.activeFileId = "abc";
  writeSchema(schema);
  const read = readSchema();
  assert.equal(read.activeFileId, "abc");
});

test("readSchema returns a default schema when nothing is stored", () => {
  setBackend(makeMemoryBackend());
  const read = readSchema();
  assert.equal(read.files.length, 0);
  assert.equal(read.activeFileId, null);
});

test("coerceSchema infers sync.enabled true for a pre-existing configured schema with no enabled field", () => {
  const schema = coerceSchema({ sync: { masterKey: "k", currentBinId: "b1" } });
  assert.equal(schema.sync.enabled, true);
});

test("coerceSchema keeps an explicit persisted sync.enabled: false even when configured", () => {
  const schema = coerceSchema({ sync: { masterKey: "k", currentBinId: "b1", enabled: false } });
  assert.equal(schema.sync.enabled, false);
});

test("emptySchema defaults sync.enabled to false", () => {
  assert.equal(emptySchema().sync.enabled, false);
});

test("coerceSchema defaults sync.enabled to false when there's no sync object at all", () => {
  assert.equal(coerceSchema({}).sync.enabled, false);
});
