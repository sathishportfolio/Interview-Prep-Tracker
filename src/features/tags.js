// @ts-check
/**
 * features/tags.js — Global Tags: a question can be tagged from an app-wide tag registry
 * (appState.globalTags/StorageSchemaV1.globalTags), created inline. Thin: calls data/mutations.js's
 * toggleQuestionTag for the per-question side, persistence/store.js's writeGlobalTags for the
 * registry side, then the shared refresh pipeline.
 */
import { toggleQuestionTag, renameTag, applyRelatedTagToQuestions } from "../data/mutations.js";
import { applyDataChange, recompute, repaint } from "./refresh.js";
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { refreshTagOptions, refreshAfterExternalFilterStateChange } from "./filters.js";
import { promptAction, confirmAction, showToast } from "./toast.js";
import { toTitleCase } from "../data/textCase.js";

/**
 * @param {string} questionId
 * @param {string} tag
 */
export function toggleTagOnQuestion(questionId, tag) {
  // Only stamp lastTaggedAt (see touchTagMeta) when the tag is being turned ON, not off — checked
  // against the PRE-toggle state, since toggleQuestionTag below flips it either way.
  const turningOn = !appState.rawData.find((q) => q.id === questionId)?.tags?.includes(tag);
  const rawData = toggleQuestionTag(appState.rawData, questionId, tag, appState.globalTagRelations);
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
  if (turningOn) touchTagMeta(tag, { lastTaggedAt: Date.now() });
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
    stampTagCreated(tag);
    refreshTagOptions();
  }
  toggleTagOnQuestion(questionId, tag);
}

/**
 * Creates a new tag in the global registry without attaching it to any question — for pre-seeding a
 * tag before any question uses it yet. Shared by the Manage Tags popup's "+ Add Tag" row
 * (features/tagManager.js).
 * @param {string} rawTag
 * @returns {boolean} true if a new tag was created (false if empty or already existed).
 */
export function createGlobalTag(rawTag) {
  const tag = toTitleCase((rawTag || "").trim());
  if (!tag) return false;
  if (appState.globalTags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
    showToast(`Tag "${tag}" already exists.`, "error");
    return false;
  }
  appState.globalTags = [...appState.globalTags, tag];
  store.writeGlobalTags(appState.globalTags);
  stampTagCreated(tag);
  refreshTagOptions();
  showToast(`Tag "${tag}" added.`, "success");
  return true;
}

/**
 * @param {string} tag
 * @returns {string[]} appState.globalTagRelations[tag], or [] if it has no related tags mapped.
 */
export function getRelatedTags(tag) {
  return appState.globalTagRelations[tag] || [];
}

/**
 * @param {string} tag
 * @returns {{icon?: string, createdAt?: number, modifiedAt?: number, lastTaggedAt?: number}}
 *   appState.globalTagMeta[tag], or {} if unset.
 */
export function getTagMeta(tag) {
  return appState.globalTagMeta[tag] || {};
}

/**
 * Merges `patch` into `tag`'s meta and persists — the shared write path every meta-touching action
 * below (icon edits, related-tag edits, tagging a question) funnels through, so appState/storage
 * never fall out of sync with each other.
 * @param {string} tag
 * @param {Record<string, any>} patch
 */
function touchTagMeta(tag, patch) {
  appState.globalTagMeta = { ...appState.globalTagMeta, [tag]: { ...getTagMeta(tag), ...patch } };
  store.writeGlobalTagMeta(appState.globalTagMeta);
}

/**
 * Stamps a freshly-created tag's createdAt (for the Manage Tags popup's "Recently Added" sort) and
 * modifiedAt (creation counts as this tag's own first "modification" too, for "Recently Modified" —
 * see features/tagManager.js's sortTags).
 * @param {string} tag
 */
function stampTagCreated(tag) {
  const now = Date.now();
  touchTagMeta(tag, { createdAt: now, modifiedAt: now });
}

