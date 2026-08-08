// @ts-check
/**
 * features/autoExpand.js — "Auto-Expand Children" toggle (independent of Edit Mode/Drag & Drop,
 * default OFF, persisted like the other global toggles). When on, opening a Subject also opens its
 * first Topic and that Topic's first SubTopic in the same click; opening a Topic also opens its
 * first SubTopic. Never cascades into Questions — SubTopic clicks are left alone. "First" means
 * first in the currently-grouped/sorted order (appState.grouped), matching what's actually on
 * screen, not raw insertion order.
 */
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { openNode } from "../render/accordion.js";
import { repaint } from "./refresh.js";

export function toggleAutoExpandChildren() {
  appState.toggles = { ...appState.toggles, autoExpandChildrenOn: !appState.toggles.autoExpandChildrenOn };
  store.writeGlobalToggles(appState.toggles);
  repaint();
}

/**
 * Called after a Subject/Topic header's own open/close toggle already ran — no-ops unless the
 * toggle is on AND this click just OPENED the node (collapsing never cascades).
 * @param {"subject"|"topic"} level
 * @param {{subject: string, topic?: string}} scope
 */
export function autoExpandFirstChild(level, scope) {
  if (!appState.toggles.autoExpandChildrenOn) return;
  const subjectNode = appState.grouped.subjects.find((s) => s.subject === scope.subject);
  if (!subjectNode) return;

  if (level === "subject") {
    if (!appState.openNodeKeys.has(`S::${scope.subject}`)) return; // just collapsed, not opened
    const firstTopic = subjectNode.topics[0];
    if (!firstTopic) return;
    openNode(`${scope.subject}::T::${firstTopic.topic}`);
    const firstSubTopic = firstTopic.subTopics[0];
    if (firstSubTopic) openNode(`${scope.subject}::${firstTopic.topic}::ST::${firstSubTopic.subTopic}`);
  } else {
    if (!appState.openNodeKeys.has(`${scope.subject}::T::${scope.topic}`)) return; // just collapsed
    const topicNode = subjectNode.topics.find((t) => t.topic === scope.topic);
    const firstSubTopic = topicNode?.subTopics[0];
    if (firstSubTopic) openNode(`${scope.subject}::${scope.topic}::ST::${firstSubTopic.subTopic}`);
  }
  repaint();
}
