// @ts-check
/**
 * features/duplicateHints.js — Duplicate Detection Hints: while drafting a new question (in a
 * Bulk Add textarea), fuzzy-matches the in-progress text against existing questions and shows
 * grouped "you may already have this" hints, auto-expanding the group for any exact match.
 * data/fuzzyHints.js does the pure matching; this module only renders it and wires the textarea.
 */
import { findDuplicateHints } from "../data/fuzzyHints.js";
import { appState } from "../state/appState.js";
import { openNode } from "../render/accordion.js";
import { scrollAndFlash } from "../render/highlight.js";
import { findQuestionHeaderEl } from "../render/treeRenderer.js";

/**
 * Extracts the "Question" field (4th CSV column) from the last non-empty pasted/typed line, for
 * live fuzzy-matching as the user drafts a Bulk Add row.
 * @param {string} text
 * @returns {string}
 */
function extractDraftQuestionText(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return "";
  const last = lines[lines.length - 1];
  const cols = last.split(",");
  return (cols[3] || "").trim();
}

/**
 * Wires live duplicate-hint rendering into a textarea + a mount element for the hint panel.
 * @param {HTMLTextAreaElement} textarea
 * @param {HTMLElement} mount
 */
export function attachDuplicateHints(textarea, mount) {
  let timer = null;
  textarea.addEventListener("input", () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => render(), 250);
  });

  function render() {
    const draft = extractDraftQuestionText(textarea.value);
    mount.textContent = "";
    if (!draft) return;
    const groups = findDuplicateHints(appState.rawData, draft);
    if (groups.length === 0) return;

    const wrap = document.createElement("div");
    wrap.className = "duplicate-hints";
    const title = document.createElement("div");
    title.textContent = "You may already have this:";
    title.style.fontWeight = "600";
    wrap.appendChild(title);

    for (const g of groups) {
      const groupTitle = document.createElement("div");
      groupTitle.className = "dup-group-title";
      groupTitle.textContent = `${g.subject} / ${g.topic} / ${g.subTopic} (${g.items.length})${g.autoExpand ? " — exact match" : ""}`;
      const itemsWrap = document.createElement("div");
      itemsWrap.hidden = !g.autoExpand;
      groupTitle.addEventListener("click", () => {
        itemsWrap.hidden = !itemsWrap.hidden;
      });
      for (const it of g.items) {
        const row = document.createElement("div");
        row.className = "dup-item";
        row.textContent = (it.isExactMatch ? "[exact] " : "") + it.question.question;
        row.style.cursor = "pointer";
        row.addEventListener("click", () => {
          openNode(`S::${it.question.subject}`);
          openNode(`${it.question.subject}::T::${it.question.topic}`);
          openNode(`${it.question.subject}::${it.question.topic}::ST::${it.question.subTopic}`);
          openNode(`Q::${it.question.id}`);
          const el = findQuestionHeaderEl(it.question.id);
          if (el) scrollAndFlash(el);
        });
        itemsWrap.appendChild(row);
      }
      wrap.appendChild(groupTitle);
      wrap.appendChild(itemsWrap);
    }
    mount.appendChild(wrap);
  }
}
