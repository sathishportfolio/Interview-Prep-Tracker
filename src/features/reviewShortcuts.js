// @ts-check
/**
 * features/reviewShortcuts.js — keyboard shortcuts for the review flow, all scoped to the current
 * Active Question so they never fight normal browser/page behavior:
 *   Up/Down          move the Active Question to the previous/next question in the visible list
 *   Home/End         scroll to the top/bottom of the page
 *   Tab              move to the next SubTopic and mark its first question the Active Question
 *                    (Subject → Topic → SubTopic order, cascading into the next Topic/Subject once
 *                    the current one runs out of SubTopics; stops — doesn't skip past — an empty
 *                    Subject/Topic/SubTopic; wraps to the first Subject's first question past the
 *                    last one). Works the same in Flatten View (see render/flatRenderer.js).
 *   Shift+Tab        the mirror of Tab: previous SubTopic, its LAST question, wrapping to the last
 *                    Subject's last question before the first one.
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
import { flattenQuestions, flattenNavigablePositions } from "../data/group.js";
import { applyOpenState, openNode, scrollNodeIntoView } from "../render/accordion.js";
import { findQuestionHeaderEl } from "../render/treeRenderer.js";
import { findFlatGroupEl } from "../render/flatRenderer.js";
import * as activeQuestion from "./activeQuestion.js";
import * as statusFlags from "./statusFlags.js";
import * as moveButtons from "./moveButtons.js";
import * as copySingle from "./copySingle.js";
import { openShortcutsHelp } from "./keyboardShortcutsHelp.js";
import { repaint } from "./refresh.js";

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

/**
 * Finds where the "current" position sits in navigable-position order (see
 * data/group.js's flattenNavigablePositions) — from the currently open Subject/Topic/SubTopic
 * accordion chain FIRST, falling back to the Active Question's SubTopic only if nothing is open at
 * all (e.g. right after Close All). The open-chain reconstruction has to win over the Active
 * Question when both exist: landing on an empty Subject/Topic (see revealEmptyPosition) opens that
 * chain WITHOUT touching the Active Question (there's no question there to point it at), so after
 * that a stale Active Question from wherever it was before would otherwise make the very next
 * Tab/Shift+Tab jump from the wrong place instead of continuing on from the empty stop.
 *
 * Reconstructing "current" from appState.openNodeKeys has to be scoped by prefix at each level, not
 * just pattern-matched anywhere in the set: Subject-level exclusivity is global (openNodeExclusive
 * closes every OTHER "S::" key), so at most one Subject is ever open, but closing a Subject doesn't
 * cascade-delete that Subject's own now-unreachable "T::"/"ST::" keys — they just linger in the set,
 * invisible in the DOM. Scanning for a bare "::ST::" match anywhere (as an earlier version of this
 * function did) could pick up one of those orphaned keys from a previously visited, now-closed
 * Subject instead of the actually-open one.
 * @param {Array<{level: "subject"|"topic"|"subTopic", subject: string, topic?: string, subTopic?: string}>} positions
 * @returns {number} index into `positions`, or -1 if no current position can be found
 */
function currentPositionIndex(positions) {
  const openKeys = [...appState.openNodeKeys];
  const openSubjectKey = openKeys.find((k) => k.startsWith("S::"));
  if (openSubjectKey) {
    const subject = openSubjectKey.slice(3);
    const openTopicKey = openKeys.find((k) => k.startsWith(`${subject}::T::`));
    if (openTopicKey) {
      const topic = openTopicKey.slice(`${subject}::T::`.length);
      const openSubTopicKey = openKeys.find((k) => k.startsWith(`${subject}::${topic}::ST::`));
      if (openSubTopicKey) {
        const subTopic = openSubTopicKey.slice(`${subject}::${topic}::ST::`.length);
        const idx = positions.findIndex((p) => p.level === "subTopic" && p.subject === subject && p.topic === topic && p.subTopic === subTopic);
        if (idx !== -1) return idx;
      }
      const idx = positions.findIndex((p) => p.level === "topic" && p.subject === subject && p.topic === topic);
      if (idx !== -1) return idx;
      const fallbackIdx = positions.findIndex((p) => p.subject === subject && p.topic === topic);
      if (fallbackIdx !== -1) return fallbackIdx;
    }
    const idx = positions.findIndex((p) => p.level === "subject" && p.subject === subject);
    if (idx !== -1) return idx;
    const fallbackIdx = positions.findIndex((p) => p.subject === subject);
    if (fallbackIdx !== -1) return fallbackIdx;
  }

  const qid = activeQuestionId();
  if (qid) {
    const q = appState.rawData.find((x) => x.id === qid);
    if (q) {
      const idx = positions.findIndex((p) => p.level === "subTopic" && p.subject === q.subject && p.topic === q.topic && p.subTopic === q.subTopic);
      if (idx !== -1) return idx;
    }
  }
  return -1;
}

