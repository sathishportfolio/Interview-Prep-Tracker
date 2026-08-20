// @ts-check
/**
 * features/tags.js — Global Tags: a question can be tagged from an app-wide tag registry
 * (appState.globalTags/StorageSchemaV1.globalTags), created inline. Thin: calls data/mutations.js's
 * toggleQuestionTag for the per-question side, persistence/store.js's writeGlobalTags for the
 * registry side, then the shared refresh pipeline.
 */
import { toggleQuestionTag } from "../data/mutations.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { refreshTagOptions } from "./filters.js";

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
 * adds it to the given question.
 * @param {string} questionId
 * @param {string} rawTag
 */
export function createAndAddTag(questionId, rawTag) {
  const tag = (rawTag || "").trim();
  if (!tag) return;
  if (!appState.globalTags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
    appState.globalTags = [...appState.globalTags, tag];
    store.writeGlobalTags(appState.globalTags);
    refreshTagOptions();
  }
  toggleTagOnQuestion(questionId, tag);
}
