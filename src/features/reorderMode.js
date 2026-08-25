// @ts-check
/**
 * features/reorderMode.js — click-to-number Reorder mode. One session at a time, scoped to a single
 * parent's direct children (Subjects at the root, a Subject's own Topics, a Topic's own SubTopics,
 * or a SubTopic's own Questions) — see render/nodeViews/*'s isReorderTarget/onReorderSelect wiring
 * and state/appState.js's `reorderMode` field for the session shape.
 *
 * Committing places every clicked sibling first (in click order), then every un-clicked sibling
 * after them in its original relative order — siblings that only exist as an empty-group placeholder
 * (no real question underneath) aren't reorderable in this pass (see data/order.js's
 * reorderGroupSiblings doc comment) and are left where group.js already puts them.
 */
import { reorderSiblingsByIdList, reorderGroupSiblings } from "../data/order.js";
import { applyDataChange, repaint } from "./refresh.js";
import { appState } from "../state/appState.js";

/**
 * @param {"subject"|"topic"|"subTopic"|"question"} childLevel
 * @param {{subject?: string, topic?: string, subTopic?: string}} parentScope
 */
export function enterReorderMode(childLevel, parentScope) {
  appState.reorderMode = { childLevel, parentScope, selections: [] };
  repaint();
}

export function exitReorderMode() {
  appState.reorderMode = null;
  repaint();
}

/**
 * Toggles one sibling's presence in the active session's click-order list — a second click on an
 * already-picked sibling removes it (remaining numbers shift down since they're just array position).
 * No-ops if there's no active session or this sibling doesn't belong to it.
 * @param {"subject"|"topic"|"subTopic"|"question"} level
 * @param {{subject?: string, topic?: string, subTopic?: string, id?: string}} scope
 */
export function selectForReorder(level, scope) {
  const mode = appState.reorderMode;
  if (!mode || mode.childLevel !== level) return;
  const key = level === "question" ? /** @type {string} */ (scope.id) : /** @type {string} */ (scope[level]);
  const idx = mode.selections.indexOf(key);
  if (idx >= 0) mode.selections = mode.selections.filter((k) => k !== key);
  else mode.selections = [...mode.selections, key];
  repaint();
}

/**
 * @param {string[]} allSiblingKeys Every direct child's identity key, in its CURRENT relative order.
 * @param {string[]} selections Click-order picks.
 * @returns {string[]} selections first, then every unpicked key in its original relative order.
 */
function finalOrder(allSiblingKeys, selections) {
  const picked = new Set(selections);
  const rest = allSiblingKeys.filter((k) => !picked.has(k));
  return [...selections.filter((k) => allSiblingKeys.includes(k)), ...rest];
}

/**
 * Commits the active session: renumbers every REAL (non-empty-placeholder) direct child according to
 * click order + original-order-for-the-rest, then exits the session.
 */
export function commitReorder() {
  const mode = appState.reorderMode;
  if (!mode) return;
  const { childLevel, parentScope, selections } = mode;

  let rawData = appState.rawData;
  if (childLevel === "question") {
    const { subject, topic, subTopic } = /** @type {{subject: string, topic: string, subTopic: string}} */ (parentScope);
    const siblingIds = [
      ...new Set(rawData.filter((q) => q.subject === subject && q.topic === topic && q.subTopic === subTopic).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((q) => q.id)),
    ];
    rawData = reorderSiblingsByIdList(rawData, subject, topic, subTopic, finalOrder(siblingIds, selections));
  } else {
    const nameField = childLevel;
    const siblings = rawData.filter((q) => {
      if (childLevel !== "subject" && q.subject !== parentScope.subject) return false;
      if (childLevel === "subTopic" && q.topic !== parentScope.topic) return false;
      return true;
    });
    const orderField = childLevel === "subject" ? "subjectOrder" : childLevel === "topic" ? "topicOrder" : "subTopicOrder";
    const siblingNames = [...new Set(siblings.sort((a, b) => (a[orderField] ?? 0) - (b[orderField] ?? 0)).map((q) => q[nameField]))];
    rawData = reorderGroupSiblings(rawData, childLevel, parentScope, finalOrder(siblingNames, selections));
  }

  appState.reorderMode = null;
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
}
