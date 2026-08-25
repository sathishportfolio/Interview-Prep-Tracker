// @ts-check
/**
 * features/autoExpand.js — "Auto-Expand Children" toggle (independent of Edit Mode/Drag & Drop,
 * default ON, persisted like the other global toggles). When on, opening a Subject also opens its
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
 * toggle is on AND this click just OPENED the node (collapsing never cascades). Returns the deepest
 * newly-opened key so the caller can scroll it into view — deliberately does NOT scroll here itself:
 * the caller (treeHandlers.js) must repaint first, since scrolling before the DOM reflects the final
 * open/collapsed layout targets a stale position that then visibly jumps once repaint() catches up.
 * @param {"subject"|"topic"} level
 * @param {{subject: string, topic?: string}} scope
 * @returns {string|null}
 */
export function autoExpandFirstChild(level, scope) {
  if (!appState.toggles.autoExpandChildrenOn) return null;
  const subjectNode = appState.grouped.subjects.find((s) => s.subject === scope.subject);
  if (!subjectNode) return null;

  let deepestKey = null;
  if (level === "subject") {
    if (!appState.openNodeKeys.has(`S::${scope.subject}`)) return null; // just collapsed, not opened
    const firstTopic = subjectNode.topics[0];
    if (!firstTopic) return null;
    deepestKey = `${scope.subject}::T::${firstTopic.topic}`;
    openNode(deepestKey);
    const firstSubTopic = firstTopic.subTopics[0];
    if (firstSubTopic) {
      deepestKey = `${scope.subject}::${firstTopic.topic}::ST::${firstSubTopic.subTopic}`;
      openNode(deepestKey);
    }
  } else {
    if (!appState.openNodeKeys.has(`${scope.subject}::T::${scope.topic}`)) return null; // just collapsed
    const topicNode = subjectNode.topics.find((t) => t.topic === scope.topic);
    const firstSubTopic = topicNode?.subTopics[0];
    if (firstSubTopic) {
      deepestKey = `${scope.subject}::${scope.topic}::ST::${firstSubTopic.subTopic}`;
      openNode(deepestKey);
    }
  }
  return deepestKey;
}
