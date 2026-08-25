// @ts-check
/**
 * features/duplicateFinder.js — Duplicate Finder: extends "Copy and search for duplicates"
 * (copySingle.js, which checks one question against the full dataset) to a batch scan of the
 * entire currently-filtered view, clustering mutually-similar questions (data/fuzzyHints.js's
 * findDuplicateClusters) and showing them in one review-and-delete modal. Each question has a
 * checkbox; a footer bar (below the scrollable results list, so it survives scrolling through a
 * long list) bulk-deletes every checked question in one pass. Deleting anything with an answer —
 * via the footer bulk action or a single item's own delete button — asks for extra confirmation
 * first, since that answer would be lost. Each row also has a "view answer" toggle and an "append
 * answer to..." action that copies this question's answer onto another question in the same
 * cluster (the one the user is keeping) before deleting the rest, via the same updateQuestion
 * mutation answerEditor.js uses.
 */
import { appState } from "../state/appState.js";
import { findDuplicateClusters } from "../data/fuzzyHints.js";
import { flattenGroupedTree } from "../data/copyBuilders.js";
import { deleteQuestion, deleteQuestions, updateQuestion } from "../data/mutations.js";
import { applyDataChange, repaint } from "./refresh.js";
import { openModal } from "./modal.js";
import { confirmAction, showToast } from "./toast.js";
import { openNode } from "../render/accordion.js";
import { scrollAndFlash } from "../render/highlight.js";
import { findQuestionHeaderEl } from "../render/treeRenderer.js";

