// @ts-check
/**
 * features/rename.js — Rename Subject/Topic/SubTopic via a prompt() dialog (feature.md is explicit
 * about "prompt dialog"). Cascades to every question underneath + matching empty-group placeholder
 * via data/mutations.js.renameGroup.
 */
import { renameGroup } from "../data/mutations.js";
import { renameInGroupLinks } from "../data/groupLinks.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { promptAction, showToast } from "./toast.js";
import { toTitleCase } from "../data/textCase.js";
import { refreshAfterExternalFilterStateChange } from "./filters.js";

/**
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 */
export function renameGroupPrompt(level, scope) {
  const currentName = level === "subject" ? scope.subject : level === "topic" ? scope.topic : scope.subTopic;
  const newNameRaw = promptAction(`Rename ${level} "${currentName}" to:`, currentName);
  if (!newNameRaw || !newNameRaw.trim() || newNameRaw.trim() === currentName) return;
  // Title-cased ahead of time (data/mutations.js's renameGroup does this internally too) so the name
  // used to patch the active filter selection below matches exactly what actually got stored.
  const newName = toTitleCase(newNameRaw.trim());
  const result = renameGroup({ rawData: appState.rawData, emptyGroups: appState.emptyGroups }, level, scope, newName);
  const groupLinks = renameInGroupLinks(appState.groupLinks, { level, subject: scope.subject, topic: scope.topic, subTopic: scope.subTopic, newName });
  applyDataChange({ ...result, groupLinks });

  // If the renamed Subject/Topic/SubTopic was itself part of the active filter selection, swap it in
  // place — otherwise the filter keeps pointing at a name no longer present in the data and silently
  // matches nothing until the user manually clears and re-picks it.
  const filterKey = level === "subject" ? "subjects" : level === "topic" ? "topics" : "subTopics";
  if (currentName && appState.filterState[filterKey].includes(currentName)) {
    appState.filterState = { ...appState.filterState, [filterKey]: appState.filterState[filterKey].map((v) => (v === currentName ? newName : v)) };
    refreshAfterExternalFilterStateChange();
  }

  showToast(`Renamed to "${newName}".`, "success");
}
