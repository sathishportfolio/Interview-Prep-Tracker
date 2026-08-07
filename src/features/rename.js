// @ts-check
/**
 * features/rename.js — Rename Subject/Topic/SubTopic via a prompt() dialog (feature.md is explicit
 * about "prompt dialog"). Cascades to every question underneath + matching empty-group placeholder
 * via data/mutations.js.renameGroup.
 */
import { renameGroup } from "../data/mutations.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { promptAction, showToast } from "./toast.js";

/**
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 */
export function renameGroupPrompt(level, scope) {
  const currentName = level === "subject" ? scope.subject : level === "topic" ? scope.topic : scope.subTopic;
  const newName = promptAction(`Rename ${level} "${currentName}" to:`, currentName);
  if (!newName || !newName.trim() || newName.trim() === currentName) return;
  const result = renameGroup({ rawData: appState.rawData, emptyGroups: appState.emptyGroups }, level, scope, newName.trim());
  applyDataChange(result);
  showToast(`Renamed to "${newName.trim()}".`, "success");
}
