// @ts-check
/**
 * render/nodeViews/questionView.js — create/patch for a single Question row. Rendering only: all
 * click handlers call into a `handlers` object supplied by the caller (ultimately features/*),
 * never DOM logic owned by features. This file never imports anything from features/*.
 * @typedef {import('../../types.js').Question} Question
 */
import { appState } from "../../state/appState.js";
import { applyOpenState } from "../accordion.js";
import { isReorderTarget } from "../reorderEligibility.js";
import { formatRelativeTime } from "../../data/relativeTime.js";
import { openPanel as coordinatorOpenPanel, panelClosed as coordinatorPanelClosed } from "../panelCoordinator.js";
import { highlightCodeBlocks } from "../codeHighlight.js";
import { buildLinkChipIcon } from "../linkChipIcon.js";
import { pickDisplayTagIcon } from "../../data/tagIcon.js";
import { extractYouTubeVideoId } from "../../data/youtubeTime.js";

/** @returns {boolean} true on touch/coarse-pointer devices (no reliable hover) */
const isCoarsePointer = () => window.matchMedia("(hover: none)").matches;

/** Delay before a hover-intent panel actually closes on mouseleave — tolerates the small visual gap
 * between a button and its panel (moving the pointer across it would otherwise drop CSS `:hover`
 * before the panel's own hover picked it up, causing flicker). */
const HOVER_CLOSE_DELAY_MS = 150;

/**
 * Wires a hover-intent open/close (mouseenter opens immediately, mouseleave closes after a short
 * delay so crossing the button->panel gap doesn't flicker) for a desktop/hover-capable pointer,
 * coordinated via panelCoordinator so opening this panel closes whatever OTHER panel was open.
 * Keyboard focus (focusin/focusout) gets the same treatment for accessibility. Visibility itself is
 * driven by the `.open` class (see its CSS), not `:hover`, so JS is fully in control of when it
 * shows — no competing pure-CSS trigger to fight with.
 * @param {HTMLElement} wrap
 * @param {HTMLElement} panel
 */
function attachHoverIntentPanel(wrap, panel) {
  let closeTimer = /** @type {ReturnType<typeof setTimeout>|null} */ (null);
  const close = () => {
    panel.classList.remove("open");
    coordinatorPanelClosed(close);
  };
  const openNow = () => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    coordinatorOpenPanel(close);
    panel.classList.add("open");
  };
  const scheduleClose = () => {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(close, HOVER_CLOSE_DELAY_MS);
  };
  wrap.addEventListener("mouseenter", openNow);
  wrap.addEventListener("mouseleave", scheduleClose);
  wrap.addEventListener("focusin", openNow);
  wrap.addEventListener("focusout", scheduleClose);
}

/**
 * @typedef {Object} TreeHandlers
 * @property {(qid: string, flag: "done"|"reviewLater"|"duplicate"|"notImportant"|"starred"|"failed"|"visited") => void} onToggleStatus
 * @property {(qid: string, status: "done"|"failed"|"reviewLater", withNotes: boolean) => void} onMarkStatus
 * @property {(qid: string) => void} onResetTriState
 * @property {(qid: string, tag: string) => void} onToggleQuestionTag
 * @property {(qid: string, tag: string) => void} onCreateTag
 * @property {(tag: string) => void} onFilterByTag
 * @property {(qid: string) => void} onAddQuestionLink
 * @property {(qid: string, linkId: string, label: string, url: string) => void} onEditQuestionLink
 * @property {(qid: string, linkId: string, label: string) => void} onRemoveQuestionLink
 * @property {(qid: string, orderedLinkIds: string[]) => void} onReorderQuestionLinks
 * @property {(qid: string, link: {id: string, url: string, label: string}) => void} onOpenYouTubePlayer
 * @property {(qid: string) => void} onCycleDifficulty
 * @property {(qid: string) => void} onEditAnswer
 * @property {(qid: string) => void} onEditQuestionText
 * @property {(qid: string) => void} onOpenMoveForm
 * @property {(qid: string) => void} onDeleteQuestion
 * @property {(qid: string) => void} onCopyQuestion
 * @property {(qid: string) => void} onCopyAndSearch
 * @property {(qid: string, mode?: "whatwhywherehow"|"codeExample"|"plain"|"subject"|"topic"|"subTopic") => void} onGoogleSearch
 * @property {(qid: string, dir: "up"|"down"|"top"|"bottom") => void} onMoveQuestionOrder
 * @property {(qid: string) => void} onToggleActiveQuestion
 * @property {(qid: string) => void} onToggleQuestionOpen
 * @property {(qid: string) => void} onToggleSelectQuestion
 * @property {(level: "subject"|"topic"|"subTopic"|"question", scope: any) => void} onReorderSelect
 * @property {(subject: string, topic: string, subTopic: string, level: "subject"|"topic"|"subTopic", name: string) => void} onCopyMenu
 * @property {(level: "subject"|"topic"|"subTopic", scope: any) => void} onRenameGroup
 * @property {(level: "subject"|"topic"|"subTopic", scope: any) => void} onDeleteGroup
 * @property {(level: "subject"|"topic"|"subTopic", scope: any) => void} onToggleGroupNotImportant
 * @property {(level: "subject"|"topic"|"subTopic", scope: any) => void} onAddGroupLink
 * @property {(level: "subject"|"topic"|"subTopic", scope: any, linkId: string, label: string, url: string) => void} onEditGroupLink
 * @property {(level: "subject"|"topic"|"subTopic", scope: any, linkId: string, label: string) => void} onRemoveGroupLink
 */