/** Opens the Duplicate Finder modal, scanning appState.grouped (the current filtered view). */
export function openDuplicateFinder() {
  const wrap = document.createElement("div");
  wrap.className = "dup-finder";

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

  const summaryEl = document.createElement("div");
  summaryEl.className = "text-muted dup-finder-summary";
  const resultsEl = document.createElement("div");
  resultsEl.className = "dup-finder-results";

  /** @type {Set<string>} question ids currently checked, survives re-render (toggle change, single delete) */
  const selected = new Set();
  /** @type {Set<string>} question ids whose answer preview is currently expanded */
  const expanded = new Set();
  /** @type {string|null} question id whose "append answer to..." picker is open (only one at a time) */
  let appendPickerFor = null;
  /**
   * Cluster keys (sorted question ids joined) skipped for THIS modal session only — not persisted
   * anywhere, so a cluster dismissed here just disappears from view; closing and reopening the
   * Duplicate Finder re-scans from scratch and it comes right back if still a duplicate.
   * @type {Set<string>}
   */
  const skippedClusters = new Set();

  const footer = document.createElement("div");
  footer.className = "dup-finder-footer edit-gated";
  const selectedCountEl = document.createElement("span");
  selectedCountEl.className = "dup-finder-selected-count";
  const deleteSelectedBtn = document.createElement("button");
  deleteSelectedBtn.type = "button";
  deleteSelectedBtn.className = "btn btn-sm btn-danger";
  deleteSelectedBtn.textContent = "Delete Selected";
  deleteSelectedBtn.addEventListener("click", () => deleteSelected());
  footer.appendChild(selectedCountEl);
  footer.appendChild(deleteSelectedBtn);

  function updateFooter() {
    selectedCountEl.textContent = `${selected.size} selected`;
    deleteSelectedBtn.disabled = selected.size === 0;
  }

  function render() {
    const questions = flattenGroupedTree(appState.grouped);
    // Drop selections/expanded state for questions no longer present (deleted, or filtered out elsewhere).
    const stillPresent = new Set(questions.map((q) => q.id));
    for (const id of selected) if (!stillPresent.has(id)) selected.delete(id);
    for (const id of expanded) if (!stillPresent.has(id)) expanded.delete(id);
    if (appendPickerFor && !stillPresent.has(appendPickerFor)) appendPickerFor = null;

    const allClusters = findDuplicateClusters(questions, { ignoreCommonWords: toggleInput.checked });
    const clusters = allClusters.filter((c) => !skippedClusters.has(clusterKey(c)));
    const dupeCount = clusters.reduce((n, c) => n + c.questions.length, 0);
    const skippedNote = skippedClusters.size > 0 ? ` (${skippedClusters.size} skipped this session)` : "";
    summaryEl.textContent = `${questions.length} question(s) in the current filtered view — ${clusters.length} duplicate cluster(s), ${dupeCount} question(s) involved.${skippedNote}`;

    resultsEl.textContent = "";
    updateFooter();
    if (clusters.length === 0) return;

    const list = document.createElement("div");
    list.className = "duplicate-hints";
    for (const cluster of clusters) {
      const clusterEl = document.createElement("div");
      clusterEl.className = "dup-cluster";

      const clusterTitle = document.createElement("div");
      clusterTitle.className = "dup-group-title dup-cluster-title-row";
      const titleText = document.createElement("span");
      titleText.textContent = `${cluster.hasExactMatch ? "[exact] " : ""}${cluster.questions.length} similar questions`;
      clusterTitle.appendChild(titleText);

      const skipBtn = document.createElement("button");
      skipBtn.type = "button";
      skipBtn.className = "btn btn-sm btn-outline-secondary dup-skip-btn";
      skipBtn.title = "Skip this cluster for now (comes back next time you open Duplicate Finder)";
      skipBtn.innerHTML = '<i class="fa-solid fa-forward"></i> Skip';
      skipBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        skippedClusters.add(clusterKey(cluster));
        render();
      });
      clusterTitle.appendChild(skipBtn);

      clusterEl.appendChild(clusterTitle);

      for (const q of cluster.questions) {
        const itemWrap = document.createElement("div");
        itemWrap.className = "dup-item-wrap";

        const row = document.createElement("div");
        row.className = "dup-item dup-item-row";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "form-check-input edit-gated dup-item-checkbox";
        checkbox.checked = selected.has(q.id);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) selected.add(q.id);
          else selected.delete(q.id);
          updateFooter();
        });
        row.appendChild(checkbox);

        const link = document.createElement("a");
        link.href = "#";
        link.className = "dup-item-link";
        link.textContent = `${q.question}  (${q.subject} / ${q.topic} / ${q.subTopic})`;
        link.addEventListener("click", (e) => {
          e.preventDefault();
          navigateToQuestion(q.id);
        });
        row.appendChild(link);

        if (q.answer) {
          const badge = document.createElement("span");
          badge.className = "badge bg-info dup-has-answer-badge";
          badge.textContent = "Has answer";
          row.appendChild(badge);
        }

        const viewBtn = document.createElement("button");
        viewBtn.type = "button";
        viewBtn.className = "btn btn-sm btn-outline-secondary";
        viewBtn.title = expanded.has(q.id) ? "Hide answer" : "View answer";
        viewBtn.innerHTML = `<i class="fa-solid ${expanded.has(q.id) ? "fa-eye-slash" : "fa-eye"}"></i>`;
        viewBtn.addEventListener("click", () => {
          if (expanded.has(q.id)) expanded.delete(q.id);
          else expanded.add(q.id);
          render();
        });
        row.appendChild(viewBtn);

        const otherInCluster = cluster.questions.filter((x) => x.id !== q.id);
        const appendBtn = document.createElement("button");
        appendBtn.type = "button";
        appendBtn.className = "btn btn-sm btn-outline-secondary";
        appendBtn.title = "Append this answer onto another question in this cluster";
        appendBtn.innerHTML = '<i class="fa-solid fa-code-merge"></i>';
        appendBtn.disabled = !q.answer || otherInCluster.length === 0;
        appendBtn.addEventListener("click", () => {
          appendPickerFor = appendPickerFor === q.id ? null : q.id;
          render();
        });
        row.appendChild(appendBtn);

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn btn-sm btn-outline-danger edit-gated";
        deleteBtn.title = "Delete this question";
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        deleteBtn.addEventListener("click", () => {
          if (!confirmDelete([q])) return;
          selected.delete(q.id);
          const result = deleteQuestion({ rawData: appState.rawData, emptyGroups: appState.emptyGroups, tombstones: appState.tombstones }, q.id);
          applyDataChange(result);
          showToast("Deleted.", "success");
          render();
        });
        row.appendChild(deleteBtn);

        itemWrap.appendChild(row);

        if (expanded.has(q.id)) {
          const answerPanel = document.createElement("div");
          answerPanel.className = "dup-answer-panel";
          answerPanel.innerHTML = q.answer || "<em>No answer yet.</em>";
          itemWrap.appendChild(answerPanel);
        }

        if (appendPickerFor === q.id) {
          itemWrap.appendChild(buildAppendPicker(q, otherInCluster, render));
        }

        clusterEl.appendChild(itemWrap);
      }
      list.appendChild(clusterEl);
    }
    resultsEl.appendChild(list);
  }

  function deleteSelected() {
    if (selected.size === 0) return;
    const ids = [...selected];
    const targets = appState.rawData.filter((q) => selected.has(q.id));
    if (!confirmDelete(targets)) return;
    const result = deleteQuestions({ rawData: appState.rawData, emptyGroups: appState.emptyGroups, tombstones: appState.tombstones }, ids);
    applyDataChange(result);
    selected.clear();
    showToast(`Deleted ${ids.length} question(s).`, "success");
    render();
  }

  toggleInput.addEventListener("change", render);
  render();

  wrap.appendChild(toggleRow);
  wrap.appendChild(summaryEl);
  wrap.appendChild(resultsEl);
  wrap.appendChild(footer);
  openModal({ title: "Duplicate Finder (Filtered View)", bodyEl: wrap });
}

