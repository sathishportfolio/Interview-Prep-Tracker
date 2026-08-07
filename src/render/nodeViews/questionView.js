// @ts-check
/**
 * render/nodeViews/questionView.js — create/patch for a single Question row. Rendering only: all
 * click handlers call into a `handlers` object supplied by the caller (ultimately features/*),
 * never DOM logic owned by features. This file never imports anything from features/*.
 * @typedef {import('../../types.js').Question} Question
 */
import { appState, toggleNodeOpen } from "../../state/appState.js";
import { applyOpenState } from "../accordion.js";

/**
 * @param {HTMLElement} header
 * @param {HTMLElement} body
 * @param {string} key
 */
function toggleOpenAndApply(header, body, key) {
  toggleNodeOpen(key);
  applyOpenState(header, body, key);
}

/**
 * @typedef {Object} TreeHandlers
 * @property {(qid: string, flag: "done"|"reviewLater"|"duplicate"|"lessImportant"|"starred") => void} onToggleStatus
 * @property {(qid: string) => void} onEditAnswer
 * @property {(qid: string) => void} onOpenMoveForm
 * @property {(qid: string) => void} onDeleteQuestion
 * @property {(qid: string) => void} onCopyQuestion
 * @property {(qid: string) => void} onCopyAndSearch
 * @property {(qid: string) => void} onGoogleSearch
 * @property {(qid: string, dir: "up"|"down"|"top"|"bottom") => void} onMoveQuestionOrder
 * @property {(qid: string) => void} onToggleActiveQuestion
 * @property {(qid: string) => void} onToggleSelectQuestion
 * @property {(subject: string, topic: string, subTopic: string, level: "subject"|"topic"|"subTopic", name: string) => void} onCopyMenu
 * @property {(level: "subject"|"topic"|"subTopic", scope: any) => void} onRenameGroup
 * @property {(level: "subject"|"topic"|"subTopic", scope: any) => void} onDeleteGroup
 */

const STATUS_ICONS = [
  { flag: "done", icon: "fa-check", title: "Done" },
  { flag: "reviewLater", icon: "fa-clock", title: "Review Later" },
  { flag: "duplicate", icon: "fa-clone", title: "Duplicate" },
  { flag: "lessImportant", icon: "fa-arrow-down", title: "Less Important" },
  { flag: "starred", icon: "fa-star", title: "Starred" },
];

/**
 * @param {Question} q
 * @param {Record<string, any>} handlers
 * @returns {HTMLElement}
 */
