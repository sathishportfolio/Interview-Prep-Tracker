// @ts-check
/**
 * features/fileManager.js — CSV Upload, Load Sample, Multiple Files & File Switcher, Export
 * Progress, Copy Progress CSV, Reset All Data. Thin: calls data/csv/mainCsv.js + data/filename.js
 * for logic, persistence/store.js to persist, render's patch functions to repaint. Owns no DOM
 * beyond the static controls app.js wires to it.
 * @typedef {import('../types.js').FileRecord} FileRecord
 */
import { parseMainCsv, serializeMainCsv, REQUIRED_COLUMNS } from "../data/csv/mainCsv.js";
import { nextExportFileName } from "../data/filename.js";
import { emptyFilterState } from "../data/filter.js";
import { newFileId } from "../data/id.js";
import { migrateLessImportantToNotImportant, migrateGroupNamesToTitleCase, migrateTagsToTitleCase, backfillTriStateTracking, backfillUpdatedAt } from "../data/mutations.js";
import { toTitleCase } from "../data/textCase.js";
import * as store from "../persistence/store.js";
import { appState, loadFileIntoState } from "../state/appState.js";
import { showToast, promptAction } from "./toast.js";

const FALLBACK_SAMPLE_CSV = `Subject,Topic,SubTopic,Question,Answer,Done,ReviewLater
Java,Core Java,OOP,What is polymorphism?,"Polymorphism lets one interface represent different underlying forms (method overriding/overloading).",false,false
Java,Core Java,OOP,What is encapsulation?,"Bundling data and methods that operate on it within one unit, restricting direct access.",false,false
Java,Collections,List vs Set,What is the difference between List and Set?,"List allows duplicates and preserves insertion order; Set does not allow duplicates.",false,false
SQL,Basics,Joins,What is an INNER JOIN?,"Returns rows that have matching values in both tables.",false,false
SQL,Basics,Joins,What is a LEFT JOIN?,"Returns all rows from the left table, and matched rows from the right table.",false,false
`;

let onFilesChanged = null;

/**
 * @param {{onFilesChanged: () => void}} callbacks Called whenever files/activeFileId change so
 *   app.js can re-render everything from the new appState.
 */
export function initFileManager(callbacks) {
  onFilesChanged = callbacks.onFilesChanged;
}

/**
 * Loads persisted schema into appState — at startup, and also re-run after anything that replaces
 * the schema wholesale (Reset All, a sync pull/bin switch). When there's no file to load, the
 * working copy (rawData/emptyGroups/filterState) must be explicitly cleared here too — appState is
 * one long-lived object for the whole session, so without this a Reset All (or switching to an
 * empty bin) would leave whatever was in rawData before untouched, showing stale questions even
 * though appState.files is now empty.
 */
