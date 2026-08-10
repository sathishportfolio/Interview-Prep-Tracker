// @ts-check
/**
 * features/quickAdd.js — Quick Add Topic / SubTopic: inline "add" affordances at the Topic and
 * SubTopic level for quickly creating a new one without leaving the tree (adding a brand-new
 * Subject is bulk-add-only, per feature.md). Creates an empty-group placeholder immediately;
 * the user then adds questions into it via Bulk Add or the move form.
 */
import { createEmptyGroup, addQuestion } from "../data/mutations.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { promptAction, showToast } from "./toast.js";
import { openNode } from "../render/accordion.js";

/** @param {string} subject */
export function quickAddTopic(subject) {
  const name = promptAction("New Topic name:");
  if (!name || !name.trim()) return;
  const rawData = appState.rawData;
  const emptyGroups = createEmptyGroup({ rawData, emptyGroups: appState.emptyGroups }, "topic", { subject, topic: name.trim() }).emptyGroups;
  applyDataChange({ rawData, emptyGroups });
  openNode(`S::${subject}`);
  openNode(`${subject}::T::${name.trim()}`);
  showToast(`Topic "${name.trim()}" added.`, "success");
}

/**
 * @param {string} subject
 * @param {string} topic
 */
export function quickAddSubTopic(subject, topic) {
  const name = promptAction("New SubTopic name:");
  if (!name || !name.trim()) return;
  const rawData = appState.rawData;
  const emptyGroups = createEmptyGroup({ rawData, emptyGroups: appState.emptyGroups }, "subTopic", { subject, topic, subTopic: name.trim() }).emptyGroups;
  applyDataChange({ rawData, emptyGroups });
  openNode(`S::${subject}`);
  openNode(`${subject}::T::${topic}`);
  openNode(`${subject}::${topic}::ST::${name.trim()}`);
  showToast(`SubTopic "${name.trim()}" added.`, "success");
}

/**
 * Quick Add Question: a single `window.prompt` for the question text, added directly into a
 * SubTopic without opening the Bulk Add (CSV) panel — for the common case of adding just one
 * question. Answer is left blank (same as Bulk Add's "Add Answer" path) — use the answer editor
 * afterward to fill it in.
 * @param {string} subject
 * @param {string} topic
 * @param {string} subTopic
 */
export function quickAddQuestion(subject, topic, subTopic) {
  const questionText = promptAction("New question text:");
  if (!questionText || !questionText.trim()) return;
  const result = addQuestion(
    { rawData: appState.rawData, emptyGroups: appState.emptyGroups },
    { subject, topic, subTopic, question: questionText.trim() }
  );
  applyDataChange({ rawData: result.rawData, emptyGroups: result.emptyGroups });
  openNode(`S::${subject}`);
  openNode(`${subject}::T::${topic}`);
  openNode(`${subject}::${topic}::ST::${subTopic}`);
  showToast(`Question added.`, "success");
}
