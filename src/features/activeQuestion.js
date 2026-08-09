// @ts-check
/**
 * features/activeQuestion.js — Active Question (Pin/Flag). Single global pointer, ID-keyed,
 * survives reload (persisted via persistence/store.js). Setting/clearing repaints the affected
 * question rows (icon state) plus the header breadcrumb; deliberately does NOT trigger a full
 * tree recompute since it isn't a data mutation.
 */
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { repaint } from "./refresh.js";
import { openNode } from "../render/accordion.js";
import { scrollAndFlash } from "../render/highlight.js";
import { findQuestionHeaderEl } from "../render/treeRenderer.js";

/** @param {string} questionId */
export function toggleActiveQuestion(questionId) {
  const isCurrentlyActive = appState.activeQuestion && appState.activeQuestion.questionId === questionId;
  if (isCurrentlyActive) {
    appState.activeQuestion = null;
  } else {
    appState.activeQuestion = { fileId: /** @type {string} */ (appState.activeFileId), questionId };
  }
  store.writeActiveQuestion(appState.activeQuestion);
  repaint();
}

/**
 * Sets the Active Question unconditionally (unlike toggleActiveQuestion, never clears it) and
 * reveals it — expanding ancestors and scrolling into view, same as jumpToActiveQuestion (both leave
 * the question's own answer body collapsed). Used by keyboard Up/Down review navigation: each press
 * should land on a question without also expanding it, since Enter is the dedicated shortcut for
 * that (see features/reviewShortcuts.js).
 * @param {string} questionId
 */
export function setActiveQuestion(questionId) {
  appState.activeQuestion = { fileId: /** @type {string} */ (appState.activeFileId), questionId };
  store.writeActiveQuestion(appState.activeQuestion);
  revealActiveQuestion({ openAnswer: false });
}

/**
 * Sets the Active Question pointer without revealing/scrolling — used when marking a question
 * Starred while an Active Question is already set (see features/statusFlags.js), so the
 * newest-starred question becomes the resume point on next load (scroll-restore-on-load reads
 * appState.activeQuestion) without yanking the user's current scroll position to it mid-review.
 * @param {string} questionId
 */
export function setActiveQuestionQuiet(questionId) {
  appState.activeQuestion = { fileId: /** @type {string} */ (appState.activeFileId), questionId };
  store.writeActiveQuestion(appState.activeQuestion);
}

/**
 * Reveals the current Active Question, from anywhere in the app (page load/refresh, or clicking the
 * header breadcrumb's flag link) — expands its ancestor Subject/Topic/SubTopic (needed just to give
 * it a visible position to scroll to) and scrolls+flashes its header, but deliberately does NOT open
 * the question's own answer body: an auto-triggered reveal shouldn't also auto-expand content the
 * user didn't ask to read yet.
 */
export function jumpToActiveQuestion() {
  revealActiveQuestion({ openAnswer: false });
}

/**
 * Clears the Active Question pointer entirely — its flag icon on the question row and the header
 * breadcrumb's flag link both disappear on the next repaint. Used by Reset Progress: an active
 * question is itself a piece of review-progress state (where you left off), so resetting progress
 * should remove it and all its traces, not just Done/Review Later/spaced-repetition.
 */
export function clearActiveQuestion() {
  appState.activeQuestion = null;
  store.writeActiveQuestion(appState.activeQuestion);
  repaint();
}

/** @param {{openAnswer: boolean}} options */
function revealActiveQuestion({ openAnswer }) {
  if (!appState.activeQuestion) return;
  const activeQuestionId = appState.activeQuestion.questionId;
  const q = appState.rawData.find((x) => x.id === activeQuestionId);
  if (!q) return;
  openNode(`S::${q.subject}`);
  openNode(`${q.subject}::T::${q.topic}`);
  openNode(`${q.subject}::${q.topic}::ST::${q.subTopic}`);
  if (openAnswer) openNode(`Q::${q.id}`);
  repaint();
  const el = findQuestionHeaderEl(q.id);
  if (el) scrollAndFlash(el);
}

/**
 * @returns {{chainText: string|null, activeQuestionChainText: string|null, activeQuestionText: string|null}}
 */
export function computeBreadcrumbData() {
  /** @type {string|null} */
  let activeQuestionChainText = null;
  /** @type {string|null} */
  let activeQuestionText = null;
  if (appState.activeQuestion) {
    const activeQuestionId = appState.activeQuestion.questionId;
    const q = appState.rawData.find((x) => x.id === activeQuestionId);
    if (q) {
      activeQuestionChainText = `${q.subject} / ${q.topic} / ${q.subTopic}`;
      activeQuestionText = q.question;
    }
  }

  /** @type {string|null} */
  let chainText = null;
  // Reflect the deepest open chain, if any (first open Subject/Topic/SubTopic found).
  for (const key of appState.openNodeKeys) {
    const m = /^(.+)::T::(.+)$/.exec(key);
    if (m) {
      chainText = `${m[1]} / ${m[2]}`;
    }
  }
  for (const key of appState.openNodeKeys) {
    const m = /^(.+)::(.+)::ST::(.+)$/.exec(key);
    if (m) {
      chainText = `${m[1]} / ${m[2]} / ${m[3]}`;
    }
  }

  return { chainText, activeQuestionChainText, activeQuestionText };
}