export function bootstrapFromStorage() {
  const schema = store.readSchema();
  appState.files = schema.files;
  appState.activeFileId = schema.activeFileId;
  appState.primaryFileId = schema.primaryFileId;
  appState.toggles = schema.globalToggles;
  appState.activeQuestion = schema.activeQuestion;
  appState.timer = schema.timer;
  appState.sync = schema.sync;
  appState.globalTags = schema.globalTags;
  appState.globalTagRelations = schema.globalTagRelations;

  let anyChanged = false;
  let migratedGlobalTags = appState.globalTags;
  let anyTagsMigrated = false;
  appState.files = appState.files.map((f) => {
    const migrated = migrateLessImportantToNotImportant(f.rawData);
    const triStateBackfilled = backfillTriStateTracking(migrated.rawData);
    const updatedAtBackfilled = backfillUpdatedAt(triStateBackfilled.rawData);
    const titleCased = migrateGroupNamesToTitleCase(updatedAtBackfilled.rawData, f.emptyGroups);
    const tagsMigrated = migrateTagsToTitleCase(migratedGlobalTags, titleCased.rawData);
    migratedGlobalTags = tagsMigrated.globalTags;
    if (tagsMigrated.changed) anyTagsMigrated = true;
    const tombstones = f.tombstones ?? [];
    if (!migrated.changed && !triStateBackfilled.changed && !updatedAtBackfilled.changed && !titleCased.changed && !tagsMigrated.changed && f.tombstones) return f;
    anyChanged = true;
    return { ...f, rawData: tagsMigrated.rawData, emptyGroups: titleCased.emptyGroups, tombstones };
  });
  if (anyChanged) store.writeFiles(appState.files);
  if (anyTagsMigrated) {
    appState.globalTags = migratedGlobalTags;
    store.writeGlobalTags(appState.globalTags);
  }

  // A primary file (see sync/syncConfig.js's "Set Primary" control) always wins on load, regardless
  // of which file was last active on this device or where it sits in appState.files — that's the
  // whole point of marking one primary across devices. Falls back to the last-active file, then
  // simply the first loaded file, the same as before primary existed.
  const active = appState.files.find((f) => f.id === appState.primaryFileId) || appState.files.find((f) => f.id === appState.activeFileId) || appState.files[0];
  if (active) {
    loadFileIntoState(active);
    if (active.id !== schema.activeFileId) store.writeActiveFileId(active.id);
  } else {
    appState.activeFileId = null;
    appState.rawData = [];
    appState.emptyGroups = [];
    appState.groupLinks = [];
    appState.tombstones = [];
    appState.filterState = emptyFilterState();
  }
}

function persistFiles() {
  store.writeFiles(appState.files);
  store.writeActiveFileId(appState.activeFileId);
}

/**
 * @param {string} fileName
 * @param {string} csvText
 * @returns {{ok: boolean, error?: string}}
 */
export function loadCsvAsNewFile(fileName, csvText) {
  const titledFileName = toTitleCase(fileName);
  if (appState.files.some((f) => f.fileName.toLowerCase() === titledFileName.toLowerCase())) {
    return { ok: false, error: `A file named "${titledFileName}" is already loaded. Rename the file, switch to the existing one, or reset all data first.` };
  }
  const parsed = parseMainCsv(csvText);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  /** @type {FileRecord} */
  const file = {
    id: newFileId(),
    fileName: titledFileName,
    rawData: parsed.rawData,
    emptyGroups: parsed.emptyGroups,
    filters: emptyFilterState(),
    lastExportVersion: null,
    lastExportDate: null,
    gistFileName: null,
    lastPushedHash: null,
    tombstones: [],
    groupLinks: [],
  };
  appState.files = [...appState.files, file];
  appState.activeFileId = file.id;
  loadFileIntoState(file);
  persistFiles();
  if (onFilesChanged) onFilesChanged();
  return { ok: true };
}

/** Creates a brand-new file with 0 questions, ready for bulk-add or a CSV load. */
export function createEmptyFile(fileName) {
  return loadCsvAsNewFile(fileName, REQUIRED_COLUMNS.join(","));
}

/**
 * Ensures there's an active file to write into before a root-level bulk add/update proceeds —
 * without this, pasted rows land in appState.rawData with nothing in appState.files to persist
 * them into, and are silently lost on reload (see bulkAdd.js/bulkUpdate.js callers).
 * @returns {boolean} false if the user cancelled/left the prompt blank
 */
export function ensureActiveFileFromPrompt() {
  if (appState.activeFileId !== null) return true;
  const name = (window.prompt("Name this file before adding questions:", "Untitled") || "").trim();
  if (!name) return false;
  const result = createEmptyFile(name);
  return result.ok;
}

/** Loads the sample dataset (prefers window.csvString if present). */
export function loadSampleData() {
  const csvText = /** @type {any} */ (window).csvString || FALLBACK_SAMPLE_CSV;
  const name = "Sample";
  let fileName = name;
  let n = 1;
  while (appState.files.some((f) => f.fileName === fileName)) {
    n += 1;
    fileName = `${name}-${n}`;
  }
  return loadCsvAsNewFile(fileName, csvText);
}

