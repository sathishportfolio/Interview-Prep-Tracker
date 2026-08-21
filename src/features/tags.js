// @ts-check
/**
 * features/tags.js — Global Tags: a question can be tagged from an app-wide tag registry
 * (appState.globalTags/StorageSchemaV1.globalTags), created inline. Thin: calls data/mutations.js's
 * toggleQuestionTag for the per-question side, persistence/store.js's writeGlobalTags for the
 * registry side, then the shared refresh pipeline.
 */
import { toggleQuestionTag, renameTag } from "../data/mutations.js";
import { applyDataChange, recompute, repaint } from "./refresh.js";
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { refreshTagOptions } from "./filters.js";
import { promptAction, confirmAction, showToast } from "./toast.js";
import { toTitleCase } from "../data/textCase.js";

/**
 * @param {string} questionId
 * @param {string} tag
 */
export function toggleTagOnQuestion(questionId, tag) {
  const rawData = toggleQuestionTag(appState.rawData, questionId, tag);
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
}

/**
 * Creates a new tag (if it doesn't already exist, case-insensitive) in the global registry, then
 * adds it to the given question. Always stored/compared Title Case (see data/textCase.js), same
 * normalization Subject/Topic/SubTopic names get.
 * @param {string} questionId
 * @param {string} rawTag
 */
export function createAndAddTag(questionId, rawTag) {
  const tag = toTitleCase((rawTag || "").trim());
  if (!tag) return;
  if (!appState.globalTags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
    appState.globalTags = [...appState.globalTags, tag];
    store.writeGlobalTags(appState.globalTags);
    refreshTagOptions();
  }
  toggleTagOnQuestion(questionId, tag);
}

/**
 * Filter card's "+ Add Tag" button: a plain `prompt()` to create a new tag in the global registry
 * without attaching it to any question — for pre-seeding a tag before any question uses it yet.
 */
export function addGlobalTagPrompt() {
  const rawTag = promptAction("New tag name:");
  const tag = toTitleCase((rawTag || "").trim());
  if (!tag) return;
  if (appState.globalTags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
    showToast(`Tag "${tag}" already exists.`, "error");
    return;
  }
  appState.globalTags = [...appState.globalTags, tag];
  store.writeGlobalTags(appState.globalTags);
  refreshTagOptions();
  showToast(`Tag "${tag}" added.`, "success");
}

/**
 * Counts how many questions across every loaded file currently carry `tag` — used to warn before a
 * rename/delete. Reads the active file off `appState.rawData` (the live working copy) rather than
 * its possibly-stale FileRecord entry, and every other file's own `rawData` as persisted.
 * @param {string} tag
 * @returns {number}
 */
function countQuestionsWithTag(tag) {
  let count = 0;
  for (const file of appState.files) {
    const rawData = file.id === appState.activeFileId ? appState.rawData : file.rawData;
    count += rawData.filter((q) => q.tags?.includes(tag)).length;
  }
  return count;
}

/**
 * Applies `mapRawData` to every loaded file's questions (active file via the normal
 * recompute/persist/repaint pipeline, every other file by mutating its stored rawData directly and
 * persisting the whole files array) — tag rename/delete affect the tag registry, a single
 * app-wide list, so every file that might reference the tag needs to be touched, not just the
 * active one (unlike most mutations, which only ever act on the active file's rawData).
 * @param {(rawData: import('../types.js').Question[]) => import('../types.js').Question[]} mapRawData
 */
function applyTagChangeAcrossFiles(mapRawData) {
  appState.rawData = mapRawData(appState.rawData);
  appState.files = appState.files.map((f) =>
    f.id === appState.activeFileId ? { ...f, rawData: appState.rawData } : { ...f, rawData: mapRawData(f.rawData) }
  );
  recompute();
  store.writeFiles(appState.files);
  repaint();
}

/**
 * Renames a tag in the global registry and every question (across every loaded file) that carries
 * it, via a prompt() dialog (same UX as features/rename.js's Subject/Topic/SubTopic rename). New
 * name is Title Cased and, if it collides (case-insensitively) with another existing tag, the two
 * are merged rather than left as duplicates.
 * @param {string} oldTag
 */
export function renameTagPrompt(oldTag) {
  const rawNewTag = promptAction(`Rename tag "${oldTag}" to:`, oldTag);
  const newTag = toTitleCase((rawNewTag || "").trim());
  if (!newTag || newTag === oldTag) return;

  appState.globalTags = appState.globalTags.filter((t) => t.toLowerCase() !== newTag.toLowerCase() || t === oldTag);
  appState.globalTags = appState.globalTags.map((t) => (t === oldTag ? newTag : t));
  store.writeGlobalTags(appState.globalTags);

  applyTagChangeAcrossFiles((rawData) => renameTag(rawData, oldTag, newTag));
  refreshTagOptions();
  if (appState.filterState.tags.includes(oldTag)) {
    appState.filterState = { ...appState.filterState, tags: appState.filterState.tags.map((t) => (t === oldTag ? newTag : t)) };
  }
  showToast(`Renamed tag to "${newTag}".`, "success");
}

/**
 * Deletes a tag from the global registry and strips it from every question (across every loaded
 * file) that carries it — warns with a usage count first (same "count + pluralized note in the
 * confirm message" pattern as features/bulkSelection.js's bulkDeleteSelected), but never blocks the
 * delete the way group deletes do.
 * @param {string} tag
 */
export function deleteTagPrompt(tag) {
  const count = countQuestionsWithTag(tag);
  const usageNote = count > 0 ? ` It is currently applied to ${count} question${count === 1 ? "" : "s"} across your files — it will be removed from all of them.` : "";
  if (!confirmAction(`Delete tag "${tag}"?${usageNote} This cannot be undone.`)) return;

  appState.globalTags = appState.globalTags.filter((t) => t !== tag);
  store.writeGlobalTags(appState.globalTags);

  applyTagChangeAcrossFiles((rawData) => rawData.map((q) => (q.tags?.includes(tag) ? { ...q, tags: q.tags.filter((t) => t !== tag), updatedAt: Date.now() } : q)));
  refreshTagOptions();
  if (appState.filterState.tags.includes(tag)) {
    appState.filterState = { ...appState.filterState, tags: appState.filterState.tags.filter((t) => t !== tag) };
  }
  showToast(`Deleted tag "${tag}".`, "success");
}