/**
 * Stable identity for a cluster (order-independent) used to track skipped clusters for the
 * session — a fresh scan can reorder/re-split clusters, but the same set of question ids skipped
 * should stay skipped until the modal is reopened.
 * @param {{questions: import('../types.js').Question[]}} cluster
 * @returns {string}
 */
function clusterKey(cluster) {
  return cluster.questions
    .map((q) => q.id)
    .sort()
    .join(",");
}

/**
 * Inline picker: pick a target question (from the same cluster) to append this question's answer
 * onto — the user's "keep this one, fold the others into it" workflow.
 * @param {import('../types.js').Question} source
 * @param {import('../types.js').Question[]} candidates
 * @param {() => void} rerender
 * @returns {HTMLElement}
 */
function buildAppendPicker(source, candidates, rerender) {
  const panel = document.createElement("div");
  panel.className = "dup-append-panel";

  const label = document.createElement("span");
  label.className = "dup-append-label";
  label.textContent = "Append this answer onto:";
  panel.appendChild(label);

  const select = document.createElement("select");
  select.className = "form-select form-select-sm dup-append-select";
  for (const c of candidates) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.question.length > 70 ? `${c.question.slice(0, 70)}…` : c.question;
    select.appendChild(opt);
  }
  panel.appendChild(select);

  const appendBtn = document.createElement("button");
  appendBtn.type = "button";
  appendBtn.className = "btn btn-sm btn-primary";
  appendBtn.textContent = "Append";
  appendBtn.addEventListener("click", () => {
    const targetId = select.value;
    const target = appState.rawData.find((x) => x.id === targetId);
    if (!target) return;
    const combined = target.answer ? `${target.answer}<hr>${source.answer}` : source.answer;
    const rawData = updateQuestion(appState.rawData, targetId, { answer: combined });
    applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
    showToast("Answer appended.", "success");
    rerender();
  });
  panel.appendChild(appendBtn);

  return panel;
}

/**
 * @param {import('../types.js').Question[]} questions One or more questions about to be deleted together.
 * @returns {boolean}
 */
function confirmDelete(questions) {
  const withAnswers = questions.filter((q) => q.answer).length;
  if (withAnswers > 0) {
    const noun = questions.length === 1 ? "this question" : `these ${questions.length} questions`;
    const answerNote =
      questions.length === 1
        ? "It already has an answer — it will be lost."
        : `${withAnswers} of them already ${withAnswers === 1 ? "has" : "have"} an answer — it will be lost.`;
    return confirmAction(`Delete ${noun}? ${answerNote}`);
  }
  const label = questions.length === 1 ? `this question?\n\n"${questions[0].question}"` : `these ${questions.length} questions?`;
  return confirmAction(`Delete ${label}`);
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
