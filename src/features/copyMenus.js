// @ts-check
/**
 * features/copyMenus.js — Per-Level Copy Menus: each Subject/Topic/SubTopic header's copy
 * dropdown, five formats, scoped to that node + descendants only (data/copyBuilders.js enforces
 * the no-ancestor-leak invariant). This module just finds the right GroupedTree node and shows a
 * tiny format-picker popover next to the button that triggered it.
 */
import { appState } from "../state/appState.js";
import {
  buildPlainCopyText, buildStructureWithAnswerCopyText, buildStructureOnlyCopyText,
  buildHierarchyCopyText, buildHierarchyOnlyCopyText,
} from "../data/copyBuilders.js";
import { showToast } from "./toast.js";

const FORMATS = [
  ["plain", "Questions (plain)", buildPlainCopyText],
  ["structureWithAnswer", "Structure + Answer", buildStructureWithAnswerCopyText],
  ["hierarchy", "Hierarchy (tab-indented)", buildHierarchyCopyText],
  ["structureOnly", "Structure only", buildStructureOnlyCopyText],
  ["hierarchyOnly", "Hierarchy only", buildHierarchyOnlyCopyText],
];

/**
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 * @returns {any} the SubjectGroup/TopicGroup/SubTopicGroup node
 */
function findNode(level, scope) {
  const s = appState.groupedUnfiltered.subjects.find((x) => x.subject === scope.subject);
  if (!s) return null;
  if (level === "subject") return s;
  const t = s.topics.find((x) => x.topic === scope.topic);
  if (!t) return null;
  if (level === "topic") return t;
  return t.subTopics.find((x) => x.subTopic === scope.subTopic) || null;
}

/**
 * @param {"subject"|"topic"|"subTopic"} level
 * @param {{subject: string, topic?: string, subTopic?: string}} scope
 * @param {HTMLElement} anchorEl
 */
export function openCopyMenu(level, scope, anchorEl) {
  const existing = document.querySelector(".copy-menu-popover");
  if (existing) existing.remove();

  const node = findNode(level, scope);
  if (!node) return;

  const menu = document.createElement("div");
  menu.className = "copy-menu-popover dropdown-menu show";
  menu.style.position = "absolute";
  menu.style.zIndex = "200";
  const rect = anchorEl.getBoundingClientRect();
  menu.style.top = `${window.scrollY + rect.bottom}px`;
  menu.style.left = `${window.scrollX + rect.left}px`;

  for (const [key, label, builder] of FORMATS) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "dropdown-item";
    item.textContent = /** @type {string} */ (label);
    item.addEventListener("click", async () => {
      const text = /** @type {(n:any)=>string} */ (builder)(node);
      try {
        await navigator.clipboard.writeText(text);
        showToast(`Copied (${label}).`, "success");
      } catch {
        showToast("Could not copy.", "error");
      }
      menu.remove();
    });
    menu.appendChild(item);
  }

  document.body.appendChild(menu);
  setTimeout(() => {
    document.addEventListener(
      "click",
      function onDocClick(e) {
        if (!menu.contains(/** @type {Node} */ (e.target))) {
          menu.remove();
          document.removeEventListener("click", onDocClick);
        }
      },
      { once: true }
    );
  }, 0);
}