export function createQuestionNode(q, handlers) {
  const item = document.createElement("div");
  item.className = "question-item";
  item.dataset.key = `Q::${q.id}`;
  item.dataset.qid = q.id;

  const header = document.createElement("div");
  header.className = "question-header";

  const dragHandle = document.createElement("i");
  dragHandle.className = "fa-solid fa-grip-vertical drag-handle";

  const selectBox = document.createElement("input");
  selectBox.type = "checkbox";
  selectBox.className = "question-select-checkbox";
  selectBox.addEventListener("click", (e) => e.stopPropagation());
  selectBox.addEventListener("change", (e) => {
    e.stopPropagation();
    handlers.onToggleSelectQuestion(q.id);
  });

  const qText = document.createElement("span");
  qText.className = "q-text";
  const noAnswerIcon = document.createElement("i");
  noAnswerIcon.className = "fa-regular fa-file no-answer-icon";
  noAnswerIcon.title = "No answer yet";
  // qText specifically toggles collapse; clicking elsewhere in the header (empty space) sets the
  // Active Question instead (feature.md "Active Question (Pin/Flag)"). stopPropagation here keeps
  // the two behaviors from firing together.
  qText.addEventListener("click", (e) => {
    e.stopPropagation();
    const body2 = /** @type {HTMLElement} */ (header.nextElementSibling);
    toggleOpenAndApply(header, body2, `Q::${q.id}`);
  });

  const statusRow = document.createElement("div");
  statusRow.className = "status-icon-row";
  const iconButtons = {};
  for (const s of STATUS_ICONS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `icon-btn icon-${s.flag === "reviewLater" ? "review" : s.flag === "lessImportant" ? "less" : s.flag}`;
    btn.title = s.title;
    btn.innerHTML = `<i class="fa-solid ${s.icon}"></i>`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      handlers.onToggleStatus(q.id, /** @type {"done"|"reviewLater"|"duplicate"|"lessImportant"|"starred"} */ (s.flag));
    });
    statusRow.appendChild(btn);
    iconButtons[s.flag] = btn;
  }

  const flagBtn = document.createElement("button");
  flagBtn.type = "button";
  flagBtn.className = "icon-btn icon-flag";
  flagBtn.title = "Set as Active Question";
  flagBtn.innerHTML = '<i class="fa-solid fa-flag"></i>';
  flagBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onToggleActiveQuestion(q.id);
  });

  header.appendChild(dragHandle);
  header.appendChild(selectBox);
  header.appendChild(qText);
  header.appendChild(noAnswerIcon);
  header.appendChild(statusRow);
  header.appendChild(flagBtn);

  const body = document.createElement("div");
  body.className = "question-body";

  const answerContent = document.createElement("div");
  answerContent.className = "answer-content";

  const answerEditRow = document.createElement("div");
  answerEditRow.className = "answer-edit-row";
  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "btn btn-sm btn-outline-primary";
  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onEditAnswer(q.id);
  });
  answerEditRow.appendChild(editBtn);

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "btn btn-sm btn-outline-secondary";
  copyBtn.title = "Copy question";
  copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i>';
  copyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onCopyQuestion(q.id);
  });
  const copySearchBtn = document.createElement("button");
  copySearchBtn.type = "button";
  copySearchBtn.className = "btn btn-sm btn-outline-secondary icon-move";
  copySearchBtn.title = "Copy and search for duplicates";
  copySearchBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
  copySearchBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onCopyAndSearch(q.id);
  });
  const googleSearchBtn = document.createElement("button");
  googleSearchBtn.type = "button";
  googleSearchBtn.className = "btn btn-sm btn-outline-secondary";
  googleSearchBtn.title = "Search this question on Google";
  googleSearchBtn.innerHTML = '<i class="fa-brands fa-google"></i>';
  googleSearchBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onGoogleSearch(q.id);
  });
  answerEditRow.appendChild(copyBtn);
  answerEditRow.appendChild(copySearchBtn);
  answerEditRow.appendChild(googleSearchBtn);

  const statusControls = document.createElement("div");
  statusControls.className = "status-controls edit-gated";

  const moveBtn = mkBtn("fa-arrows-turn-right icon-move", "Move to different Subject/Topic/SubTopic", () => handlers.onOpenMoveForm(q.id));
  const upBtn = mkBtn("fa-arrow-up", "Move up", () => handlers.onMoveQuestionOrder(q.id, "up"));
  const downBtn = mkBtn("fa-arrow-down", "Move down", () => handlers.onMoveQuestionOrder(q.id, "down"));
  const topBtn = mkBtn("fa-angles-up", "Move to top", () => handlers.onMoveQuestionOrder(q.id, "top"));
  const bottomBtn = mkBtn("fa-angles-down", "Move to bottom", () => handlers.onMoveQuestionOrder(q.id, "bottom"));
  const deleteBtn = mkBtn("fa-trash icon-duplicate", "Delete question", () => handlers.onDeleteQuestion(q.id));
  [moveBtn, upBtn, downBtn, topBtn, bottomBtn, deleteBtn].forEach((b) => statusControls.appendChild(b));

  body.appendChild(answerContent);
  body.appendChild(answerEditRow);
  body.appendChild(statusControls);

  item.appendChild(header);
  item.appendChild(body);

  // Clicking empty header space (anything that didn't stopPropagation above: not qText, not an
  // icon/checkbox) sets this question as the Active Question. qText itself toggles collapse (see
  // its own listener above) and stopPropagates so both can't fire on the same click.
  header.addEventListener("click", () => {
    handlers.onToggleActiveQuestion(q.id);
  });

  patchQuestionNode(item, q, handlers);
  return item;
}

/** @param {string} iconClass @param {string} title @param {() => void} onClick */
function mkBtn(iconClass, title, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-sm btn-light";
  btn.title = title;
  btn.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

/**
 * @param {HTMLElement} el
 * @param {Question} q
 * @param {Record<string, any>} handlers
 */
export function patchQuestionNode(el, q, handlers) {
  const header = /** @type {HTMLElement} */ (el.querySelector(":scope > .question-header"));
  const body = /** @type {HTMLElement} */ (el.querySelector(":scope > .question-body"));
  const qText = header.querySelector(".q-text");
  if (qText) qText.textContent = q.question;

  applyOpenState(header, body, `Q::${q.id}`);

  for (const s of STATUS_ICONS) {
    const btn = header.querySelector(`.icon-${s.flag === "reviewLater" ? "review" : s.flag === "lessImportant" ? "less" : s.flag}`);
    if (btn) btn.classList.toggle("is-active", !!q[s.flag]);
  }

  const flagBtn = header.querySelector(".icon-flag");
  const isActive = appState.activeQuestion && appState.activeQuestion.questionId === q.id;
  if (flagBtn) flagBtn.classList.toggle("is-active", !!isActive);

  const selectBox = /** @type {HTMLInputElement} */ (header.querySelector(".question-select-checkbox"));
  if (selectBox) selectBox.checked = appState.selectedQuestionIds.has(q.id);

  const answerContent = body.querySelector(".answer-content");
  if (answerContent) answerContent.innerHTML = q.answer || "<em>No answer yet.</em>";

  const editBtn = body.querySelector(".answer-edit-row button");
  if (editBtn) editBtn.textContent = q.answer ? "Edit Answer" : "Add Answer";

  el.classList.toggle("no-answer", !q.answer);
  const noAnswerIcon = header.querySelector(".no-answer-icon");
  if (noAnswerIcon) noAnswerIcon.classList.toggle("d-none", !!q.answer);
}