/**
 * Sets (or, given an empty/whitespace-only string, clears) `tag`'s custom FontAwesome icon class
 * (e.g. "fa-solid fa-clock") — see data/tagIcon.js's pickDisplayTagIcon for how it's picked for
 * display: always the FIRST tag in a question's own tag list, so there's never a conflict between
 * several icon-bearing tags to resolve.
 * @param {string} tag
 * @param {string} iconClass
 */
export function setTagIcon(tag, iconClass) {
  const icon = (iconClass || "").trim();
  touchTagMeta(tag, { icon: icon || undefined, modifiedAt: Date.now() });
}

/**
 * Maps `relatedTag` onto `tag` — adding `tag` to a question will also auto-apply `relatedTag` (and
 * transitively, whatever `relatedTag` itself maps to — see data/mutations.js's toggleQuestionTag).
 * Retroactive Tag Sync: also immediately back-applies `relatedTag` to every question (across every
 * loaded file) that already carries `tag`, so questions tagged before this relation existed aren't
 * left out of sync with it.
 * @param {string} tag
 * @param {string} relatedTag
 */
export function addRelatedTag(tag, relatedTag) {
  if (tag === relatedTag) return;
  const current = getRelatedTags(tag);
  if (current.includes(relatedTag)) return;
  appState.globalTagRelations = { ...appState.globalTagRelations, [tag]: [...current, relatedTag] };
  store.writeGlobalTagRelations(appState.globalTagRelations);
  touchTagMeta(tag, { modifiedAt: Date.now() });
  applyTagChangeAcrossFiles((rawData) => applyRelatedTagToQuestions(rawData, tag, relatedTag, "add"));
}

/**
 * Un-maps `relatedTag` from `tag` — the reverse of addRelatedTag. Only removes this ONE direction;
 * if `relatedTag` separately maps back to `tag`, that direction is untouched. Retroactive Tag Sync:
 * also immediately strips `relatedTag` back off every question (across every loaded file) that
 * carries `tag`, mirroring addRelatedTag's back-apply so removing a relation is just as retroactive
 * as adding one.
 * @param {string} tag
 * @param {string} relatedTag
 */
export function removeRelatedTag(tag, relatedTag) {
  const next = getRelatedTags(tag).filter((t) => t !== relatedTag);
  appState.globalTagRelations = { ...appState.globalTagRelations, [tag]: next };
  store.writeGlobalTagRelations(appState.globalTagRelations);
  touchTagMeta(tag, { modifiedAt: Date.now() });
  applyTagChangeAcrossFiles((rawData) => applyRelatedTagToQuestions(rawData, tag, relatedTag, "remove"));
}

/**
 * Renames `oldTag` to `newTag` everywhere it appears in the relations map — as a key (its own related
 * tags list carries over) and as a value inside every OTHER tag's related-tags list. If `newTag`
 * already has its own key (a rename-into-existing-tag merge, mirroring renameTagPrompt's question-tag
 * merge below), the two related-tags lists are unioned.
 * @param {Record<string, string[]>} relations
 * @param {string} oldTag
 * @param {string} newTag
 * @returns {Record<string, string[]>}
 */
function renameTagInRelations(relations, oldTag, newTag) {
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const [key, related] of Object.entries(relations)) {
    if (key === oldTag) continue;
    const renamedRelated = related.map((t) => (t === oldTag ? newTag : t));
    out[key === newTag ? newTag : key] = [...new Set([...(out[key] || []), ...renamedRelated])];
  }
  const ownRelated = (relations[oldTag] || []).map((t) => (t === oldTag ? newTag : t));
  if (ownRelated.length > 0 || relations[oldTag]) {
    out[newTag] = [...new Set([...(out[newTag] || []), ...ownRelated])].filter((t) => t !== newTag);
  }
  return out;
}

/**
 * Strips `tag` out of the relations map entirely — drops its own key and removes it from every
 * other tag's related-tags list.
 * @param {Record<string, string[]>} relations
 * @param {string} tag
 * @returns {Record<string, string[]>}
 */
