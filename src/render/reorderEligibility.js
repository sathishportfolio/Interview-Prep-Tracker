// @ts-check
/**
 * render/reorderEligibility.js — shared predicate for whether a Subject/Topic/SubTopic/Question node
 * is an eligible click target for the active Reorder-mode session (appState.reorderMode). Used by
 * every render/nodeViews/* file's capture-phase click interceptor and reorder-badge patching — see
 * features/reorderMode.js for the session shape and commit logic.
 */
import { appState } from "../state/appState.js";

/**
 * @param {"subject"|"topic"|"subTopic"|"question"} level
 * @param {{subject?: string, topic?: string, subTopic?: string}} scope
 * @returns {boolean}
 */
export function isReorderTarget(level, scope) {
  const mode = appState.reorderMode;
  if (!mode || mode.childLevel !== level) return false;
  const p = mode.parentScope;
  if (level === "subject") return true;
  if (level === "topic") return p.subject === scope.subject;
  if (level === "subTopic") return p.subject === scope.subject && p.topic === scope.topic;
  return p.subject === scope.subject && p.topic === scope.topic && p.subTopic === scope.subTopic;
}
