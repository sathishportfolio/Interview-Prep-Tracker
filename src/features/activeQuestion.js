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
 * reveals it — expanding ancestors and scrolling into view, same as jumpToActiveQuestion — but
 * WITHOUT opening its own answer body. Used by keyboard Up/Down review navigation: each press
 * should land on a question without also expanding it, since Enter is the dedicated shortcut for
 * that (see features/reviewShortcuts.js).
 * @param {string} questionId
 */
export function setActiveQuestion(questionId) {
  appState.activeQuestion = { fileId: /** @type {string} */ (appState.activeFileId), questionId };
  store.writeActiveQuestion(appState.activeQuestion);
  revealActiveQuestion({ openAnswer: false });
}

/** Jumps to (expands + scrolls + flashes) the current Active Question, from anywhere in the app. */
export function jumpToActiveQuestion() {
  revealActiveQuestion({ openAnswer: true });
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
