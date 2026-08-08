// @ts-check
/**
 * features/reviewShortcuts.js — keyboard shortcuts for the review flow, all scoped to the current
 * Active Question so they never fight normal browser/page behavior:
 *   Up/Down          move the Active Question to the previous/next question in the visible list
 *   d                mark the Active Question Done
 *   r                flag the Active Question Review Later
 *   s or *           flag the Active Question Starred
 *   Ctrl/Cmd+Up/Down move the Active Question to the top/bottom of its SubTopic
 *   Enter            expand/collapse the Active Question's answer
 *   Ctrl/Cmd+Enter    Google-search the Active Question
 *   Ctrl/Cmd+C        copy the Active Question's text (only when nothing else is text-selected)
 *   ?                 open the Keyboard Shortcuts help modal
 * d/r flags also drive spaced-repetition scheduling (see features/statusFlags.js / data/mutations.js
 * scheduleReview), so reviewing with the keyboard alone is enough to build a due-for-review queue.
 *
 * A single global keydown listener. To stay out of the user's way it backs off whenever: focus is
 * inside a text input/textarea/select/contenteditable (so typing in Bulk Add/Update panels, the
 * search box, or an answer editor isn't hijacked); focus is on a button/link/role=button (so Enter
 * activating that control isn't double-handled, and accordion headers keep their own Enter/Space
 * handling in render/accordion.js); or text is actively selected (so Ctrl/Cmd+C still copies the
 * selection everywhere else on the page, same as always).
 */
import { appState, toggleNodeOpen } from "../state/appState.js";
import { flattenQuestions } from "../data/group.js";
import { applyOpenState } from "../render/accordion.js";
import { findQuestionHeaderEl } from "../render/treeRenderer.js";
import * as activeQuestion from "./activeQuestion.js";
import * as statusFlags from "./statusFlags.js";
import * as moveButtons from "./moveButtons.js";
import * as copySingle from "./copySingle.js";
import { openShortcutsHelp } from "./keyboardShortcutsHelp.js";

/** @param {EventTarget|null} target */
function isTypingTarget(target) {
  const el = /** @type {HTMLElement|null} */ (target);
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** Whether the currently-focused element already owns Enter/Space (a button, link, or accordion header). */
function hasFocusedInteractiveElement() {
  const el = /** @type {HTMLElement|null} */ (document.activeElement);
  if (!el || el === document.body) return false;
  if (el.tagName === "BUTTON" || el.tagName === "A") return true;
  if (el.getAttribute("role") === "button") return true;
  return false;
}

function activeQuestionId() {
  return appState.activeQuestion && appState.activeQuestion.questionId;
}

/** @param {"up"|"down"} direction */
function moveActive(direction) {
  const ids = flattenQuestions(appState.grouped).map((q) => q.id);
  if (ids.length === 0) return;
  const currentId = activeQuestionId();
  const idx = currentId ? ids.indexOf(currentId) : -1;
  let nextIdx;
  if (idx === -1) {
    nextIdx = direction === "down" ? 0 : ids.length - 1;
  } else {
    nextIdx = direction === "down" ? Math.min(idx + 1, ids.length - 1) : Math.max(idx - 1, 0);
  }
  activeQuestion.setActiveQuestion(ids[nextIdx]);
}

/** @param {string} qid */
function toggleQuestionBody(qid) {
  const header = findQuestionHeaderEl(qid);
  const body = /** @type {HTMLElement|null} */ (header && header.nextElementSibling);
  if (!header || !body) return;
  const key = `Q::${qid}`;
  toggleNodeOpen(key);
  applyOpenState(header, body, key);
}

export function initReviewShortcuts() {
  document.addEventListener("keydown", (e) => {
    if (isTypingTarget(e.target)) return;

    if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      openShortcutsHelp();
      return;
    }

    // Ctrl/Cmd+Up/Down: move the Active Question to the top/bottom of its SubTopic.
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      const qid = activeQuestionId();
      if (qid) {
        e.preventDefault();
        moveButtons.moveQuestion(qid, e.key === "ArrowUp" ? "top" : "bottom");
      }
      return;
    }

    // Ctrl/Cmd+Enter: Google-search the Active Question.
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      if (hasFocusedInteractiveElement()) return;
      const qid = activeQuestionId();
      if (qid) {
        e.preventDefault();
        copySingle.googleSearchQuestion(qid);
      }
      return;
    }

    // Ctrl/Cmd+C: copy the Active Question's text, but only when nothing is text-selected — a real
    // selection means the user wants the browser's normal copy, everywhere on the page.
    if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C")) {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) return;
      const qid = activeQuestionId();
      if (qid) {
        e.preventDefault();
        copySingle.copyQuestionText(qid);
      }
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return; // no other modified combo belongs to this shortcut set

    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive("down");
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive("up");
      return;
    }

    if (e.key === "Enter") {
      if (hasFocusedInteractiveElement()) return;
      const qid = activeQuestionId();
      if (qid) {
        e.preventDefault();
        toggleQuestionBody(qid);
      }
      return;
    }

    const qid = activeQuestionId();
    if (!qid) return;
    if (e.key === "d" || e.key === "D") {
      statusFlags.toggleStatus(qid, "done");
    } else if (e.key === "r" || e.key === "R") {
      statusFlags.toggleStatus(qid, "reviewLater");
    } else if (e.key === "s" || e.key === "S" || e.key === "*") {
      statusFlags.toggleStatus(qid, "starred");
    }
  });
}