/**
 * Reveals an empty (`firstQuestionId`/`lastQuestionId: null`) Subject/Topic/SubTopic position —
 * there's no question to activate, so this is the fallback for that case. Always updates
 * appState.openNodeKeys for the full ancestor chain (via openNode), even in Flatten View where that
 * has no visual accordion to expand (see render/flatRenderer.js) — currentPositionIndex reconstructs
 * "where Tab/Shift+Tab currently are" from openNodeKeys, so skipping this update while in Flatten
 * View left it stuck on whatever was open before, which is exactly what made Tab/Shift+Tab misbehave
 * after switching views mid-session but "work again" after a reload (openNodeKeys is transient,
 * never persisted — see state/appState.js — so a reload always starts it clean). Only the actual
 * scroll target differs by view: Flatten View scrolls to its own always-visible group heading
 * instead of a tree accordion node.
 * @param {{level: "subject"|"topic"|"subTopic", subject: string, topic?: string, subTopic?: string}} position
 */
function revealEmptyPosition(position) {
  const subjectKey = `S::${position.subject}`;
  openNode(subjectKey);
  let topicKey = null;
  let stKey = null;
  if (position.level !== "subject") {
    topicKey = `${position.subject}::T::${position.topic}`;
    openNode(topicKey);
    if (position.level !== "topic") {
      stKey = `${position.subject}::${position.topic}::ST::${position.subTopic}`;
      openNode(stKey);
    }
  }
  repaint();

  if (appState.toggles.flatGroupView) {
    findFlatGroupEl(position.subject, position.topic ?? null, position.subTopic ?? null)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  scrollNodeIntoView(stKey || topicKey || subjectKey);
}

/**
 * Tab/Shift+Tab shared implementation: moves to the next/previous navigable position (SubTopic, or
 * an empty Subject/Topic that has nothing deeper to descend into — see
 * data/group.js's flattenNavigablePositions) and marks its first (Tab) or last (Shift+Tab) question
 * the Active Question — which also reveals it (expanding ancestors and scrolling into view, same as
 * Up/Down; works unchanged in Flatten View since it's driven by the question row itself, not a
 * tree accordion — see activeQuestion.js's revealActiveQuestion). An empty position has no question
 * to activate, so it's revealed instead (see revealEmptyPosition) — either way this is a stop, not a
 * skip past it hunting for content. Runs off either end wraps around (Tab past the last position
 * goes to the very first Subject's first question; Shift+Tab past the first goes to the very last
 * Subject's last question) rather than dead-ending.
 * @param {"next"|"prev"} direction
 */
function navigateSubTopic(direction) {
  const positions = flattenNavigablePositions(appState.grouped);
  if (positions.length === 0) return;
  const idx = currentPositionIndex(positions);

  /** @type {number} */
  let targetIdx;
  if (direction === "next") {
    targetIdx = idx === -1 ? 0 : idx + 1;
    if (targetIdx >= positions.length) targetIdx = 0; // wrap: first Subject's first question
  } else {
    targetIdx = idx === -1 ? positions.length - 1 : idx - 1;
    if (targetIdx < 0) targetIdx = positions.length - 1; // wrap: last Subject's last question
  }

  const target = positions[targetIdx];
  const qid = direction === "next" ? target.firstQuestionId : target.lastQuestionId;
  if (qid) {
    activeQuestion.setActiveQuestion(qid);
  } else {
    revealEmptyPosition(target);
  }
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

    if (e.key === "Home") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      navigateSubTopic(e.shiftKey ? "prev" : "next");
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