// "notImportant" is deliberately not in this list — its icon lives next to the Google Search
// button in answerEditRow instead (see below), not in the header's status-icon-row. "done",
// "failed", and "reviewLater" are ALSO excluded — all three get the same special dropdown-menu
// treatment (see buildTriStateButton below) instead of the plain toggle button every other entry
// here gets. "duplicate" has no accordion icon at all (removed per user request) — the
// field/filter/CSV/stats support for it stays untouched elsewhere.
const STATUS_ICONS = [
  { flag: "starred", icon: "fa-star", title: "Starred" },
  { flag: "visited", icon: "fa-eye", title: "Visited" },
];

/** @type {Record<"done"|"failed"|"reviewLater", {iconClass: string, label: string}>} */
const TRI_STATE_META = {
  done: { iconClass: "fa-square-check", label: "Done" },
  failed: { iconClass: "fa-circle-xmark", label: "Failed" },
  reviewLater: { iconClass: "fa-clock", label: "Review Later" },
};

/** @param {Question} q @param {"done"|"failed"|"reviewLater"} status @returns {boolean} */
function triStateActive(q, status) {
  return status === "done" ? !!q.done : status === "failed" ? !!q.failed : !!q.reviewLater;
}

/** @param {Question} q @param {"done"|"failed"|"reviewLater"} status @returns {number} */
function triStateCount(q, status) {
  return status === "done" ? q.doneCount ?? 0 : status === "failed" ? q.failedCount ?? 0 : q.reviewLaterCount ?? 0;
}

/** @param {Question} q @param {"done"|"failed"|"reviewLater"} status @returns {{ts: number, note?: string}[]} */
function triStateHistory(q, status) {
  return (status === "done" ? q.doneHistory : status === "failed" ? q.failedHistory : q.reviewLaterHistory) ?? [];
}

/** @param {"easy"|"medium"|"hard"|null|undefined} difficulty @returns {string} */
function difficultyTitle(difficulty) {
  if (difficulty === "easy") return "Difficulty: Easy (click to cycle)";
  if (difficulty === "medium") return "Difficulty: Medium (click to cycle)";
  if (difficulty === "hard") return "Difficulty: Hard (click to cycle)";
  return "Difficulty: not set (click to cycle)";
}

/** @param {string} flag @returns {string} */
function iconClassSuffix(flag) {
  return flag === "reviewLater" ? "review" : flag === "notImportant" ? "notimportant" : flag;
}

/**
 * Builds one Done/Failed/Review Later button — icon + count badge, a "Mark with Notes" dropdown
 * (hover-revealed on desktop, tap-revealed 2-item menu on touch), and Ctrl/Cmd+click or long-press
 * to reset ALL THREE statuses at once (see features/statusFlags.js's resetTriState). All three
 * buttons across the row share this exact same structure/behavior — only the status/icon/label
 * differ (see TRI_STATE_META).
 * @param {"done"|"failed"|"reviewLater"} status
 * @param {Question} q
 * @param {Record<string, any>} handlers
 * @returns {HTMLElement}
 */
