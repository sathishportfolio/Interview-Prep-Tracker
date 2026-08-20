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

/**
 * @typedef {Object} TreeHandlers
 * @property {(qid: string, flag: "done"|"reviewLater"|"duplicate"|"notImportant"|"starred"|"failed"|"visited") => void} onToggleStatus
 * @property {(qid: string, withNotes: boolean) => void} onMarkDone
 * @property {(qid: string) => void} onResetDone
 * @property {(qid: string, tag: string) => void} onToggleQuestionTag
 * @property {(qid: string, tag: string) => void} onCreateTag
 * @property {(tag: string) => void} onFilterByTag
 * @property {(qid: string) => void} onCycleDifficulty
 * @property {(qid: string) => void} onEditAnswer
 * @property {(qid: string) => void} onEditQuestionText
 * @property {(qid: string) => void} onOpenMoveForm
 * @property {(qid: string) => void} onDeleteQuestion
 * @property {(qid: string) => void} onCopyQuestion
 * @property {(qid: string) => void} onCopyAndSearch
 * @property {(qid: string, mode?: "codeExample"|"plain"|"subject"|"topic"|"subTopic") => void} onGoogleSearch
 * @property {(qid: string, dir: "up"|"down"|"top"|"bottom") => void} onMoveQuestionOrder
 * @property {(qid: string) => void} onToggleActiveQuestion
 * @property {(qid: string) => void} onToggleQuestionOpen
 * @property {(qid: string) => void} onToggleSelectQuestion
 * @property {(level: "subject"|"topic"|"subTopic"|"question", scope: any) => void} onReorderSelect
 * @property {(subject: string, topic: string, subTopic: string, level: "subject"|"topic"|"subTopic", name: string) => void} onCopyMenu
 * @property {(level: "subject"|"topic"|"subTopic", scope: any) => void} onRenameGroup
 * @property {(level: "subject"|"topic"|"subTopic", scope: any) => void} onDeleteGroup
 * @property {(level: "subject"|"topic"|"subTopic", scope: any) => void} onToggleGroupNotImportant
 */

