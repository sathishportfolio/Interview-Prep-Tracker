// @ts-check
/**
 * features/moveForm.js — "Move Selected" destination picker: a 3-column Subject/Topic/SubTopic
 * form (side by side, not stacked) that moves a MIXED selection — whole Subjects/Topics/SubTopics
 * (via data/mutations.js.moveGroup, cascading their own children) and/or individual Questions (via
 * moveQuestions) — to one chosen destination in a single action, via bulkSelection.js's
 * applySelectionMove. Cascading dropdowns: choosing a Subject narrows the Topic list to that
 * Subject's Topics, choosing a Topic narrows SubTopic likewise. A "+ New ..." button under each
 * column creates a brand-new name inline (prompt()-based) without leaving the modal. Pre-fills
 * Subject/Topic/SubTopic with the selection's own current hierarchy when every selected item
 * already shares the same one, to save clicks on the common case (e.g. moving several questions
 * that are all already in the same Subject).
 */
import { applySelectionMove, formatSelectionSummary } from "./bulkSelection.js";
import { appState } from "../state/appState.js";
import { openModal } from "./modal.js";
import { promptAction, showToast } from "./toast.js";

/**
 * @typedef {import("../data/selectionKeys.js").GroupLevel} GroupLevel
 * @typedef {import("../data/selectionKeys.js").GroupScope} GroupScope
 * @typedef {{groups: {level: GroupLevel, scope: GroupScope}[], questionIds: string[]}} Selection
 */

/**
 * @param {string[] | Selection} selectionOrQuestionIds Either a plain question-id array (legacy
 *   single-question / per-SubTopic "Move Selected" callers) or a full mixed selection.
 */
export function openMoveForm(selectionOrQuestionIds) {
  const selection = Array.isArray(selectionOrQuestionIds)
    ? { groups: [], questionIds: selectionOrQuestionIds }
    : selectionOrQuestionIds;
  const { groups, questionIds } = selection;
  if (groups.length === 0 && questionIds.length === 0) return;

  const needsSubTopic = questionIds.length > 0;
  const needsTopic = needsSubTopic || groups.some((g) => g.level === "subTopic");

  const wrap = document.createElement("div");
  wrap.className = "move-form move-form-3col";

  const subjects = [...new Set(appState.rawData.map((q) => q.subject))].sort();
  const subjectSelect = mkSelect(subjects);
  const topicSelect = mkSelect([]);
  const subTopicSelect = mkSelect([]);

  let chosenSubject = "";
  let chosenTopic = "";
  let chosenSubTopic = "";

  function refreshTopics() {
    const topics = [...new Set(appState.rawData.filter((q) => q.subject === chosenSubject).map((q) => q.topic))].sort();
    setOptions(topicSelect, topics);
    chosenTopic = "";
    setOptions(subTopicSelect, []);
    chosenSubTopic = "";
  }
  function refreshSubTopics() {
    const subTopics = [
      ...new Set(appState.rawData.filter((q) => q.subject === chosenSubject && q.topic === chosenTopic).map((q) => q.subTopic)),
    ].sort();
    setOptions(subTopicSelect, subTopics);
    chosenSubTopic = "";
  }

  subjectSelect.addEventListener("change", () => {
    chosenSubject = subjectSelect.value;
    refreshTopics();
  });
  topicSelect.addEventListener("change", () => {
    chosenTopic = topicSelect.value;
    refreshSubTopics();
  });
  subTopicSelect.addEventListener("change", () => {
    chosenSubTopic = subTopicSelect.value;
  });

  const col1 = mkCol("Subject", subjectSelect, () =>
    createNew(subjectSelect, "Subject", (name) => {
      chosenSubject = name;
      refreshTopics();
    })
  );
  const col2 = mkCol("Topic", topicSelect, () =>
    createNew(topicSelect, "Topic", (name) => {
      chosenTopic = name;
      refreshSubTopics();
    })
  );
  const col3 = mkCol("SubTopic", subTopicSelect, () =>
    createNew(subTopicSelect, "SubTopic", (name) => {
      chosenSubTopic = name;
    })
  );
  wrap.append(col1, col2, col3);

  // Pre-fill from the selection's own current hierarchy when unambiguous (nothing to do if the
  // selection spans multiple different Subjects/Topics — no single hierarchy to prefill with).
  const prefill = computePrefill(selection);
  if (prefill.subject) {
    chosenSubject = prefill.subject;
    subjectSelect.value = prefill.subject;
    refreshTopics();
    if (prefill.topic) {
      chosenTopic = prefill.topic;
      topicSelect.value = prefill.topic;
      refreshSubTopics();
      if (prefill.subTopic) {
        chosenSubTopic = prefill.subTopic;
        subTopicSelect.value = prefill.subTopic;
      }
    }
  }

  const summary = formatSelectionSummary(groups, questionIds);
  openModal({
    title: `Move ${summary}`,
    bodyEl: wrap,
    saveLabel: "Move",
    onSave: () => {
      if (!chosenSubject) {
        showToast("Pick a destination Subject.", "error");
        return;
      }
      if (needsTopic && !chosenTopic) {
        showToast("Pick a destination Topic.", "error");
        return;
      }
      if (needsSubTopic && !chosenSubTopic) {
        showToast("Pick a destination SubTopic.", "error");
        return;
      }
      applySelectionMove(selection, { subject: chosenSubject, topic: chosenTopic, subTopic: chosenSubTopic });
      showToast(`Moved ${summary}.`, "success");
    },
  });
}