function buildTriStateButton(status, q, handlers) {
  const { iconClass, label } = TRI_STATE_META[status];
  const wrap = document.createElement("div");
  wrap.className = "done-dropdown-wrap";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `icon-btn icon-${iconClassSuffix(status)}`;
  btn.innerHTML = `<i class="fa-solid ${iconClass}"></i><span class="done-count-badge"></span>`;
  const notesPanel = document.createElement("div");
  const touchMode = isCoarsePointer();
  notesPanel.className = touchMode ? "done-notes-panel done-notes-panel-touch" : "done-notes-panel";
  const closeMenu = () => {
    notesPanel.hidden = true;
    document.removeEventListener("click", onMenuDocClick);
    coordinatorPanelClosed(closeMenu);
  };
  const onMenuDocClick = (e) => {
    if (!wrap.contains(/** @type {Node} */ (e.target))) closeMenu();
  };
  if (!touchMode) attachHoverIntentPanel(wrap, notesPanel);
  if (touchMode) {
    notesPanel.hidden = true;
    for (const { withNotes, itemLabel } of [
      { withNotes: false, itemLabel: `Mark as ${label}` },
      { withNotes: true, itemLabel: `Mark as ${label} with Notes` },
    ]) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "done-dropdown-item";
      item.textContent = itemLabel;
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        closeMenu();
        handlers.onMarkStatus(q.id, status, withNotes);
      });
      notesPanel.appendChild(item);
    }
  } else {
    const notesItem = document.createElement("button");
    notesItem.type = "button";
    notesItem.className = "done-dropdown-item";
    notesItem.textContent = "Mark with Notes";
    notesItem.addEventListener("click", (e) => {
      e.stopPropagation();
      handlers.onMarkStatus(q.id, status, true);
    });
    notesPanel.appendChild(notesItem);
  }
  let longPressTimer = /** @type {ReturnType<typeof setTimeout>|null} */ (null);
  let longPressFired = false;
  btn.addEventListener(
    "touchstart",
    () => {
      longPressFired = false;
      longPressTimer = setTimeout(() => {
        longPressFired = true;
        handlers.onResetTriState(q.id);
      }, 500);
    },
    { passive: true }
  );
  btn.addEventListener("touchend", () => {
    if (longPressTimer) clearTimeout(longPressTimer);
  });
  btn.addEventListener(
    "touchmove",
    () => {
      if (longPressTimer) clearTimeout(longPressTimer);
    },
    { passive: true }
  );
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (longPressFired) {
      longPressFired = false;
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      handlers.onResetTriState(q.id);
      return;
    }
    if (touchMode) {
      const opening = notesPanel.hidden;
      if (opening) {
        coordinatorOpenPanel(closeMenu);
        notesPanel.hidden = false;
        document.addEventListener("click", onMenuDocClick);
      } else {
        closeMenu();
      }
      return;
    }
    handlers.onMarkStatus(q.id, status, false);
  });
  wrap.appendChild(btn);
  wrap.appendChild(notesPanel);
  return wrap;
}

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

  // qText + its mobile-only "last updated" line live together in one wrapper so the timestamp
  // stacks directly under the question text on mobile (see .q-updated-inline in style.css) without
  // disturbing qText's own desktop ellipsis-truncation layout — the wrapper, not qText itself, is
  // the flex:1 item that claims the header row's remaining width.
  const qTextWrap = document.createElement("div");
  qTextWrap.className = "q-text-wrap";

  // qTextLine holds the tag icon + question text side by side; qTextWrap itself stays a column so
  // updatedAtInline (appended below) still stacks directly underneath, unaffected.
  const qTextLine = document.createElement("div");
  qTextLine.className = "q-text-line";

  // Custom per-tag FA icon (Manage Tags popup, features/tagManager.js) — shown before the question
  // text whenever the FIRST tag in this question's own tag list has an icon set (see
  // data/tagIcon.js's pickDisplayTagIcon). Hidden by default; toggled visible in patchQuestionNode
  // below since it depends on live tag/meta state, not just creation-time data.
  const qTagIcon = document.createElement("i");
  qTagIcon.className = "q-tag-icon";
  qTagIcon.hidden = true;
  qTextLine.appendChild(qTagIcon);

  const qText = document.createElement("span");
  qText.className = "q-text";
  // qText specifically toggles collapse; clicking elsewhere in the header (empty space) sets the
  // Active Question instead (feature.md "Active Question (Pin/Flag)"). stopPropagation here keeps
  // the two behaviors from firing together.
  // Ctrl/Cmd+click is a shortcut straight to Google Search (same action as the search button in the
  // answer row) instead of toggling open/closed.
  qText.addEventListener("click", (e) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      handlers.onGoogleSearch(q.id);
      return;
    }
    handlers.onToggleQuestionOpen(q.id);
  });

  // Touch equivalent of Ctrl+click: double-tap or long-press on the question text triggers Google
  // Search. preventDefault on the qualifying touchend stops the browser's synthesized click from
  // also firing (which would otherwise toggle open/closed on the same interaction).
  let lastTapAt = 0;
  let longPressTimer = /** @type {ReturnType<typeof setTimeout>|null} */ (null);
  let longPressFired = false;
  const LONG_PRESS_MS = 500;
  const DOUBLE_TAP_MS = 350;
  const clearLongPressTimer = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };
  qText.addEventListener(
    "touchstart",
    () => {
      longPressFired = false;
      clearLongPressTimer();
      longPressTimer = setTimeout(() => {
        longPressFired = true;
        handlers.onGoogleSearch(q.id);
      }, LONG_PRESS_MS);
    },
    { passive: true }
  );
  qText.addEventListener("touchmove", clearLongPressTimer, { passive: true });
  qText.addEventListener("touchcancel", clearLongPressTimer, { passive: true });
  qText.addEventListener("touchend", (e) => {
    clearLongPressTimer();
    if (longPressFired) {
      e.preventDefault();
      return;
    }
    const now = Date.now();
    if (now - lastTapAt < DOUBLE_TAP_MS) {
      lastTapAt = 0;
      e.preventDefault();
      handlers.onGoogleSearch(q.id);
    } else {
      lastTapAt = now;
    }
  });

  // Last-updated timestamp, mobile only (see .q-updated-inline in style.css) — clock icon + compact
  // age ("5 min", "2 hr", ...) directly under the question text, inside the accordion header itself
  // (not the expandable answer body) so it's visible even while collapsed.
  const updatedAtInline = document.createElement("div");
  updatedAtInline.className = "q-updated-inline";
  updatedAtInline.innerHTML = '<i class="fa-solid fa-clock"></i><span class="q-updated-inline-text"></span>';

  qTextLine.appendChild(qText);
  qTextWrap.appendChild(qTextLine);
  qTextWrap.appendChild(updatedAtInline);

  const statusRow = document.createElement("div");
  statusRow.className = "status-icon-row";

  // Done/Failed/Review Later all share this same dropdown-menu treatment (see buildTriStateButton):
  // on a desktop/mouse (hover-capable) device, a direct click marks that status immediately (no
  // notes) — see features/statusFlags.js's markStatusWithMenu(qid, status, false) — and hovering the
  // button reveals a "Mark with Notes" option (CSS-only) for the with-notes variant. On a touch
  // device (no hover), there's no way to reveal that hover option, so a tap instead opens a small
  // 2-item menu ("Mark as <Status>" / "Mark as <Status> with Notes") the same way the
  // pre-hover-redesign UI did. Ctrl/Cmd+click (desktop) or long-press (touch, mirroring the qText
  // long-press pattern above) resets ALL THREE statuses' counters/history at once, regardless of
  // which of the three buttons triggered it — see features/statusFlags.js's resetTriState.
  const doneWrap = buildTriStateButton("done", q, handlers);
  const failedWrap = buildTriStateButton("failed", q, handlers);
  const reviewWrap = buildTriStateButton("reviewLater", q, handlers);
  statusRow.appendChild(failedWrap);
  statusRow.appendChild(reviewWrap);

  for (const s of STATUS_ICONS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `icon-btn icon-${iconClassSuffix(s.flag)}`;
    btn.title = s.title;
    btn.innerHTML = `<i class="fa-solid ${s.icon}"></i>`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      handlers.onToggleStatus(q.id, /** @type {"done"|"reviewLater"|"duplicate"|"notImportant"|"starred"|"failed"|"visited"} */ (s.flag));
    });
    statusRow.appendChild(btn);
  }

  const difficultyDot = document.createElement("button");
  difficultyDot.type = "button";
  difficultyDot.className = "icon-btn difficulty-dot-btn";
  difficultyDot.innerHTML = '<span class="difficulty-dot"></span>';
  difficultyDot.addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onCycleDifficulty(q.id);
  });

  const flagBtn = document.createElement("button");
  flagBtn.type = "button";
  flagBtn.className = "icon-btn icon-flag";
  flagBtn.title = "Set as Active Question";
  flagBtn.innerHTML = '<i class="fa-solid fa-flag"></i>';
  flagBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onToggleActiveQuestion(q.id);
  });

  // Edit question text — lives directly in the header (always visible regardless of Edit Mode,
  // right before the Done button) instead of down in the answer body's statusControls row, so it's
  // reachable without opening the accordion first.
  const editTextBtn = document.createElement("button");
  editTextBtn.type = "button";
  editTextBtn.className = "icon-btn icon-edit-text";
  editTextBtn.title = "Edit question text";
  editTextBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
  editTextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onEditQuestionText(q.id);
  });

  const reorderBadge = document.createElement("span");
  reorderBadge.className = "reorder-badge";

  // Header actions collapse behind a single "more" button on narrow/mobile screens (see
  // .header-more-btn / .header-actions-wrap in style.css) so the question text keeps most of the
  // row's width instead of being squeezed by 6+ inline icon buttons. On desktop this wrapper is
  // `display: contents`, so statusRow/flagBtn lay out exactly as if unwrapped. difficultyDot is
  // deliberately NOT in this group — it's appended directly into `header` below, right before
  // doneWrap, so it always stays visible (both collapsed/expanded states) immediately before the
  // Done button rather than getting hidden behind "more" with the rest.
  const headerActionsWrap = document.createElement("div");
  headerActionsWrap.className = "header-actions-wrap";
  headerActionsWrap.appendChild(statusRow);
  headerActionsWrap.appendChild(flagBtn);

  const headerMoreBtn = document.createElement("button");
  headerMoreBtn.type = "button";
  headerMoreBtn.className = "icon-btn header-more-btn";
  headerMoreBtn.title = "More actions";
  headerMoreBtn.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
  const closeHeaderActions = () => {
    headerActionsWrap.classList.remove("open");
    document.removeEventListener("click", onHeaderActionsDocClick);
    coordinatorPanelClosed(closeHeaderActions);
  };
  const onHeaderActionsDocClick = (e) => {
    if (!headerActionsWrap.contains(/** @type {Node} */ (e.target)) && e.target !== headerMoreBtn) closeHeaderActions();
  };
  headerMoreBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = !headerActionsWrap.classList.contains("open");
    if (opening) {
      coordinatorOpenPanel(closeHeaderActions);
      headerActionsWrap.classList.add("open");
      document.addEventListener("click", onHeaderActionsDocClick);
    } else {
      closeHeaderActions();
    }
  });

  // Last-updated timestamp, desktop only (see .q-updated-header in style.css) — a small clock icon
  // + compact age ("5 min", "2 hr", ...) sitting right before the Done icon, so it reads inline with
  // the row without competing for attention against the actionable icons next to it.
  const updatedAtHeader = document.createElement("span");
  updatedAtHeader.className = "q-updated-header";
  updatedAtHeader.innerHTML = '<i class="fa-solid fa-clock"></i><span class="q-updated-header-text"></span>';

  header.appendChild(dragHandle);
  header.appendChild(selectBox);
  header.appendChild(reorderBadge);
  header.appendChild(qTextWrap);
  header.appendChild(updatedAtHeader);
  header.appendChild(difficultyDot);
  header.appendChild(editTextBtn);
  header.appendChild(doneWrap);
  header.appendChild(headerMoreBtn);
  header.appendChild(headerActionsWrap);

  // Reorder-mode click interception — capture phase, added AFTER this header's normal listeners are
  // wired below, so it runs first and (via stopImmediatePropagation) can pre-empt them entirely when
  // this exact question is an eligible reorder target. See features/reorderMode.js.
  header.addEventListener(
    "click",
    (e) => {
      if (!isReorderTarget("question", { subject: q.subject, topic: q.topic, subTopic: q.subTopic })) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      handlers.onReorderSelect("question", { subject: q.subject, topic: q.topic, subTopic: q.subTopic, id: q.id });
    },
    true
  );

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
  // Google Search — a split button: clicking the main button directly runs the default query (Topic
  // scope + "with example code snippet"); the caret opens a menu of other query styles.
  const googleSearchWrap = document.createElement("div");
  googleSearchWrap.className = "google-search-wrap";
  const googleSearchBtn = document.createElement("button");
  googleSearchBtn.type = "button";
  googleSearchBtn.className = "btn btn-sm btn-outline-secondary";
  googleSearchBtn.title = "Search this question on Google (In <Topic>, ... with example code snippet)";
  googleSearchBtn.innerHTML = '<i class="fa-brands fa-google"></i>';
  googleSearchBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onGoogleSearch(q.id);
  });
  const googleSearchCaret = document.createElement("button");
  googleSearchCaret.type = "button";
  googleSearchCaret.className = "btn btn-sm btn-outline-secondary google-search-caret";
  googleSearchCaret.title = "More search styles";
  googleSearchCaret.innerHTML = '<i class="fa-solid fa-caret-down"></i>';
  const googleSearchPanel = document.createElement("div");
  googleSearchPanel.className = "done-dropdown-panel google-search-panel";
  googleSearchPanel.hidden = true;
  const closeGoogleSearchMenu = () => {
    googleSearchPanel.hidden = true;
    document.removeEventListener("click", onGoogleSearchDocClick);
    coordinatorPanelClosed(closeGoogleSearchMenu);
  };
  const onGoogleSearchDocClick = (e) => {
    if (!googleSearchWrap.contains(/** @type {Node} */ (e.target))) closeGoogleSearchMenu();
  };
  googleSearchCaret.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = googleSearchPanel.hidden;
    if (opening) {
      coordinatorOpenPanel(closeGoogleSearchMenu);
      googleSearchPanel.hidden = false;
      document.addEventListener("click", onGoogleSearchDocClick);
    } else {
      closeGoogleSearchMenu();
    }
  });
  for (const [mode, label] of [
    ["plain", "Plain Question"],
    ["codeExample", "Ask for Code Example"],
    ["whatwhywherehow", "What, Why, Where, How"],
    ["subTopic", `As ${q.subTopic}`],
    ["topic", `As ${q.topic}`],
    ["subject", `As ${q.subject}`],
  ]) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "done-dropdown-item";
    item.dataset.mode = mode;
    item.textContent = label;
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      closeGoogleSearchMenu();
      handlers.onGoogleSearch(q.id, mode);
    });
    googleSearchPanel.appendChild(item);
  }
  googleSearchWrap.appendChild(googleSearchBtn);
  googleSearchWrap.appendChild(googleSearchCaret);
  googleSearchWrap.appendChild(googleSearchPanel);

  const notImportantBtn = document.createElement("button");
  notImportantBtn.type = "button";
  notImportantBtn.className = "btn btn-sm btn-outline-secondary icon-notimportant";
  notImportantBtn.title = "Not Important";
  notImportantBtn.innerHTML = '<i class="fa-solid fa-ban"></i>';
  notImportantBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onToggleStatus(q.id, "notImportant");
  });

  // Status History viewer — merged, chronological timeline of every Mark Done/Failed/Review Later
  // (with or without notes) click across all three (see features/statusFlags.js's
  // markStatusWithMenu), each entry colored by which status it was (see buildMergedHistory /
  // .history-entry-done/-failed/-review in style.css). Content is rebuilt from
  // q.doneHistory/failedHistory/reviewLaterHistory on every patchQuestionNode call, not just at
  // creation. Always-visible icon; the panel itself opens on hover (CSS-only, see
  // .history-dropdown-wrap:hover .history-dropdown-panel) rather than click.
  const historyWrap = document.createElement("div");
  historyWrap.className = "history-dropdown-wrap";
  const historyBtn = document.createElement("button");
  historyBtn.type = "button";
  historyBtn.className = "btn btn-sm btn-outline-secondary icon-history";
  historyBtn.title = "Status History (Done/Failed/Review Later)";
  historyBtn.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i>';
  historyBtn.addEventListener("click", (e) => e.stopPropagation());
  const historyPanel = document.createElement("div");
  historyPanel.className = "history-dropdown-panel";
  if (!isCoarsePointer()) attachHoverIntentPanel(historyWrap, historyPanel);
  historyWrap.appendChild(historyBtn);
  historyWrap.appendChild(historyPanel);

  // Tags — toggle any existing global tag on/off, or create+add a brand new one. Chip list and the
  // input's "already exists" state are rebuilt from appState.globalTags/q.tags on every
  // patchQuestionNode call.
  const tagsWrap = document.createElement("div");
  tagsWrap.className = "tags-dropdown-wrap";
  const tagsBtn = document.createElement("button");
  tagsBtn.type = "button";
  tagsBtn.className = "btn btn-sm btn-outline-secondary icon-tags";
  tagsBtn.title = "Tags";
  tagsBtn.innerHTML = '<i class="fa-solid fa-tags"></i>';
  const tagsPanel = document.createElement("div");
  tagsPanel.className = "tags-dropdown-panel";
  tagsPanel.hidden = true;
  const tagChipsList = document.createElement("div");
  tagChipsList.className = "tag-chips-list";
  const tagNewRow = document.createElement("div");
  tagNewRow.className = "tag-new-row";
  const tagNewInput = document.createElement("input");
  tagNewInput.type = "text";
  tagNewInput.className = "tag-new-input";
  tagNewInput.placeholder = "New tag…";
  const tagAddBtn = document.createElement("button");
  tagAddBtn.type = "button";
  tagAddBtn.className = "btn btn-sm btn-outline-secondary";
  tagAddBtn.textContent = "Add";
  const submitNewTag = () => {
    const value = tagNewInput.value;
    tagNewInput.value = "";
    if (value.trim()) handlers.onCreateTag(q.id, value);
  };
  tagAddBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    submitNewTag();
  });
  tagNewInput.addEventListener("click", (e) => e.stopPropagation());
  tagNewInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.stopPropagation();
      submitNewTag();
    }
  });
  tagNewRow.appendChild(tagNewInput);
  tagNewRow.appendChild(tagAddBtn);
  tagsPanel.appendChild(tagChipsList);
  tagsPanel.appendChild(tagNewRow);
  const onTagsDocClick = (e) => {
    if (!tagsWrap.contains(/** @type {Node} */ (e.target))) closeTagsPanel();
  };
  const closeTagsPanel = () => {
    tagsPanel.hidden = true;
    document.removeEventListener("click", onTagsDocClick);
    coordinatorPanelClosed(closeTagsPanel);
  };
  tagsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = tagsPanel.hidden;
    if (opening) {
      coordinatorOpenPanel(closeTagsPanel);
      tagsPanel.hidden = false;
      document.addEventListener("click", onTagsDocClick);
    } else {
      closeTagsPanel();
    }
  });
  tagsWrap.appendChild(tagsBtn);
  tagsWrap.appendChild(tagsPanel);

  const tagsDisplayRow = document.createElement("div");
  tagsDisplayRow.className = "question-tags-row";

  // Related Links — a user-ordered (drag-to-reorder, see features/dragDrop.js's refreshSortables)
  // list of {label, url} links, each always opened in a new tab. Edit panel (list + add-link mini
  // form) rebuilt from q.links on every patchQuestionNode call, same click-toggled-panel pattern as
  // Tags above; the read-only linksDisplayRow underneath the answer lets a link be opened directly
  // without going through the edit panel first.
  const linksWrap = document.createElement("div");
  linksWrap.className = "links-dropdown-wrap";
  const linksBtn = document.createElement("button");
  linksBtn.type = "button";
  linksBtn.className = "btn btn-sm btn-outline-secondary icon-links";
  linksBtn.title = "Related Links";
  linksBtn.innerHTML = '<i class="fa-solid fa-link"></i>';
  const linksPanel = document.createElement("div");
  linksPanel.className = "links-dropdown-panel";
  linksPanel.hidden = true;
  const linksEditList = document.createElement("div");
  linksEditList.className = "related-links-list";
  linksEditList.dataset.qid = q.id;
  const linksAddBtn = document.createElement("button");
  linksAddBtn.type = "button";
  linksAddBtn.className = "btn btn-sm btn-outline-secondary link-add-btn";
  linksAddBtn.textContent = "+ Add link";
  linksAddBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onAddQuestionLink(q.id);
  });
  linksPanel.appendChild(linksEditList);
  linksPanel.appendChild(linksAddBtn);
  const onLinksDocClick = (e) => {
    if (!linksWrap.contains(/** @type {Node} */ (e.target))) closeLinksPanel();
  };
  const closeLinksPanel = () => {
    linksPanel.hidden = true;
    document.removeEventListener("click", onLinksDocClick);
    coordinatorPanelClosed(closeLinksPanel);
  };
  linksBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = linksPanel.hidden;
    if (opening) {
      coordinatorOpenPanel(closeLinksPanel);
      linksPanel.hidden = false;
      document.addEventListener("click", onLinksDocClick);
    } else {
      closeLinksPanel();
    }
  });
  linksWrap.appendChild(linksBtn);
  linksWrap.appendChild(linksPanel);

  const linksDisplayRow = document.createElement("div");
  linksDisplayRow.className = "question-links-row";

  answerEditRow.appendChild(copyBtn);
  answerEditRow.appendChild(copySearchBtn);
  answerEditRow.appendChild(googleSearchWrap);
  answerEditRow.appendChild(notImportantBtn);
  answerEditRow.appendChild(historyWrap);
  answerEditRow.appendChild(tagsWrap);
  answerEditRow.appendChild(linksWrap);

  const statusControls = document.createElement("div");
  statusControls.className = "status-controls edit-gated";

  const moveBtn = mkBtn("fa-arrows-turn-right icon-move", "Move to different Subject/Topic/SubTopic", () => handlers.onOpenMoveForm(q.id));
  const upBtn = mkBtn("fa-arrow-up", "Move up", () => handlers.onMoveQuestionOrder(q.id, "up"));
  const downBtn = mkBtn("fa-arrow-down", "Move down", () => handlers.onMoveQuestionOrder(q.id, "down"));
  const topBtn = mkBtn("fa-angles-up", "Move to top", () => handlers.onMoveQuestionOrder(q.id, "top"));
  const bottomBtn = mkBtn("fa-angles-down", "Move to bottom", () => handlers.onMoveQuestionOrder(q.id, "bottom"));
  const deleteBtn = mkBtn("fa-trash icon-duplicate", "Delete question", () => handlers.onDeleteQuestion(q.id));
  [moveBtn, upBtn, downBtn, topBtn, bottomBtn, deleteBtn].forEach((b) => statusControls.appendChild(b));

  // statusControls nests INSIDE answerEditRow (not a separate body child) so both button groups
  // share one row — edit-gated hiding still applies to just the statusControls buttons.
  answerEditRow.appendChild(statusControls);

  body.appendChild(tagsDisplayRow);
  body.appendChild(answerContent);
  body.appendChild(linksDisplayRow);
  body.appendChild(answerEditRow);

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