/**
 * Renames a loaded file via a prompt() dialog (same UX as features/rename.js's Subject/Topic/
 * SubTopic rename) — new name is always Title Cased, same normalization every other file name gets
 * (see loadCsvAsNewFile). Deliberately never touches `gistFileName` (the sync blob's own name) —
 * that's immutable once assigned (see sync/gists.js's assignGistFilenames doc comment) so the sync
 * blob keeps its stable identity across a rename instead of orphaning/duplicating it.
 * @param {string} fileId
 */
export function renameFilePrompt(fileId) {
  const file = appState.files.find((f) => f.id === fileId);
  if (!file) return;
  const rawName = promptAction(`Rename file "${file.fileName}" to:`, file.fileName);
  const newName = toTitleCase((rawName || "").trim());
  if (!newName || newName === file.fileName) return;
  if (appState.files.some((f) => f.id !== fileId && f.fileName.toLowerCase() === newName.toLowerCase())) {
    showToast(`A file named "${newName}" already exists.`, "error");
    return;
  }
  appState.files = appState.files.map((f) => (f.id === fileId ? { ...f, fileName: newName } : f));
  persistFiles();
  if (onFilesChanged) onFilesChanged();
  showToast(`Renamed to "${newName}".`, "success");
}

/**
 * Sets/clears which file is "primary" (see sync/syncConfig.js's Cross-Device Sync manager) — the
 * file bootstrapFromStorage always loads first on every app open, on every device, once this
 * setting itself syncs (it rides in the meta blob alongside globalToggles — see sync/gists.js).
 * Toggles off if the given file is already primary, so there's always a plain "clear primary" path
 * without needing a separate button for it.
 * @param {string} fileId
 */
export function togglePrimaryFile(fileId) {
  const file = appState.files.find((f) => f.id === fileId);
  if (!file) return;
  const next = appState.primaryFileId === fileId ? null : fileId;
  appState.primaryFileId = next;
  store.writePrimaryFileId(next);
  showToast(next ? `"${file.fileName}" set as primary — it'll load first on every device.` : `"${file.fileName}" is no longer primary.`, "success");
}

/** @param {string} fileId */
export function switchToFile(fileId) {
  const file = appState.files.find((f) => f.id === fileId);
  if (!file) return;
  syncActiveFileBackIntoRecord();
  loadFileIntoState(file);
  persistFiles();
  if (onFilesChanged) onFilesChanged();
}

/**
 * Clears the active file back to an empty working copy — used when the current bin has no files
 * at all to show (see app.js's renderFileSwitcher), so the tree correctly falls back to the
 * "no data" state instead of continuing to display whatever file was active before the bin switch.
 */
export function clearActiveFile() {
  syncActiveFileBackIntoRecord();
  appState.activeFileId = null;
  appState.rawData = [];
  appState.emptyGroups = [];
  appState.groupLinks = [];
  appState.tombstones = [];
  appState.filterState = emptyFilterState();
  persistFiles();
}

/** Writes appState's working copy back into the FileRecord before switching/persisting. */
export function syncActiveFileBackIntoRecord() {
  const file = appState.files.find((f) => f.id === appState.activeFileId);
  if (!file) return;
  file.rawData = appState.rawData;
  file.emptyGroups = appState.emptyGroups;
  file.groupLinks = appState.groupLinks;
  file.tombstones = appState.tombstones;
  file.filters = appState.filterState;
}

/** Persists the current working state (call after any mutation). */
export function persistCurrentProgress() {
  syncActiveFileBackIntoRecord();
  persistFiles();
}

/** @returns {{fileName: string, csvText: string}|null} */
export function buildExportPayload() {
  const file = appState.files.find((f) => f.id === appState.activeFileId);
  if (!file) return null;
  syncActiveFileBackIntoRecord();
  const csvText = serializeMainCsv(appState.rawData, appState.emptyGroups);
  const { fileName, exportDate, exportVersion } = nextExportFileName(file.fileName, new Date(), {
    lastExportDate: file.lastExportDate,
    lastExportVersion: file.lastExportVersion,
  });
  file.lastExportDate = exportDate;
  file.lastExportVersion = exportVersion;
  persistFiles();
  return { fileName, csvText };
}