/**
 * When every selected item shares the same current Subject (and, if applicable, Topic/SubTopic),
 * returns that shared hierarchy to prefill the destination pickers with.
 * @param {Selection} selection
 * @returns {{subject?: string, topic?: string, subTopic?: string}}
 */
function computePrefill(selection) {
  /** @type {GroupScope[]} */
  const sources = selection.groups.map((g) => g.scope);
  for (const id of selection.questionIds) {
    const q = appState.rawData.find((r) => r.id === id);
    if (q) sources.push({ subject: q.subject, topic: q.topic, subTopic: q.subTopic });
  }
  if (sources.length === 0) return {};

  const subject = allSame(sources.map((s) => s.subject)) ? sources[0].subject : undefined;
  if (!subject) return {};

  const withTopic = sources.filter((s) => s.topic !== undefined);
  const topic = withTopic.length > 0 && allSame(withTopic.map((s) => s.topic)) ? withTopic[0].topic : undefined;
  if (!topic) return { subject };

  const withSubTopic = sources.filter((s) => s.subTopic !== undefined);
  const subTopic = withSubTopic.length > 0 && allSame(withSubTopic.map((s) => s.subTopic)) ? withSubTopic[0].subTopic : undefined;
  return subTopic ? { subject, topic, subTopic } : { subject, topic };
}

/** @param {(string|undefined)[]} values */
function allSame(values) {
  return values.length > 0 && values.every((v) => v === values[0]);
}

/**
 * @param {HTMLSelectElement} select
 * @param {string} label
 * @param {(name: string) => void} onCreated
 */
function createNew(select, label, onCreated) {
  const name = promptAction(`New ${label} name:`);
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  const opt = document.createElement("option");
  opt.value = trimmed;
  opt.textContent = trimmed;
  select.appendChild(opt);
  select.value = trimmed;
  onCreated(trimmed);
}

/** @param {string[]} options */
function mkSelect(options) {
  const select = document.createElement("select");
  // A plain (non-multiple) select with `size` renders as an always-open listbox instead of a
  // closed dropdown — every option is visible up-front without a click, while staying single-select.
  select.className = "form-select form-select-sm";
  setOptions(select, options);
  return select;
}

/**
 * @param {HTMLSelectElement} select
 * @param {string[]} options
 */
function setOptions(select, options) {
  select.textContent = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "-- select --";
  select.appendChild(blank);
  for (const o of options) {
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    select.appendChild(opt);
  }
  // +1 for the blank option; floor at 4 rows so short lists don't look cramped, cap at 10 so a huge
  // list scrolls within its own box rather than blowing out the modal.
  select.size = Math.min(Math.max(options.length + 1, 4), 10);
}

/**
 * @param {string} label
 * @param {HTMLSelectElement} select
 * @param {() => void} onAddNew
 */
function mkCol(label, select, onAddNew) {
  const col = document.createElement("div");
  col.className = "move-form-col";
  const lbl = document.createElement("label");
  lbl.textContent = label;
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-sm btn-outline-secondary move-form-add-btn";
  addBtn.textContent = `+ New ${label}`;
  addBtn.addEventListener("click", onAddNew);
  col.append(lbl, select, addBtn);
  return col;
}
