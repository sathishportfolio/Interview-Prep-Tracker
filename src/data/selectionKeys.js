// @ts-check
/**
 * data/selectionKeys.js — the composite string key format shared by `appState.selectedGroupKeys`
 * and `appState.childSelectModeKeys` ("level::subject::topic::subTopic"). Pure/no DOM so both
 * render/* (checking whether a specific node's checkboxes/child-select class should show) and
 * features/bulkSelection.js (building/parsing the sets themselves) can use the exact same format
 * without render/* importing features/* — see CLAUDE.md's one-way layering.
 */

/** @typedef {"subject"|"topic"|"subTopic"} GroupLevel */
/** @typedef {{subject: string, topic?: string, subTopic?: string}} GroupScope */

/** @param {GroupLevel} level @param {GroupScope} scope @returns {string} */
export function groupKey(level, scope) {
  return `${level}::${scope.subject}::${scope.topic || ""}::${scope.subTopic || ""}`;
}

/** @param {string} key @returns {{level: GroupLevel, scope: GroupScope}} */
export function parseGroupKey(key) {
  const [level, subject, topic, subTopic] = key.split("::");
  return { level: /** @type {GroupLevel} */ (level), scope: { subject, topic: topic || undefined, subTopic: subTopic || undefined } };
}