function removeTagFromRelations(relations, tag) {
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const [key, related] of Object.entries(relations)) {
    if (key === tag) continue;
    out[key] = related.filter((t) => t !== tag);
  }
  return out;
}

/**
 * Carries `oldTag`'s icon meta over to `newTag` — mirrors renameTagInRelations above, but
 * meta is single-valued (not a list to union), so a rename-into-existing-tag merge just keeps
 * whichever meta `newTag` already had rather than combining the two.
 * @param {Record<string, {icon?: string, createdAt?: number, modifiedAt?: number, lastTaggedAt?: number}>} meta
 * @param {string} oldTag
 * @param {string} newTag
 * @returns {Record<string, {icon?: string, createdAt?: number, modifiedAt?: number, lastTaggedAt?: number}>}
 */
function renameTagInMeta(meta, oldTag, newTag) {
  if (!(oldTag in meta)) return meta;
  const next = { ...meta };
  const oldMeta = next[oldTag];
  delete next[oldTag];
  if (!next[newTag]) next[newTag] = oldMeta;
  return next;
}

/**
 * Strips `tag`'s meta entry out entirely — mirrors removeTagFromRelations above.
 * @param {Record<string, {icon?: string, createdAt?: number, modifiedAt?: number, lastTaggedAt?: number}>} meta
 * @param {string} tag
 * @returns {Record<string, {icon?: string, createdAt?: number, modifiedAt?: number, lastTaggedAt?: number}>}
 */
function removeTagFromMeta(meta, tag) {
  if (!(tag in meta)) return meta;
  const next = { ...meta };
  delete next[tag];
  return next;
}

/**
 * Counts how many questions across every loaded file currently carry `tag` — used to warn before a
 * rename/delete, and by features/tagManager.js's "Most Tagged" sort. Reads the active file off
 * `appState.rawData` (the live working copy) rather than its possibly-stale FileRecord entry, and
 * every other file's own `rawData` as persisted.
 * @param {string} tag
 * @returns {number}
 */
export function countQuestionsWithTag(tag) {
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

  appState.globalTagRelations = renameTagInRelations(appState.globalTagRelations, oldTag, newTag);
  store.writeGlobalTagRelations(appState.globalTagRelations);

  appState.globalTagMeta = renameTagInMeta(appState.globalTagMeta, oldTag, newTag);
  store.writeGlobalTagMeta(appState.globalTagMeta);
  touchTagMeta(newTag, { modifiedAt: Date.now() });

  applyTagChangeAcrossFiles((rawData) => renameTag(rawData, oldTag, newTag));
  refreshTagOptions();
  // If the renamed tag was itself part of the active Tags filter, swap it in place and re-apply —
  // otherwise the filter keeps pointing at a tag name no longer present in the data and silently
  // matches nothing until the user manually clears and re-picks it.
  if (appState.filterState.tags.includes(oldTag)) {
    appState.filterState = { ...appState.filterState, tags: appState.filterState.tags.map((t) => (t === oldTag ? newTag : t)) };
    refreshAfterExternalFilterStateChange();
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

  appState.globalTagRelations = removeTagFromRelations(appState.globalTagRelations, tag);
  store.writeGlobalTagRelations(appState.globalTagRelations);

  appState.globalTagMeta = removeTagFromMeta(appState.globalTagMeta, tag);
  store.writeGlobalTagMeta(appState.globalTagMeta);

  applyTagChangeAcrossFiles((rawData) => rawData.map((q) => (q.tags?.includes(tag) ? { ...q, tags: q.tags.filter((t) => t !== tag), updatedAt: Date.now() } : q)));
  refreshTagOptions();
  // Same "keep the active filter pointed at something real" concern as renameTagPrompt above — a
  // deleted tag still selected in the Tags filter must be dropped from it, not just from the registry.
  if (appState.filterState.tags.includes(tag)) {
    appState.filterState = { ...appState.filterState, tags: appState.filterState.tags.filter((t) => t !== tag) };
    refreshAfterExternalFilterStateChange();
  }
  showToast(`Deleted tag "${tag}".`, "success");
}
