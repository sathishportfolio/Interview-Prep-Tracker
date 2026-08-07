// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextExportFileName, baseNameOf } from "./filename.js";

test("first export of the day gets _v001", () => {
  const now = new Date(2026, 7, 7); // Aug 7
  const result = nextExportFileName("myfile.csv", now, { lastExportDate: null, lastExportVersion: null });
  assert.equal(result.fileName, "myfile_Aug07_v001.csv");
});

test("second same-day export increments to _v002", () => {
  const now = new Date(2026, 7, 7);
  const result = nextExportFileName("myfile.csv", now, { lastExportDate: "Aug07", lastExportVersion: "v001" });
  assert.equal(result.fileName, "myfile_Aug07_v002.csv");
});

test("a new day resets version to _v001", () => {
  const now = new Date(2026, 7, 8);
  const result = nextExportFileName("myfile.csv", now, { lastExportDate: "Aug07", lastExportVersion: "v003" });
  assert.equal(result.fileName, "myfile_Aug08_v001.csv");
});

test("baseNameOf strips an existing versioned suffix so re-export doesn't stack", () => {
  assert.equal(baseNameOf("myfile_Aug07_v002.csv"), "myfile");
  assert.equal(baseNameOf("plainfile.csv"), "plainfile");
});
