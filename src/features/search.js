// @ts-check
/**
 * features/search.js — Jump to Question (Search): wires the search input + results dropdown to
 * data/search.js, scoped to the currently-visible (already-filtered) tree.
 */
import { searchQuestions } from "../data/search.js";
import { appState } from "../state/appState.js";
import { openNode } from "../render/accordion.js";
import { scrollAndFlash } from "../render/highlight.js";
import { findQuestionHeaderEl } from "../render/treeRenderer.js";
import { repaint } from "./refresh.js";

/**
 * @param {HTMLInputElement} input
 * @param {HTMLElement} resultsEl
 */
export function initSearch(input, resultsEl) {
  input.addEventListener("input", () => {
    const groups = searchQuestions(appState.grouped, input.value);
    renderResults(groups, resultsEl);
  });
  document.addEventListener("click", (e) => {
    if (!resultsEl.contains(/** @type {Node} */ (e.target)) && e.target !== input) {
      resultsEl.hidden = true;
    }
  });
  input.addEventListener("focus", () => {
    if (resultsEl.childElementCount > 0) resultsEl.hidden = false;
  });
}

function renderResults(groups, resultsEl) {
  resultsEl.textContent = "";
  if (groups.length === 0) {
    resultsEl.hidden = true;
    return;
  }
  resultsEl.hidden = false;
  for (const g of groups) {
    const groupEl = document.createElement("div");
    groupEl.className = "jump-search-group";
    const title = document.createElement("div");
    title.className = "jump-search-group-title";
    title.textContent = `${g.subject} / ${g.topic} / ${g.subTopic}`;
    groupEl.appendChild(title);
    for (const q of g.questions) {
      const item = document.createElement("div");
      item.className = "jump-search-item";
      item.textContent = q.question;
      item.addEventListener("click", () => {
        jumpToQuestion(q.subject, q.topic, q.subTopic, q.id);
        resultsEl.hidden = true;
      });
      groupEl.appendChild(item);
    }
    resultsEl.appendChild(groupEl);
  }
}

/**
 * @param {string} subject
 * @param {string} topic
 * @param {string} subTopic
 * @param {string} questionId
 */
export function jumpToQuestion(subject, topic, subTopic, questionId) {
  openNode(`S::${subject}`);
  openNode(`${subject}::T::${topic}`);
  openNode(`${subject}::${topic}::ST::${subTopic}`);
  openNode(`Q::${questionId}`);
  repaint();
  const el = findQuestionHeaderEl(questionId);
  if (el) scrollAndFlash(el);
}
