// @ts-check
/**
 * features/moveForm.js — "Change Subject/Topic/SubTopic" move form. Opens for a single question
 * (move icon) or a bulk selection ("Move Selected"), lets the user pick any destination Subject/
 * Topic/SubTopic — including brand-new ones via "+ Add New" — with cascading prompts when a
 * newly-picked Subject/Topic has no children yet (naturally handled here: a brand-new Subject's
 * Topic dropdown has no existing options, so it falls straight to the "+ Add New" prompt).
 * Calls the SAME data/mutations.js.moveQuestions that dragDrop.js uses.
 */
import { moveQuestions } from "../data/mutations.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { openModal } from "./modal.js";
import { promptAction, showToast } from "./toast.js";

const ADD_NEW = "__ADD_NEW__";

/**
 * @param {string[]} questionIds
 */
export function openMoveForm(questionIds) {
  if (questionIds.length === 0) return;

  const wrap = document.createElement("div");
  wrap.className = "move-form";

  const subjects = [...new Set(appState.rawData.map((q) => q.subject))].sort();

  const subjectSelect = mkSelect(subjects);
  const topicSelect = mkSelect([]);
  const subTopicSelect = mkSelect([]);

  const row1 = mkRow("Subject", subjectSelect);
  const row2 = mkRow("Topic", topicSelect);
  const row3 = mkRow("SubTopic", subTopicSelect);
  wrap.appendChild(row1);
  wrap.appendChild(row2);
  wrap.appendChild(row3);

  let chosenSubject = "";
  let chosenTopic = "";
  let chosenSubTopic = "";

  function refreshTopics() {
    const topics = [...new Set(appState.rawData.filter((q) => q.subject === chosenSubject).map((q) => q.topic))].sort();
    setOptions(topicSelect, topics);
  }
  function refreshSubTopics() {
    const subTopics = [
      ...new Set(appState.rawData.filter((q) => q.subject === chosenSubject && q.topic === chosenTopic).map((q) => q.subTopic)),
    ].sort();
    setOptions(subTopicSelect, subTopics);
  }

  subjectSelect.addEventListener("change", () => {
    const val = resolveValue(subjectSelect, "Subject");
    if (val == null) return;
    chosenSubject = val;
    refreshTopics();
    chosenTopic = "";
    setOptions(subTopicSelect, []);
  });
  topicSelect.addEventListener("change", () => {
    const val = resolveValue(topicSelect, "Topic");
    if (val == null) return;
    chosenTopic = val;
    refreshSubTopics();
    chosenSubTopic = "";
  });
  subTopicSelect.addEventListener("change", () => {
    const val = resolveValue(subTopicSelect, "SubTopic");
    if (val == null) return;
    chosenSubTopic = val;
  });

  const modal = openModal({
    title: `Move ${questionIds.length} question(s)`,
    bodyEl: wrap,
    saveLabel: "Move",
    onSave: () => {
      if (!chosenSubject || !chosenTopic || !chosenSubTopic) {
        showToast("Pick a destination Subject, Topic, and SubTopic.", "error");
        return;
      }
      const result = moveQuestions(
        { rawData: appState.rawData, emptyGroups: appState.emptyGroups },
        questionIds,
        { subject: chosenSubject, topic: chosenTopic, subTopic: chosenSubTopic }
      );
      applyDataChange(result);
      showToast(`Moved ${questionIds.length} question(s).`, "success");
    },
  });
}

/**
 * @param {HTMLSelectElement} select
 * @param {string} levelLabel
 * @returns {string|null}
 */
function resolveValue(select, levelLabel) {
  if (select.value === ADD_NEW) {
    const name = promptAction(`New ${levelLabel} name:`);
    if (!name || !name.trim()) {
      select.value = "";
      return null;
    }
    const opt = document.createElement("option");
    opt.value = name.trim();
    opt.textContent = name.trim();
    select.insertBefore(opt, select.lastElementChild);
    select.value = name.trim();
    return name.trim();
  }
  return select.value || null;
}

/** @param {string[]} options */
function mkSelect(options) {
  const select = document.createElement("select");
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
  const addNew = document.createElement("option");
  addNew.value = ADD_NEW;
  addNew.textContent = "+ Add New...";
  select.appendChild(addNew);
}

/**
 * @param {string} label
 * @param {HTMLElement} control
 */
function mkRow(label, control) {
  const row = document.createElement("div");
  row.className = "move-form-row";
  const lbl = document.createElement("label");
  lbl.textContent = label;
  lbl.style.minWidth = "80px";
  row.appendChild(lbl);
  row.appendChild(control);
  return row;
}