export function downloadProgressCsv() {
  const payload = buildExportPayload();
  if (!payload) return;
  const blob = new Blob([payload.csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = payload.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`Exported ${payload.fileName}`, "success");
}

/**
 * Downloads any file record (active or not) as CSV — used by the Cross-Device Sync manager's
 * per-file Download button (sync/syncConfig.js's buildFileRow), so a file doesn't need to be
 * switched to first just to grab a copy. Unlike downloadProgressCsv, doesn't touch export-version
 * tracking (lastExportDate/lastExportVersion) — that's specific to the main "Export Progress"
 * workflow on the active file, not an ad-hoc grab from the bin manager.
 * @param {string} fileId
 */
export function downloadFile(fileId) {
  if (fileId === appState.activeFileId) syncActiveFileBackIntoRecord();
  const file = appState.files.find((f) => f.id === fileId);
  if (!file) return;
  const csvText = serializeMainCsv(file.rawData, file.emptyGroups);
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${file.fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`Exported ${file.fileName}.csv`, "success");
}

/**
 * Deletes a file from local storage entirely — the local-storage half of a full delete (see
 * sync/gists.js's deleteFileFromGist for the remote half; sync/syncConfig.js's buildFileRow calls
 * both, in that order, so a failed remote removal never leaves the file gone locally but still
 * lingering in the cloud). If the deleted file was active, falls back to another loaded file if one
 * exists, or clears the working copy to the empty state otherwise (mirrors clearActiveFile).
 * @param {string} fileId
 */
export function deleteFile(fileId) {
  const wasActive = fileId === appState.activeFileId;
  appState.files = appState.files.filter((f) => f.id !== fileId);
  if (appState.primaryFileId === fileId) {
    appState.primaryFileId = null;
    store.writePrimaryFileId(null);
  }
  if (wasActive) {
    const next = appState.files[0];
    if (next) {
      loadFileIntoState(next);
    } else {
      appState.activeFileId = null;
      appState.rawData = [];
      appState.emptyGroups = [];
      appState.groupLinks = [];
      appState.tombstones = [];
      appState.filterState = emptyFilterState();
    }
  }
  persistFiles();
  if (onFilesChanged) onFilesChanged();
}

export async function copyProgressCsvToClipboard() {
  const file = appState.files.find((f) => f.id === appState.activeFileId);
  if (!file) return;
  syncActiveFileBackIntoRecord();
  const csvText = serializeMainCsv(appState.rawData, appState.emptyGroups);
  if (!csvText) {
    showToast("Nothing to copy.", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(csvText);
    showToast("Progress CSV copied to clipboard.", "success");
  } catch {
    showToast("Could not copy to clipboard.", "error");
  }
}

/**
 * Wipes every uploaded CSV, all progress, and every setting from this browser — including
 * Cross-Device Sync (Master Key, Bin IDs, known bins) and theme/toggles, not just file data.
 * Re-runs bootstrapFromStorage() against the now-empty schema (store.clearAll()) rather than
 * hand-resetting each appState field here, so this can never drift out of sync with what a fresh
 * install actually looks like — anything bootstrapFromStorage reads from schema gets reset too.
 */
export function resetAllData() {
  store.clearAll();
  bootstrapFromStorage();
  if (onFilesChanged) onFilesChanged();
}

/**
 * Same full wipe as resetAllData, but preserves the Cross-Device Sync connection (GitHub token +
 * gist id) across the reset — for the common case of "wipe my local progress but don't make me
 * reconnect sync". Reads the current sync config BEFORE clearing, then writes it back onto the
 * freshly-cleared schema before bootstrapping from it, so bootstrapFromStorage's own read-back
 * naturally picks it up like everything else.
 */
export function resetAllDataKeepSync() {
  const currentSync = store.readSchema().sync;
  store.clearAll();
  store.writeSync(currentSync);
  bootstrapFromStorage();
  if (onFilesChanged) onFilesChanged();
}