/**
 * Wires a Related Link anchor's click: a YouTube link with a recognizable video id opens the
 * embedded-player modal (handlers.onOpenYouTubePlayer) on a plain left click. A YouTube link with
 * no video id (e.g. a bare playlist URL — nothing embeddable) and Ctrl/Cmd+click (or any
 * non-primary-button click) on any link instead fall through to the anchor's own href/
 * target="_blank", opening it directly in a new tab — exactly like every non-YouTube link always
 * does (no special-casing needed there).
 * @param {HTMLAnchorElement} anchor
 * @param {{id: string, url: string, label: string}} link
 * @param {string} questionId
 * @param {Record<string, any>} handlers
 */
function wireLinkAnchorClick(anchor, link, questionId, handlers) {
  anchor.addEventListener("click", (e) => {
    e.stopPropagation();
    if (e.button !== 0 || e.ctrlKey || e.metaKey) return;
    if (!extractYouTubeVideoId(link.url)) return;
    e.preventDefault();
    handlers.onOpenYouTubePlayer(questionId, link);
  });
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

  const qTagIcon = /** @type {HTMLElement|null} */ (header.querySelector(".q-tag-icon"));
  if (qTagIcon) {
    const iconClass = pickDisplayTagIcon(q.tags ?? [], appState.globalTagMeta);
    qTagIcon.hidden = !iconClass;
    qTagIcon.className = iconClass ? `q-tag-icon ${iconClass}` : "q-tag-icon";
    qTagIcon.title = iconClass ? (q.tags ?? [])[0] : "";
  }

  applyOpenState(header, body, `Q::${q.id}`);

  for (const s of STATUS_ICONS) {
    const btn = header.querySelector(`.icon-${iconClassSuffix(s.flag)}`);
    if (btn) btn.classList.toggle("is-active", !!q[s.flag]);
  }

  for (const status of /** @type {const} */ (["done", "failed", "reviewLater"])) {
    const btn = header.querySelector(`.icon-${iconClassSuffix(status)}`);
    if (!btn) continue;
    const isActive = triStateActive(q, status);
    btn.classList.toggle("is-active", isActive);
    const count = triStateCount(q, status);
    const { label } = TRI_STATE_META[status];
    btn.setAttribute(
      "title",
      `${label}${count > 0 ? ` — marked ${count} time${count === 1 ? "" : "s"}` : ""}${q.srsDue ? ` — next review due ${q.srsDue}` : ""}`
    );
    const countBadge = btn.querySelector(".done-count-badge");
    if (countBadge) countBadge.textContent = count > 0 ? String(count) : "";
  }

  const historyPanel = body.querySelector(".history-dropdown-panel");
  if (historyPanel) {
    historyPanel.textContent = "";
    /** @type {Array<{ts: number, note?: string, status: "done"|"failed"|"reviewLater"}>} */
    const history = [];
    for (const status of /** @type {const} */ (["done", "failed", "reviewLater"])) {
      for (const entry of triStateHistory(q, status)) history.push({ ...entry, status });
    }
    history.sort((a, b) => a.ts - b.ts);
    if (history.length === 0) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = "No history yet.";
      historyPanel.appendChild(empty);
    } else {
      for (let i = history.length - 1; i >= 0; i--) {
        const entry = history[i];
        const row = document.createElement("div");
        row.className = `history-entry history-entry-${iconClassSuffix(entry.status)}`;
        row.textContent = `#${i + 1} — ${TRI_STATE_META[entry.status].label} — ${new Date(entry.ts).toLocaleString()}${entry.note ? ` — ${entry.note}` : ""}`;
        historyPanel.appendChild(row);
      }
    }
  }

  const tagChipsList = body.querySelector(".tag-chips-list");
  if (tagChipsList) {
    tagChipsList.textContent = "";
    const qTags = q.tags ?? [];
    if (appState.globalTags.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tag-chips-empty";
      empty.textContent = "No tags yet — create one below.";
      tagChipsList.appendChild(empty);
    }
    // Rename/delete aren't offered here — that's the Manage Tags popup's job (features/tagManager.js),
    // which acts on the tag everywhere at once rather than from inside one question's panel.
    for (const tag of appState.globalTags) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `tag-chip${qTags.includes(tag) ? " is-active" : ""}`;
      chip.textContent = tag;
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        handlers.onToggleQuestionTag(q.id, tag);
      });
      tagChipsList.appendChild(chip);
    }
  }

  const tagsBtn = body.querySelector(".icon-tags");
  if (tagsBtn) tagsBtn.classList.toggle("is-active", (q.tags ?? []).length > 0);

  const tagsDisplayRow = /** @type {HTMLElement|null} */ (body.querySelector(".question-tags-row"));
  if (tagsDisplayRow) {
    tagsDisplayRow.textContent = "";
    const qTags = q.tags ?? [];
    tagsDisplayRow.hidden = qTags.length === 0;
    for (const tag of qTags) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag-chip tag-chip-readonly";
      chip.title = `Add "${tag}" to the Tags filter`;
      chip.textContent = tag;
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        handlers.onFilterByTag(tag);
      });
      tagsDisplayRow.appendChild(chip);
    }
  }

  const linksBtn = body.querySelector(".icon-links");
  const qLinks = q.links ?? [];
  if (linksBtn) linksBtn.classList.toggle("is-active", qLinks.length > 0);

  const linksEditList = body.querySelector(".related-links-list");
  if (linksEditList) {
    linksEditList.textContent = "";
    if (qLinks.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tag-chips-empty";
      empty.textContent = "No links yet — add one below.";
      linksEditList.appendChild(empty);
    }
    for (const link of qLinks) {
      const row = document.createElement("div");
      row.className = "link-edit-row";
      row.dataset.linkId = link.id;
      const dragHandle = document.createElement("i");
      dragHandle.className = "fa-solid fa-grip-vertical drag-handle";
      const anchor = document.createElement("a");
      anchor.href = link.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.className = "link-edit-anchor";
      anchor.textContent = link.label || link.url;
      wireLinkAnchorClick(anchor, link, q.id, handlers);
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "tag-chip-action";
      editBtn.title = "Edit link";
      editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handlers.onEditQuestionLink(q.id, link.id, link.label, link.url);
      });
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "tag-chip-action";
      removeBtn.title = "Remove link";
      removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handlers.onRemoveQuestionLink(q.id, link.id, link.label);
      });
      row.appendChild(dragHandle);
      row.appendChild(anchor);
      row.appendChild(editBtn);
      row.appendChild(removeBtn);
      linksEditList.appendChild(row);
    }
  }

  const linksDisplayRow = /** @type {HTMLElement|null} */ (body.querySelector(".question-links-row"));
  if (linksDisplayRow) {
    linksDisplayRow.textContent = "";
    linksDisplayRow.hidden = qLinks.length === 0;
    for (const link of qLinks) {
      const anchor = document.createElement("a");
      anchor.href = link.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.className = "link-chip";
      anchor.title = link.url;
      anchor.appendChild(buildLinkChipIcon(link.url, (link.bookmarks?.length ?? 0) > 0));
      anchor.appendChild(document.createTextNode(` ${link.label || link.url}`));
      wireLinkAnchorClick(anchor, link, q.id, handlers);
      linksDisplayRow.appendChild(anchor);
    }
  }

  const notImportantBtn = body.querySelector(".icon-notimportant");
  if (notImportantBtn) notImportantBtn.classList.toggle("is-active", !!q.notImportant);
  el.classList.toggle("not-important", !!q.notImportant);

  const difficultyDot = header.querySelector(".difficulty-dot-btn");
  if (difficultyDot) {
    difficultyDot.className = `icon-btn difficulty-dot-btn${q.difficulty ? ` difficulty-${q.difficulty}` : ""}`;
    difficultyDot.setAttribute("title", difficultyTitle(q.difficulty));
  }

  const flagBtn = header.querySelector(".icon-flag");
  const isActive = appState.activeQuestion && appState.activeQuestion.questionId === q.id;
  if (flagBtn) flagBtn.classList.toggle("is-active", !!isActive);

  const selectBox = /** @type {HTMLInputElement} */ (header.querySelector(".question-select-checkbox"));
  if (selectBox) selectBox.checked = appState.selectedQuestionIds.has(q.id);

  const reorderEligible = isReorderTarget("question", { subject: q.subject, topic: q.topic, subTopic: q.subTopic });
  const reorderBadge = header.querySelector(".reorder-badge");
  if (reorderBadge) {
    const idx = reorderEligible ? appState.reorderMode?.selections.indexOf(q.id) ?? -1 : -1;
    reorderBadge.textContent = idx >= 0 ? String(idx + 1) : "";
    reorderBadge.classList.toggle("reorder-eligible", reorderEligible);
    reorderBadge.classList.toggle("reorder-picked", idx >= 0);
  }
  header.classList.toggle("reorder-mode-target", reorderEligible);

  const updatedAtLabel = typeof q.updatedAt === "number" ? formatRelativeTime(q.updatedAt) : "";
  const updatedAtHeader = /** @type {HTMLElement|null} */ (header.querySelector(".q-updated-header"));
  if (updatedAtHeader) {
    updatedAtHeader.hidden = !updatedAtLabel;
    const text = updatedAtHeader.querySelector(".q-updated-header-text");
    if (text) text.textContent = updatedAtLabel;
  }
  const updatedAtInline = /** @type {HTMLElement|null} */ (header.querySelector(".q-updated-inline"));
  if (updatedAtInline) {
    updatedAtInline.hidden = !updatedAtLabel;
    const text = updatedAtInline.querySelector(".q-updated-inline-text");
    if (text) text.textContent = updatedAtLabel;
  }

  const answerContent = body.querySelector(".answer-content");
  if (answerContent) {
    answerContent.innerHTML = q.answer || "<em>No answer yet.</em>";
    highlightCodeBlocks(answerContent);
  }

  const editBtn = body.querySelector(".answer-edit-row button");
  if (editBtn) editBtn.textContent = q.answer ? "Edit Answer" : "Add Answer";

  const subjectSearchItem = body.querySelector('.google-search-panel [data-mode="subject"]');
  if (subjectSearchItem) subjectSearchItem.textContent = `As ${q.subject}`;
  const topicSearchItem = body.querySelector('.google-search-panel [data-mode="topic"]');
  if (topicSearchItem) topicSearchItem.textContent = `As ${q.topic}`;
  const subTopicSearchItem = body.querySelector('.google-search-panel [data-mode="subTopic"]');
  if (subTopicSearchItem) subTopicSearchItem.textContent = `As ${q.subTopic}`;

  el.classList.toggle("no-answer", !q.answer);
  el.classList.toggle("with-attachement", qLinks.length > 0);
}