// "notImportant" is deliberately not in this list — its icon lives next to the Google Search
// button in answerEditRow instead (see below), not in the header's status-icon-row. "done" is
// ALSO excluded — it gets its own special dropdown-menu treatment (see doneWrap below) instead of
// the plain toggle button every other entry here gets. "duplicate" has no accordion icon at all
// (removed per user request) — the field/filter/CSV/stats support for it stays untouched elsewhere.
const STATUS_ICONS = [
  { flag: "failed", icon: "fa-circle-xmark", title: "Failed" },
  { flag: "reviewLater", icon: "fa-clock", title: "Review Later" },
  { flag: "starred", icon: "fa-star", title: "Starred" },
  { flag: "visited", icon: "fa-eye", title: "Visited" },
];

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

  const statusRow = document.createElement("div");
  statusRow.className = "status-icon-row";

  // Done: on a desktop/mouse (hover-capable) device, a direct click marks done immediately (no
  // notes) — see features/statusFlags.js's markDoneWithMenu(qid, false) — and hovering the button
  // reveals a "Mark with Notes" option (CSS-only) for the with-notes variant. On a touch device
  // (no hover), there's no way to reveal that hover option, so a tap instead opens a small 2-item
  // menu ("Mark as Done" / "Mark as Done with Notes") the same way the pre-hover-redesign UI did.
  // Ctrl/Cmd+click (desktop) or long-press (touch, mirroring the qText long-press pattern above)
  // resets the counter/history either way.
  const isCoarsePointer = () => window.matchMedia("(hover: none)").matches;
  const doneWrap = document.createElement("div");
  doneWrap.className = "done-dropdown-wrap";
  const doneBtn = document.createElement("button");
  doneBtn.type = "button";
  doneBtn.className = "icon-btn icon-done";
  doneBtn.title = "Done (click to mark; hover for notes option; Ctrl/Cmd+click or long-press to reset)";
  doneBtn.innerHTML = '<i class="fa-solid fa-square-check"></i><span class="done-count-badge"></span>';
  const doneNotesPanel = document.createElement("div");
  const touchMode = isCoarsePointer();
  doneNotesPanel.className = touchMode ? "done-notes-panel done-notes-panel-touch" : "done-notes-panel";
  const closeDoneMenu = () => {
    doneNotesPanel.hidden = true;
    document.removeEventListener("click", onDoneMenuDocClick);
  };
  const onDoneMenuDocClick = (e) => {
    if (!doneWrap.contains(/** @type {Node} */ (e.target))) closeDoneMenu();
  };
  if (touchMode) {
    doneNotesPanel.hidden = true;
    for (const { withNotes, label } of [
      { withNotes: false, label: "Mark as Done" },
      { withNotes: true, label: "Mark as Done with Notes" },
    ]) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "done-dropdown-item";
      item.textContent = label;
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        closeDoneMenu();
        handlers.onMarkDone(q.id, withNotes);
      });
      doneNotesPanel.appendChild(item);
    }
  } else {
    const doneNotesItem = document.createElement("button");
    doneNotesItem.type = "button";
    doneNotesItem.className = "done-dropdown-item";
    doneNotesItem.textContent = "Mark with Notes";
    doneNotesItem.addEventListener("click", (e) => {
      e.stopPropagation();
      handlers.onMarkDone(q.id, true);
    });
    doneNotesPanel.appendChild(doneNotesItem);
  }
  let doneLongPressTimer = /** @type {ReturnType<typeof setTimeout>|null} */ (null);
  let doneLongPressFired = false;
  doneBtn.addEventListener(
    "touchstart",
    () => {
      doneLongPressFired = false;
      doneLongPressTimer = setTimeout(() => {
        doneLongPressFired = true;
        handlers.onResetDone(q.id);
      }, 500);
    },
    { passive: true }
  );
  doneBtn.addEventListener("touchend", () => {
    if (doneLongPressTimer) clearTimeout(doneLongPressTimer);
  });
  doneBtn.addEventListener(
    "touchmove",
    () => {
      if (doneLongPressTimer) clearTimeout(doneLongPressTimer);
    },
    { passive: true }
  );
  doneBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (doneLongPressFired) {
      doneLongPressFired = false;
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      handlers.onResetDone(q.id);
      return;
    }
    if (touchMode) {
      const opening = doneNotesPanel.hidden;
      doneNotesPanel.hidden = !opening;
      if (opening) document.addEventListener("click", onDoneMenuDocClick);
      else document.removeEventListener("click", onDoneMenuDocClick);
      return;
    }
    handlers.onMarkDone(q.id, false);
  });
  doneWrap.appendChild(doneBtn);
  doneWrap.appendChild(doneNotesPanel);

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

  const reorderBadge = document.createElement("span");
  reorderBadge.className = "reorder-badge";

  // Header actions collapse behind a single "more" button on narrow/mobile screens (see
  // .header-more-btn / .header-actions-wrap in style.css) so the question text keeps most of the
  // row's width instead of being squeezed by 6+ inline icon buttons. On desktop this wrapper is
  // `display: contents`, so difficultyDot/statusRow/flagBtn lay out exactly as if unwrapped.
  const headerActionsWrap = document.createElement("div");
  headerActionsWrap.className = "header-actions-wrap";
  headerActionsWrap.appendChild(difficultyDot);
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
  };
  const onHeaderActionsDocClick = (e) => {
    if (!headerActionsWrap.contains(/** @type {Node} */ (e.target)) && e.target !== headerMoreBtn) closeHeaderActions();
  };
  headerMoreBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = !headerActionsWrap.classList.contains("open");
    headerActionsWrap.classList.toggle("open", opening);
    if (opening) document.addEventListener("click", onHeaderActionsDocClick);
    else document.removeEventListener("click", onHeaderActionsDocClick);
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
  header.appendChild(qText);
  header.appendChild(updatedAtHeader);
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
  };
  const onGoogleSearchDocClick = (e) => {
    if (!googleSearchWrap.contains(/** @type {Node} */ (e.target))) closeGoogleSearchMenu();
  };
  googleSearchCaret.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = googleSearchPanel.hidden;
    googleSearchPanel.hidden = !opening;
    if (opening) document.addEventListener("click", onGoogleSearchDocClick);
    else document.removeEventListener("click", onGoogleSearchDocClick);
  });
  for (const [mode, label] of [
    ["plain", "Plain Question"],
    ["codeExample", "Ask for Code Example"],
    ["subject", `As ${q.subject}`],
    ["topic", `As ${q.topic}`],
    ["subTopic", `As ${q.subTopic}`],
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

  // Done History viewer — timeline of every Mark Done/Mark Done with Notes click (see
  // features/statusFlags.js's markDoneWithMenu). Content is rebuilt from q.doneHistory on every
  // patchQuestionNode call, not just at creation. Always-visible icon; the panel itself opens on
  // hover (CSS-only, see .history-dropdown-wrap:hover .history-dropdown-panel) rather than click.
  const historyWrap = document.createElement("div");
  historyWrap.className = "history-dropdown-wrap";
  const historyBtn = document.createElement("button");
  historyBtn.type = "button";
  historyBtn.className = "btn btn-sm btn-outline-secondary icon-history";
  historyBtn.title = "Done History";
  historyBtn.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i>';
  historyBtn.addEventListener("click", (e) => e.stopPropagation());
  const historyPanel = document.createElement("div");
  historyPanel.className = "history-dropdown-panel";
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
  };
  tagsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = tagsPanel.hidden;
    tagsPanel.hidden = !opening;
    if (opening) document.addEventListener("click", onTagsDocClick);
    else document.removeEventListener("click", onTagsDocClick);
  });
  tagsWrap.appendChild(tagsBtn);
  tagsWrap.appendChild(tagsPanel);

  const tagsDisplayRow = document.createElement("div");
  tagsDisplayRow.className = "question-tags-row";

  answerEditRow.appendChild(copyBtn);
  answerEditRow.appendChild(copySearchBtn);
  answerEditRow.appendChild(googleSearchWrap);
  answerEditRow.appendChild(notImportantBtn);
  answerEditRow.appendChild(historyWrap);
  answerEditRow.appendChild(tagsWrap);

  const statusControls = document.createElement("div");
  statusControls.className = "status-controls edit-gated";

  const editTextBtn = mkBtn("fa-pen-to-square", "Edit question text", () => handlers.onEditQuestionText(q.id));
  const moveBtn = mkBtn("fa-arrows-turn-right icon-move", "Move to different Subject/Topic/SubTopic", () => handlers.onOpenMoveForm(q.id));
  const upBtn = mkBtn("fa-arrow-up", "Move up", () => handlers.onMoveQuestionOrder(q.id, "up"));
  const downBtn = mkBtn("fa-arrow-down", "Move down", () => handlers.onMoveQuestionOrder(q.id, "down"));
  const topBtn = mkBtn("fa-angles-up", "Move to top", () => handlers.onMoveQuestionOrder(q.id, "top"));
  const bottomBtn = mkBtn("fa-angles-down", "Move to bottom", () => handlers.onMoveQuestionOrder(q.id, "bottom"));
  const deleteBtn = mkBtn("fa-trash icon-duplicate", "Delete question", () => handlers.onDeleteQuestion(q.id));
  [editTextBtn, moveBtn, upBtn, downBtn, topBtn, bottomBtn, deleteBtn].forEach((b) => statusControls.appendChild(b));

  // statusControls nests INSIDE answerEditRow (not a separate body child) so both button groups
  // share one row — edit-gated hiding still applies to just the statusControls buttons.
  answerEditRow.appendChild(statusControls);

  // Last-updated timestamp — always-visible small muted line (clock icon + compact age) in the
  // answer body, both mobile and desktop (see style.css's .q-updated-body). Desktop ALSO gets a
  // light-grey copy directly in the header, right before the Done icon (see updatedAtHeader above /
  // .q-updated-header in style.css).
  const updatedAtBody = document.createElement("div");
  updatedAtBody.className = "q-updated-body text-muted small";
  updatedAtBody.innerHTML = '<i class="fa-solid fa-clock"></i><span class="q-updated-body-text"></span>';

  body.appendChild(answerContent);
  body.appendChild(updatedAtBody);
  body.appendChild(tagsDisplayRow);
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
    const btn = header.querySelector(`.icon-${iconClassSuffix(s.flag)}`);
    if (btn) btn.classList.toggle("is-active", !!q[s.flag]);
  }

  const doneBtn = header.querySelector(".icon-done");
  if (doneBtn) {
    doneBtn.classList.toggle("is-active", !!q.done);
    const doneCount = q.doneCount ?? 0;
    doneBtn.setAttribute(
      "title",
      `Done${doneCount > 0 ? ` — marked ${doneCount} time${doneCount === 1 ? "" : "s"}` : ""}${q.srsDue ? ` — next review due ${q.srsDue}` : ""}`
    );
    const doneCountBadge = doneBtn.querySelector(".done-count-badge");
    if (doneCountBadge) doneCountBadge.textContent = doneCount > 0 ? String(doneCount) : "";
  }

  const historyPanel = body.querySelector(".history-dropdown-panel");
  if (historyPanel) {
    historyPanel.textContent = "";
    const history = q.doneHistory ?? [];
    if (history.length === 0) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = "No history yet.";
      historyPanel.appendChild(empty);
    } else {
      for (let i = history.length - 1; i >= 0; i--) {
        const entry = history[i];
        const row = document.createElement("div");
        row.className = "history-entry";
        row.textContent = `#${i + 1} — ${new Date(entry.ts).toLocaleString()}${entry.note ? ` — ${entry.note}` : ""}`;
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
  const updatedAtBody = /** @type {HTMLElement|null} */ (body.querySelector(".q-updated-body"));
  if (updatedAtBody) {
    updatedAtBody.hidden = !updatedAtLabel;
    const text = updatedAtBody.querySelector(".q-updated-body-text");
    if (text) text.textContent = updatedAtLabel;
  }

  const answerContent = body.querySelector(".answer-content");
  if (answerContent) answerContent.innerHTML = q.answer || "<em>No answer yet.</em>";

  const editBtn = body.querySelector(".answer-edit-row button");
  if (editBtn) editBtn.textContent = q.answer ? "Edit Answer" : "Add Answer";

  const subjectSearchItem = body.querySelector('.google-search-panel [data-mode="subject"]');
  if (subjectSearchItem) subjectSearchItem.textContent = `As ${q.subject}`;
  const topicSearchItem = body.querySelector('.google-search-panel [data-mode="topic"]');
  if (topicSearchItem) topicSearchItem.textContent = `As ${q.topic}`;
  const subTopicSearchItem = body.querySelector('.google-search-panel [data-mode="subTopic"]');
  if (subTopicSearchItem) subTopicSearchItem.textContent = `As ${q.subTopic}`;

  el.classList.toggle("no-answer", !q.answer);
}
