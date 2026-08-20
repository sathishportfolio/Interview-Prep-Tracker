// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeRawData } from "./syncMerge.js";

/** @param {Partial<import('../types.js').Question> & {id: string}} overrides @returns {import('../types.js').Question} */
function q(overrides) {
  return /** @type {any} */ ({ subject: "S", topic: "T", subTopic: "ST", question: "Q", answer: "", updatedAt: 0, ...overrides });
}

test("id present only on side a is included as-is", () => {
  const result = mergeRawData({ rawData: [q({ id: "1" })], tombstones: [] }, { rawData: [], tombstones: [] });
  assert.equal(result.rawData.length, 1);
  assert.equal(result.rawData[0].id, "1");
  assert.equal(result.tombstones.length, 0);
});

test("id present only on side b is included as-is", () => {
  const result = mergeRawData({ rawData: [], tombstones: [] }, { rawData: [q({ id: "1" })], tombstones: [] });
  assert.equal(result.rawData.length, 1);
  assert.equal(result.rawData[0].id, "1");
});

test("tombstone present only on side a is included as-is", () => {
  const result = mergeRawData({ rawData: [], tombstones: [{ id: "1", deletedAt: 100 }] }, { rawData: [], tombstones: [] });
  assert.equal(result.rawData.length, 0);
  assert.deepEqual(result.tombstones, [{ id: "1", deletedAt: 100 }]);
});

test("both alive, a newer updatedAt wins", () => {
  const result = mergeRawData(
    { rawData: [q({ id: "1", answer: "from-a", updatedAt: 200 })], tombstones: [] },
    { rawData: [q({ id: "1", answer: "from-b", updatedAt: 100 })], tombstones: [] }
  );
  assert.equal(result.rawData[0].answer, "from-a");
});

test("both alive, b newer updatedAt wins", () => {
  const result = mergeRawData(
    { rawData: [q({ id: "1", answer: "from-a", updatedAt: 100 })], tombstones: [] },
    { rawData: [q({ id: "1", answer: "from-b", updatedAt: 200 })], tombstones: [] }
  );
  assert.equal(result.rawData[0].answer, "from-b");
});

test("both alive, exact tie deterministically prefers side a", () => {
  const result = mergeRawData(
    { rawData: [q({ id: "1", answer: "from-a", updatedAt: 100 })], tombstones: [] },
    { rawData: [q({ id: "1", answer: "from-b", updatedAt: 100 })], tombstones: [] }
  );
  assert.equal(result.rawData[0].answer, "from-a");
});

test("tombstone newer than the other side's alive copy stays deleted", () => {
  const result = mergeRawData(
    { rawData: [q({ id: "1", updatedAt: 100 })], tombstones: [] },
    { rawData: [], tombstones: [{ id: "1", deletedAt: 200 }] }
  );
  assert.equal(result.rawData.length, 0);
  assert.deepEqual(result.tombstones, [{ id: "1", deletedAt: 200 }]);
});

test("alive copy newer than a tombstone un-deletes (edited elsewhere after the delete propagated)", () => {
  const result = mergeRawData(
    { rawData: [q({ id: "1", answer: "revived", updatedAt: 300 })], tombstones: [] },
    { rawData: [], tombstones: [{ id: "1", deletedAt: 200 }] }
  );
  assert.equal(result.rawData.length, 1);
  assert.equal(result.rawData[0].answer, "revived");
  assert.equal(result.tombstones.length, 0);
});

test("exact tie between an alive copy and a tombstone prefers alive (never silently loses data)", () => {
  const result = mergeRawData(
    { rawData: [q({ id: "1", updatedAt: 100 })], tombstones: [] },
    { rawData: [], tombstones: [{ id: "1", deletedAt: 100 }] }
  );
  assert.equal(result.rawData.length, 1);
});

test("both sides tombstoned for the same id: higher deletedAt wins without duplicating", () => {
  const result = mergeRawData(
    { rawData: [], tombstones: [{ id: "1", deletedAt: 100 }] },
    { rawData: [], tombstones: [{ id: "1", deletedAt: 200 }] }
  );
  assert.equal(result.tombstones.length, 1);
  assert.equal(result.tombstones[0].deletedAt, 200);
});

test("empty a/b merges to empty", () => {
  const result = mergeRawData({ rawData: [], tombstones: [] }, { rawData: [], tombstones: [] });
  assert.deepEqual(result, { rawData: [], tombstones: [] });
});

test("missing updatedAt on both sides (legacy data) doesn't crash, tie-break still applies", () => {
  const result = mergeRawData(
    { rawData: [q({ id: "1", answer: "from-a", updatedAt: undefined })], tombstones: [] },
    { rawData: [q({ id: "1", answer: "from-b", updatedAt: undefined })], tombstones: [] }
  );
  assert.equal(result.rawData.length, 1);
  assert.equal(result.rawData[0].answer, "from-a");
});

test("headline scenario: two different questions edited on each side both survive", () => {
  const result = mergeRawData(
    {
      rawData: [
        q({ id: "x", answer: "edited-on-a", updatedAt: 500 }),
        q({ id: "y", answer: "unedited", updatedAt: 100 }),
      ],
      tombstones: [],
    },
    {
      rawData: [
        q({ id: "x", answer: "unedited", updatedAt: 100 }),
        q({ id: "y", answer: "edited-on-b", updatedAt: 500 }),
      ],
      tombstones: [],
    }
  );
  const byId = Object.fromEntries(result.rawData.map((r) => [r.id, r]));
  assert.equal(byId.x.answer, "edited-on-a");
  assert.equal(byId.y.answer, "edited-on-b");
});
