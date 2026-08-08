// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  setBackend, setEventTarget, readSchema, writeSchema, writeFiles,
  writeActiveFileId, writeGlobalToggles, clearAll,
} from "./store.js";
import { emptySchema } from "./schema.js";

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

  writeGlobalToggles({ flatGroupView: true, dragDropOn: true, editModeOn: true, tempMode: false, autoExpandChildrenOn: false });
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
