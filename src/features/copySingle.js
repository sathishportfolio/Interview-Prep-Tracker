// @ts-check
/**
 * features/copySingle.js — Copy Single Question: copy just its text, plus a "copy and search"
 * variant that also runs it through duplicate-detection search (data/fuzzyHints.js) and shows the
 * results as a modal of clickable, navigable matches (with a toggle to re-run the search without
 * the common-word filter). Also home to the per-question Google search shortcut.
 */
import { appState } from "../state/appState.js";
import { findDuplicateHints } from "../data/fuzzyHints.js";
import { showToast } from "./toast.js";
import { openModal } from "./modal.js";
import { openNode } from "../render/accordion.js";
import { scrollAndFlash } from "../render/highlight.js";
import { findQuestionHeaderEl } from "../render/treeRenderer.js";
import { repaint } from "./refresh.js";

/** @param {string} questionId */
export async function copyQuestionText(questionId) {
  const q = appState.rawData.find((x) => x.id === questionId);
  if (!q) return;
  try {
    await navigator.clipboard.writeText(q.question);
    showToast("Question copied.", "success");
  } catch {
    showToast("Could not copy.", "error");
  }
}

/** @param {string} questionId */
export async function copyAndSearch(questionId) {
  const q = appState.rawData.find((x) => x.id === questionId);
  if (!q) return;
  await copyQuestionText(questionId);
  showDuplicateResultsModal(questionId, q.question);
}

const CODE_EXAMPLE_ASK = "provide a one-liner answer with an example code snippet if applicable";

/**
 * Builds the Google search query for a question. `mode` picks the query style (see
 * questionView.js's Google-search split button); omitted/unrecognized falls back to the default —
 * scoped to the question's Topic, asking for a code example — used by the main button's direct
 * click and every other Google-search shortcut (Ctrl+click/double-tap/long-press on the question
 * text, the answer row's main button). Every scoped mode (subject/topic/subTopic) asks for the
 * code example too — only "plain" (raw question, no scope, no ask) opts out of it.
 * @param {import('../types.js').Question} q
 * @param {"codeExample"|"plain"|"subject"|"topic"|"subTopic"|"whatwhywherehow"} [mode]
 * @returns {string}
 */
function buildGoogleSearchQuery(q, mode) {
  if (mode === "whatwhywherehow") {
    // Trims leading "what is", "what are", or "what" (case-insensitive) along with any extra spaces
    const cleanQuestion = q.question.replace(/^what\s+(is|are)?\s*/i, '');
    return `What are ${cleanQuestion}, why and where are they used, and how are they implemented in Java? Please provide a complete example code snippet.`;
  }
  if (mode === "codeExample") return `${q.question} ${CODE_EXAMPLE_ASK}`;
  if (mode === "plain") return q.question;
  if (mode === "subject") return `In ${q.subject}, ${q.question} ${CODE_EXAMPLE_ASK}`;
  if (mode === "subTopic") return `In ${q.subTopic}, ${q.question} ${CODE_EXAMPLE_ASK}`;
  return `In ${q.topic}, ${q.question} ${CODE_EXAMPLE_ASK}`; // default, and "topic" mode
}

/**
 * Opens a new tab Google-searching a prompt asking how to best answer this question.
 * @param {string} questionId
 * @param {"codeExample"|"plain"|"subject"|"topic"|"subTopic"|"whatwhywherehow"} [mode]
 */
export function googleSearchQuestion(questionId, mode) {
  const q = appState.rawData.find((x) => x.id === questionId);
  if (!q) return;
  const query = buildGoogleSearchQuery(q, mode);
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Shows "Copy and search for duplicates" results as a modal of clickable, navigable question
 * links (rather than just a toast count) so the user can jump straight to a possible duplicate.
 * Includes an "Ignore common words" toggle (on by default) so a false-negative/false-positive
 * search can be re-run against the raw, unfiltered word overlap without leaving the modal.
 * @param {string} questionId
 * @param {string} questionText
 */
function showDuplicateResultsModal(questionId, questionText) {
  const wrap = document.createElement("div");

  const toggleRow = document.createElement("label");
  toggleRow.className = "form-check dup-ignore-toggle";
  const toggleInput = document.createElement("input");
  toggleInput.type = "checkbox";
  toggleInput.className = "form-check-input";
  toggleInput.checked = true;
  const toggleLabel = document.createElement("span");
  toggleLabel.className = "form-check-label";
  toggleLabel.textContent = "Ignore common words (is, are, what, how, …)";
  toggleRow.appendChild(toggleInput);
  toggleRow.appendChild(toggleLabel);

  const resultsEl = document.createElement("div");

  function renderResults() {
    const hints = findDuplicateHints(
      appState.rawData.filter((x) => x.id !== questionId),
      questionText,
      { ignoreCommonWords: toggleInput.checked }
    );
    resultsEl.textContent = "";
    const total = hints.reduce((n, g) => n + g.items.length, 0);
    if (total === 0) {
      const empty = document.createElement("div");
      empty.className = "text-muted";
      empty.textContent = "No similar questions found.";
      resultsEl.appendChild(empty);
      return;
    }
    const list = document.createElement("div");
    list.className = "duplicate-hints";
    for (const g of hints) {
      const groupTitle = document.createElement("div");
      groupTitle.className = "dup-group-title";
      groupTitle.textContent = `${g.subject} / ${g.topic} / ${g.subTopic} (${g.items.length})`;
      list.appendChild(groupTitle);
      for (const it of g.items) {
        const row = document.createElement("a");
        row.href = "#";
        row.className = "dup-item dup-item-link";
        row.textContent = (it.isExactMatch ? "[exact] " : "") + it.question.question;
        row.addEventListener("click", (e) => {
          e.preventDefault();
          navigateToQuestion(it.question.id);
        });
        list.appendChild(row);
      }
    }
    resultsEl.appendChild(list);
  }

  toggleInput.addEventListener("change", renderResults);
  renderResults();

  wrap.appendChild(toggleRow);
  wrap.appendChild(resultsEl);
  openModal({ title: "Possibly-similar questions", bodyEl: wrap });
}

/** @param {string} questionId */
function navigateToQuestion(questionId) {
  const q = appState.rawData.find((x) => x.id === questionId);
  if (!q) return;
  openNode(`S::${q.subject}`);
  openNode(`${q.subject}::T::${q.topic}`);
  openNode(`${q.subject}::${q.topic}::ST::${q.subTopic}`);
  openNode(`Q::${q.id}`);
  repaint();
  const el = findQuestionHeaderEl(q.id);
  if (el) scrollAndFlash(el);
}
