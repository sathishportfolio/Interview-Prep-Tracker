// @ts-check
/**
 * features/notImportant.js — Not Important at the Subject/Topic/SubTopic level. Thin: reads the
 * group's current (derived, see data/group.js) notImportant to decide which way to flip, then calls
 * data/mutations.js's setGroupNotImportant + the shared refresh pipeline. Question-level toggling
 * stays on features/statusFlags.js's generic toggleStatus("notImportant") — no cascade needed at a leaf.
 */
import { setGroupNotImportant } from "../data/mutations.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";

/**
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 * @returns {boolean}
 */
function currentGroupNotImportant(level, scope) {
  const s = appState.groupedUnfiltered.subjects.find((s) => s.subject === scope.subject);
  if (!s) return false;
  if (level === "subject") return !!s.notImportant;
  const t = s.topics.find((t) => t.topic === scope.topic);
  if (!t) return false;
  if (level === "topic") return !!t.notImportant;
  const st = t.subTopics.find((st) => st.subTopic === scope.subTopic);
  return !!st?.notImportant;
}

/**
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 */
export function toggleGroupNotImportant(level, scope) {
  const nextValue = !currentGroupNotImportant(level, scope);
  const data = setGroupNotImportant({ rawData: appState.rawData, emptyGroups: appState.emptyGroups }, level, scope, nextValue);
  applyDataChange(data);
}
