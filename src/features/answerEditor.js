// @ts-check
/**
 * features/answerEditor.js — Edit / Add Answer. Always available regardless of Edit Mode. Opens a
 * modal with a textarea for the answer's HTML source (kept simple/dependency-free rather than a
 * full rich-text WYSIWYG, since feature.md only requires "HTML supported", not a specific editor).
 * Deliberately laid out as two quiet cards (Answer, Code Snippet) with slim icon toolbars rather
 * than labeled form sections — everything's still here, just not shouting for attention: tooltips
 * carry the explanation that used to be visible body text.
 *
 * Nothing here sanitizes automatically — what's saved is exactly what's in the textarea at Save
 * time. Every formatting toggle button (Clean formatting, Bulleted/Numbered list, Minify whitespace,
 * Plain HTML) lives right in the toolbar, after the Heading/Paragraph/Strong/Italic/Underline/Clear
 * selection buttons — and all of them follow the same rule: if there's a text selection when it's
 * applied, it only touches that selection; with nothing selected, it applies to the whole answer
 * (see wireToggle/wrapSelection/clearSelectionTags). Checking a toggle button applies it immediately;
 * unchecking restores the content from right before that transform was applied (a one-step undo, not
 * a full history) — see wireToggle. Reset restores the last-saved answer; Clear empties the editor
 * outright — see resetFieldsTo.
 *
 * Undo/Redo (Ctrl+Z / Ctrl+Y, or Cmd+Z / Cmd+Shift+Z on macOS) covers every one of the above as one
 * combined history — not just textarea typing — via a small snapshot-based history (see
 * makeEditorHistory) scoped to this modal only (wired/torn down via openModal's onClose).
 *
 * Two independent live previews (see buildLivePreview) render exactly what innerHTML would show —
 * the same rendering the real question body uses, syntax-highlighted the same way too (see
 * render/codeHighlight.js) — so what's previewed here is what you'll actually see after saving.
 *
 * The Code Snippet field is a second, separate textarea + language picker for raw code, never
 * touched by the answer body's formatting checkboxes (code routinely contains `<`/`>`/`&`, which
 * those transforms would mangle). Hidden behind its own "include a code snippet" checkbox — ticked
 * automatically when editing an answer that already has one (see splitTrailingCodeSnippet), off by
 * default otherwise, since most answers don't have code. It's escaped and appended as its own
 * `<pre><code class="language-xxx">` block to the end of the answer at Save time
 * (data/answerFormat.js's appendCodeSnippet) and, symmetrically, split back out of an existing
 * answer — code AND language both — into this same field when the editor reopens on it, so editing
 * a question with a code block never shows that code duplicated inside the main textarea too.
 */
import { updateQuestion } from "../data/mutations.js";
import {
  linesToList,
  minifyHtml,
  cleanFormatting,
  escapeHtml,
  appendCodeSnippet,
  splitTrailingCodeSnippet,
  CODE_LANGUAGES,
  CODE_LANGUAGE_LABELS,
  DEFAULT_CODE_LANGUAGE,
} from "../data/answerFormat.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { openModal } from "./modal.js";
import { showToast } from "./toast.js";
import { setActiveQuestionQuiet } from "./activeQuestion.js";
import { highlightCodeBlocks } from "../render/codeHighlight.js";

/**
 * Wires a toggle (checkbox or buildFormatToggleButton) to apply `transform` on check and restore the
 * exact pre-check value on uncheck. If there's a real selection in the textarea at the moment it's
 * checked, `transform` runs on just the selected text (same "selection if there is one, else the
 * whole thing" rule the H1-H5/Strong/etc. toolbar already follows) — otherwise it runs on the whole
 * value, same as before. Returns a `forceUncheck()` helper so a mutually-exclusive sibling control
 * (see the bulleted/numbered list pair, and Plain HTML below) can undo this one without the user
 * clicking it directly. Every value change fires a synthetic "input" event (plain `.value =`
 * assignment doesn't) so a live preview — and the undo/redo history, see makeEditorHistory —
 * listening on the textarea stays in sync with toggle-driven changes, not just typing.
 * @param {{checked: boolean, disabled: boolean, addEventListener: HTMLElement["addEventListener"], dispatchEvent: HTMLElement["dispatchEvent"]}} toggle
 * @param {HTMLTextAreaElement} textarea
 * @param {(value: string) => string} transform
 */
function wireToggle(toggle, textarea, transform) {
  let snapshot = /** @type {string|null} */ (null);
  const apply = (value) => {
    textarea.value = value;
    textarea.dispatchEvent(new Event("input"));
  };
  toggle.addEventListener("change", () => {
    if (toggle.checked) {
      snapshot = textarea.value;
      const { selectionStart, selectionEnd, value } = textarea;
      if (selectionStart !== selectionEnd) {
        const before = value.slice(0, selectionStart);
        const selected = value.slice(selectionStart, selectionEnd);
        const after = value.slice(selectionEnd);
        const transformed = transform(selected);
        apply(`${before}${transformed}${after}`);
        textarea.focus();
        textarea.setSelectionRange(before.length, before.length + transformed.length);
      } else {
        apply(transform(value));
      }
    } else if (snapshot !== null) {
      apply(snapshot);
      snapshot = null;
    }
  });
  return {
    forceUncheck() {
      if (!toggle.checked) return;
      toggle.checked = false;
      toggle.dispatchEvent(new Event("change", { bubbles: true }));
    },
  };
}

/**
 * Wraps the textarea's current selection in `openTag`/`closeTag` (or, with nothing selected, just
 * inserts the empty tag pair at the cursor, ready to type into) — used by the formatting toolbar so
 * those apply to a chosen phrase instead of the whole answer. Re-selects the wrapped text afterward
 * so a second click (e.g. Strong after Heading) can layer onto the same selection.
 * @param {HTMLTextAreaElement} textarea
 * @param {string} openTag
 * @param {string} closeTag
 */
function wrapSelection(textarea, openTag, closeTag) {
  const { selectionStart, selectionEnd, value } = textarea;
  const before = value.slice(0, selectionStart);
  const selected = value.slice(selectionStart, selectionEnd);
  const after = value.slice(selectionEnd);
  textarea.value = `${before}${openTag}${selected}${closeTag}${after}`;
  textarea.dispatchEvent(new Event("input"));
  textarea.focus();
  const newStart = selectionStart + openTag.length;
  textarea.setSelectionRange(newStart, newStart + selected.length);
}

/**
 * Strips every HTML tag out of just the textarea's current selection — plain text stays, markup
 * doesn't — the toolbar's "clear formatting on this bit only" counterpart to the Formatting
 * checkboxes' whole-body Clean Formatting (which unwraps rather than deletes tags, and can't be
 * scoped to a selection). A no-op when nothing's selected.
 * @param {HTMLTextAreaElement} textarea
 */
function clearSelectionTags(textarea) {
  const { selectionStart, selectionEnd, value } = textarea;
  const before = value.slice(0, selectionStart);
  const selected = value.slice(selectionStart, selectionEnd);
  const after = value.slice(selectionEnd);
  const stripped = selected.replace(/<[^>]+>/g, "");
  textarea.value = `${before}${stripped}${after}`;
  textarea.dispatchEvent(new Event("input"));
  textarea.focus();
  textarea.setSelectionRange(selectionStart, selectionStart + stripped.length);
}

/** @type {Array<{label: string, title: string, open: string, close: string, extraClass?: string}>} */
const TEXT_TOOLBAR_WRAP_BUTTONS = [
  { label: "P", title: "Paragraph", open: "<p>", close: "</p>" },
  { label: "B", title: "Strong / Bold", open: "<strong>", close: "</strong>", extraClass: "answer-toolbar-btn-strong" },
  { label: "I", title: "Italic", open: "<em>", close: "</em>", extraClass: "answer-toolbar-btn-italic" },
  { label: "U", title: "Underline", open: "<u>", close: "</u>", extraClass: "answer-toolbar-btn-underline" },
];

/**
 * H1-H5 collapsed into one button + dropdown menu (instead of 5 separate buttons cluttering the
 * toolbar) — picking a level wraps the current selection exactly like every other toolbar button
 * (see wrapSelection). Same open/close-on-outside-click dropdown pattern as the tree view's other
 * small menus (e.g. render/nodeViews/questionView.js's Google Search split button).
 * @param {HTMLTextAreaElement} textarea
 * @returns {HTMLElement}
 */
function buildHeadingDropdown(textarea) {
  const dropdownWrap = document.createElement("div");
  dropdownWrap.className = "done-dropdown-wrap answer-heading-dropdown-wrap";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-sm btn-outline-secondary answer-toolbar-btn answer-heading-dropdown-btn";
  btn.innerHTML = '<i class="fa-solid fa-heading"></i><i class="fa-solid fa-caret-down"></i>';
  btn.title = "Heading (H1-H5) — wraps the selected text (or inserts empty tags at the cursor if nothing's selected).";

  const panel = document.createElement("div");
  panel.className = "done-dropdown-panel answer-heading-dropdown-panel";
  panel.hidden = true;

  const closeMenu = () => {
    panel.hidden = true;
    document.removeEventListener("click", onDocClick);
  };
  const onDocClick = (e) => {
    if (!dropdownWrap.contains(/** @type {Node} */ (e.target))) closeMenu();
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = panel.hidden;
    if (opening) {
      panel.hidden = false;
      document.addEventListener("click", onDocClick);
    } else {
      closeMenu();
    }
  });

  for (let level = 1; level <= 5; level++) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "done-dropdown-item";
    item.textContent = `Heading ${level}`;
    item.style.fontSize = `${1.05 - level * 0.06}rem`;
    item.style.fontWeight = "700";
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      closeMenu();
      wrapSelection(textarea, `<h${level}>`, `</h${level}>`);
    });
    panel.appendChild(item);
  }

  dropdownWrap.append(btn, panel);
  return dropdownWrap;
}

/** @typedef {HTMLButtonElement & {checked: boolean}} ToggleButton A plain button with a shimmed `.checked` (see buildFormatToggleButton) — everything else is the native HTMLButtonElement interface. */

/**
 * A toolbar-styled toggle button standing in for what used to be a checkbox — mimics the exact
 * subset of the checkbox interface (.checked getter/setter, .disabled, "change" events) that
 * wireToggle/mutual-exclusion/Plain-HTML/undo-redo state all already use, so none of that logic
 * needed to change when these moved from labeled checkbox rows into toolbar icon buttons living
 * right alongside the H1-H5/Strong/etc. selection buttons.
 * @param {string} iconClass
 * @param {string} title
 * @returns {ToggleButton}
 */
function buildFormatToggleButton(iconClass, title) {
  const btn = /** @type {ToggleButton} */ (document.createElement("button"));
  btn.type = "button";
  btn.className = "btn btn-sm btn-outline-secondary answer-toolbar-btn answer-toolbar-btn-toggle";
  btn.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
  btn.title = title;
  let isChecked = false;
  Object.defineProperty(btn, "checked", {
    get: () => isChecked,
    set: (value) => {
      isChecked = !!value;
      btn.classList.toggle("is-active", isChecked);
    },
  });
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    btn.checked = !btn.checked;
    btn.dispatchEvent(new Event("change", { bubbles: true }));
  });
  return btn;
}

/**
 * The answer card's slim icon toolbar: Heading/Paragraph/Strong/Italic/Underline/Clear-selection on
 * the left (all scoped to the textarea's current selection — see wrapSelection/clearSelectionTags/
 * wireToggle), then the whole-answer Formatting toggle buttons (Clean/Bulleted/Numbered/Minify/
 * Plain — same selection-or-whole-answer rule, see wireToggle) right after them, then Preview/Reset/
 * Clear-answer on the far right. One row instead of several stacked labeled sections, so the editor
 * reads as a compact tool strip rather than a form.
 * @param {HTMLTextAreaElement} textarea
 * @param {HTMLElement[]} formatToggleButtons
 * @param {HTMLElement[]} rightActions
 * @returns {HTMLElement}
 */
function buildAnswerToolbar(textarea, formatToggleButtons, rightActions) {
  const row = document.createElement("div");
  row.className = "answer-toolbar";

  const left = document.createElement("div");
  left.className = "answer-toolbar-group";
  left.appendChild(buildHeadingDropdown(textarea));
  for (const { label, title, open, close, extraClass } of TEXT_TOOLBAR_WRAP_BUTTONS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn btn-sm btn-outline-secondary answer-toolbar-btn${extraClass ? ` ${extraClass}` : ""}`;
    btn.textContent = label;
    btn.title = `${title} — wraps the selected text (or inserts empty tags at the cursor if nothing's selected).`;
    btn.addEventListener("click", () => wrapSelection(textarea, open, close));
    left.appendChild(btn);
  }
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "btn btn-sm btn-outline-secondary answer-toolbar-btn answer-toolbar-btn-clear";
  clearBtn.innerHTML = '<i class="fa-solid fa-eraser"></i>';
  clearBtn.title = "Remove all HTML tags from the selected text, leaving plain text.";
  clearBtn.addEventListener("click", () => clearSelectionTags(textarea));
  left.appendChild(clearBtn);

  if (formatToggleButtons.length > 0) {
    const divider = document.createElement("span");
    divider.className = "answer-toolbar-divider";
    left.appendChild(divider);
    for (const btn of formatToggleButtons) left.appendChild(btn);
  }
  row.appendChild(left);

  const right = document.createElement("div");
  right.className = "answer-toolbar-group answer-toolbar-group-right";
  for (const el of rightActions) right.appendChild(el);
  row.appendChild(right);

  return row;
}

/**
 * A "Show/Hide Preview" toggle button + the preview pane it controls, rendering `renderFn(textarea
 * .value)` as HTML (matching how the real question body renders `answer`/code blocks via innerHTML,
 * including the same syntax highlighting — see highlightCodeBlocks). Only re-renders while actually
 * visible — toggling on refreshes immediately, and the textarea's own "input" listener (both real
 * typing and wireToggle's synthetic dispatch) keeps it live after that. `extraActions` (e.g. the
 * code preview's Copy button) render in their own row above the content, OUTSIDE the element that
 * gets overwritten by innerHTML on every refresh, so they survive re-renders.
 * @param {HTMLTextAreaElement} textarea
 * @param {(value: string) => string} renderFn
 * @param {Array<{html: string, title: string, onClick: () => void}>} [extraActions]
 * @returns {{toggleBtn: HTMLButtonElement, previewEl: HTMLElement, refresh: () => void}}
 */
function buildLivePreview(textarea, renderFn, extraActions = []) {
  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "btn btn-sm btn-outline-secondary answer-preview-toggle-btn";
  toggleBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
  toggleBtn.title = "Preview";

  const wrapper = document.createElement("div");
  wrapper.className = "answer-live-preview-wrap";
  wrapper.hidden = true;

  if (extraActions.length > 0) {
    const actionsRow = document.createElement("div");
    actionsRow.className = "answer-preview-actions-row";
    for (const action of extraActions) {
      const actionBtn = document.createElement("button");
      actionBtn.type = "button";
      actionBtn.className = "btn btn-sm btn-outline-secondary";
      actionBtn.innerHTML = action.html;
      actionBtn.title = action.title;
      actionBtn.addEventListener("click", action.onClick);
      actionsRow.appendChild(actionBtn);
    }
    wrapper.appendChild(actionsRow);
  }

  const contentEl = document.createElement("div");
  contentEl.className = "answer-live-preview";
  wrapper.appendChild(contentEl);

  const refresh = () => {
    contentEl.innerHTML = renderFn(textarea.value);
    highlightCodeBlocks(contentEl);
  };
  toggleBtn.addEventListener("click", () => {
    wrapper.hidden = !wrapper.hidden;
    toggleBtn.title = wrapper.hidden ? "Preview" : "Hide preview";
    toggleBtn.classList.toggle("is-active", !wrapper.hidden);
    if (!wrapper.hidden) refresh();
  });
  textarea.addEventListener("input", () => {
    if (!wrapper.hidden) refresh();
  });

  return { toggleBtn, previewEl: wrapper, refresh };
}

/**
 * Snapshot-based undo/redo for the whole editor, not just textarea typing — every checkbox,
 * language pick, and toolbar action is one history step too (see the `commit()` call sites in
 * openAnswerEditor). `getState`/`applyState` are the only two things that know the editor's actual
 * field shape; this function is otherwise generic. `applyState` runs with `suppressed` held so any
 * "change"/"input" listeners it triggers while restoring a snapshot don't themselves commit a new
 * (redundant, or worse, history-corrupting) step.
 * @param {() => any} getState
 * @param {(state: any) => void} applyState
 */
function makeEditorHistory(getState, applyState) {
  const MAX_ENTRIES = 100;
  /** @type {any[]} */
  let undoStack = [];
  /** @type {any[]} */
  let redoStack = [];
  let current = getState();
  let suppressed = false;

  function commit() {
    if (suppressed) return;
    const next = getState();
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    undoStack.push(current);
    if (undoStack.length > MAX_ENTRIES) undoStack.shift();
    current = next;
    redoStack = [];
  }

  function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(current);
    current = undoStack.pop();
    suppressed = true;
    applyState(current);
    suppressed = false;
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(current);
    current = redoStack.pop();
    suppressed = true;
    applyState(current);
    suppressed = false;
  }

  return { commit, undo, redo };
}

/** @param {string} questionId */
export function openAnswerEditor(questionId) {
  const q = appState.rawData.find((x) => x.id === questionId);
  if (!q) return;

  const wrap = document.createElement("div");
  wrap.className = "answer-editor-body";

  const questionText = document.createElement("div");
  questionText.className = "answer-editor-question";
  questionText.textContent = q.question;
  questionText.title = q.question;
  wrap.appendChild(questionText);

  // Split any existing trailing code block back out into its own field + language (see
  // splitTrailingCodeSnippet's doc comment) so both repopulate the Code Snippet field below, not
  // the main textarea too. Reset (below) restores these exact original values.
  const { body: initialBody, code: initialCode, language: initialLanguage } = splitTrailingCodeSnippet(q.answer || "");
  const initialCodeEnabled = !!initialCode.trim();

  // Undo/Redo needs a stable reference to call before all the fields it reads/writes exist yet (the
  // toolbar is built before the Code Snippet section) — assigned once everything's constructed,
  // below. Every call site just goes through this indirection instead of ordering constraints.
  let history = /** @type {{commit: () => void, undo: () => void, redo: () => void}|null} */ (null);
  const commit = () => history && history.commit();

  // --- Answer ---
  const answerCard = document.createElement("div");
  answerCard.className = "answer-editor-card";

  const textarea = document.createElement("textarea");
  textarea.className = "form-control answer-textarea";
  textarea.rows = 9;
  textarea.value = initialBody;

  const answerPreview = buildLivePreview(textarea, (v) => v);

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "btn btn-sm btn-outline-secondary answer-toolbar-btn-icon";
  resetBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
  resetBtn.title = "Reset — discard changes, restore the last-saved answer";

  const clearAnswerBtn = document.createElement("button");
  clearAnswerBtn.type = "button";
  clearAnswerBtn.className = "btn btn-sm btn-outline-secondary answer-toolbar-btn-icon answer-toolbar-btn-danger";
  clearAnswerBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
  clearAnswerBtn.title = "Clear this answer completely — nothing is saved until you click Save";

  // --- Formatting toggle buttons: every transform is opt-in and reversible (see wireToggle above),
  // and applies to just the current selection if there is one, the whole answer otherwise — same
  // rule the Heading/Paragraph/Strong/etc. selection buttons follow. ---
  const cleanBtn = buildFormatToggleButton("fa-broom", "Clean formatting — strip inline styles/classes/attributes/comments and unwrap any tag that isn't ul/li/b/strong/em/u/p/h1-h5.");
  const bulletBtn = buildFormatToggleButton("fa-list-ul", "Bulleted list — convert each line into its own <ul><li> bullet point.");
  const numberedBtn = buildFormatToggleButton("fa-list-ol", "Numbered list — convert each line into its own <ol><li> numbered point.");
  const minifyBtn = buildFormatToggleButton("fa-compress", "Minify whitespace — collapse extra whitespace/line breaks (code blocks are left untouched).");
  const plainBtn = buildFormatToggleButton("fa-code", "Plain HTML — store exactly what's typed here, verbatim; disables every other formatting toggle here.");

  answerCard.appendChild(buildAnswerToolbar(textarea, [cleanBtn, bulletBtn, numberedBtn, minifyBtn, plainBtn], [answerPreview.toggleBtn, resetBtn, clearAnswerBtn]));
  answerCard.appendChild(textarea);
  answerCard.appendChild(answerPreview.previewEl);

  const converterLink = document.createElement("a");
  converterLink.href = "https://text-html.com/";
  converterLink.target = "_blank";
  converterLink.rel = "noopener noreferrer";
  converterLink.className = "small answer-converter-link";
  converterLink.title = "Copies the answer, then opens text-html.com to convert pasted rich text into HTML.";
  converterLink.textContent = "Text to HTML ↗";
  converterLink.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(textarea.value);
      showToast("Answer copied — paste it into Text to HTML.", "success");
    } catch {
      // clipboard write failed (permissions/unsupported) — still open the site, user can copy manually
    }
    window.open(converterLink.href, "_blank", "noopener,noreferrer");
  });
  answerCard.appendChild(converterLink);

  // Copy the existing answer to the clipboard as soon as the editor opens so it's always one paste
  // away (e.g. into an external editor) without an extra manual copy step, for both "Edit Answer"
  // (existing answer) and "Add Answer" (empty, but harmless to copy) alike.
  if (q.answer) {
    navigator.clipboard.writeText(q.answer).catch(() => {
      // clipboard write failed (permissions/unsupported) — non-fatal, editor still opens normally
    });
  }

  const cleanToggle = wireToggle(cleanBtn, textarea, cleanFormatting);
  const minifyToggle = wireToggle(minifyBtn, textarea, minifyHtml);
  const bulletToggle = wireToggle(bulletBtn, textarea, (v) => linesToList(v, false));
  const numberedToggle = wireToggle(numberedBtn, textarea, (v) => linesToList(v, true));
  const allFormatToggleButtons = [cleanBtn, bulletBtn, numberedBtn, minifyBtn, plainBtn];

  // Bulleted/Numbered are mutually exclusive — checking one undoes the other first, rather than
  // nesting a <ul> transform on top of an already-applied <ol> (or vice versa).
  bulletBtn.addEventListener("change", () => {
    if (bulletBtn.checked) numberedToggle.forceUncheck();
  });
  numberedBtn.addEventListener("change", () => {
    if (numberedBtn.checked) bulletToggle.forceUncheck();
  });

  // Plain HTML passthrough undoes + disables every other option — they'd otherwise imply a cleanup
  // pass the user just said NOT to run.
  const toggleableFormatButtons = [cleanBtn, bulletBtn, numberedBtn, minifyBtn];
  plainBtn.addEventListener("change", () => {
    const disabled = plainBtn.checked;
    if (disabled) {
      cleanToggle.forceUncheck();
      bulletToggle.forceUncheck();
      numberedToggle.forceUncheck();
      minifyToggle.forceUncheck();
    }
    for (const cb of toggleableFormatButtons) cb.disabled = disabled;
  });

  // Every formatting-toggle change is its own undo step — delegated once here (bubble phase, after
  // wireToggle/mutual-exclusion listeners above have already settled the DOM) rather than one
  // listener per button. Only the format toggle buttons in this card dispatch "change" at all (the
  // Heading/Paragraph/etc. selection buttons are plain one-shot clicks), so nothing else needs
  // filtering out here.
  answerCard.addEventListener("change", commit);

  wrap.appendChild(answerCard);

  // --- Code Snippet (separate field, appended to the answer's end at Save — see module doc comment).
  // Hidden behind its own checkbox: off by default for a fresh/plain answer, pre-ticked (and
  // expanded) when editing an answer that already has a trailing code block. ---
  const codeCard = document.createElement("div");
  codeCard.className = "answer-editor-card";

  const codeEnableRow = document.createElement("div");
  codeEnableRow.className = "form-check answer-option-check answer-code-enable-row";
  const codeEnableCheckbox = document.createElement("input");
  codeEnableCheckbox.type = "checkbox";
  codeEnableCheckbox.className = "form-check-input";
  codeEnableCheckbox.id = "answerCodeEnable";
  codeEnableCheckbox.checked = initialCodeEnabled;
  const codeEnableLabel = document.createElement("label");
  codeEnableLabel.className = "form-check-label";
  codeEnableLabel.setAttribute("for", "answerCodeEnable");
  codeEnableLabel.textContent = "Code snippet";
  codeEnableLabel.title = "Adds a separate code field, appended to the end of the answer above when saved.";
  codeEnableRow.append(codeEnableCheckbox, codeEnableLabel);
  codeCard.appendChild(codeEnableRow);

  const codeContentWrap = document.createElement("div");
  codeContentWrap.className = "answer-code-content-wrap";
  codeContentWrap.hidden = !initialCodeEnabled;
  codeCard.appendChild(codeContentWrap);

  const codeTextarea = document.createElement("textarea");
  codeTextarea.className = "form-control answer-code-textarea";
  codeTextarea.rows = 6;
  codeTextarea.placeholder = "Paste raw code here — kept verbatim, never run through the Answer formatting options.";
  codeTextarea.value = initialCode;

  const languageSelect = document.createElement("select");
  languageSelect.className = "form-select form-select-sm answer-code-language-select";
  languageSelect.title = "Language";
  for (const lang of CODE_LANGUAGES) {
    const opt = document.createElement("option");
    opt.value = lang;
    opt.textContent = CODE_LANGUAGE_LABELS[lang];
    languageSelect.appendChild(opt);
  }
  languageSelect.value = initialLanguage;

  const copyCodeAction = {
    html: '<i class="fa-solid fa-copy"></i>',
    title: "Copy this code snippet to the clipboard",
    onClick: async () => {
      try {
        await navigator.clipboard.writeText(codeTextarea.value);
        showToast("Code snippet copied to clipboard.", "success");
      } catch {
        showToast("Could not copy to clipboard.", "error");
      }
    },
  };
  const codePreview = buildLivePreview(codeTextarea, (v) => (v.trim() ? `<pre><code class="language-${languageSelect.value}">${escapeHtml(v)}</code></pre>` : ""), [copyCodeAction]);

  const codeToolbar = document.createElement("div");
  codeToolbar.className = "answer-toolbar answer-code-toolbar";
  const codeToolbarLeft = document.createElement("div");
  codeToolbarLeft.className = "answer-toolbar-group";
  codeToolbarLeft.appendChild(languageSelect);
  const codeToolbarRight = document.createElement("div");
  codeToolbarRight.className = "answer-toolbar-group answer-toolbar-group-right";
  codeToolbarRight.appendChild(codePreview.toggleBtn);
  codeToolbar.append(codeToolbarLeft, codeToolbarRight);

  codeContentWrap.appendChild(codeToolbar);
  codeContentWrap.appendChild(codeTextarea);
  codeContentWrap.appendChild(codePreview.previewEl);

  languageSelect.addEventListener("change", () => {
    codePreview.refresh();
    commit();
  });
  codeEnableCheckbox.addEventListener("change", () => {
    codeContentWrap.hidden = !codeEnableCheckbox.checked;
    if (codeEnableCheckbox.checked) codeTextarea.focus();
    commit();
  });

  wrap.appendChild(codeCard);

  // Shared by Reset and Clear below — directly un-checking each toggle (rather than calling
  // forceUncheck, which would re-apply that toggle's OWN undo-transform on top of the content
  // being reset TO) avoids the two working against each other.
  const resetFieldsTo = (body, code, language, codeEnabled) => {
    for (const cb of allFormatToggleButtons) {
      cb.checked = false;
      cb.disabled = false;
    }
    textarea.value = body;
    textarea.dispatchEvent(new Event("input"));
    codeTextarea.value = code;
    codeTextarea.dispatchEvent(new Event("input"));
    languageSelect.value = language;
    codeEnableCheckbox.checked = codeEnabled;
    codeContentWrap.hidden = !codeEnabled;
    codePreview.refresh();
  };

  // Reset — discards every change made in this editor session (typed text, checkbox transforms,
  // code snippet, language) and restores exactly what was open when the editor was opened.
  resetBtn.addEventListener("click", () => {
    if (!window.confirm("Reset to the last saved answer? Any unsaved changes here will be lost.")) return;
    resetFieldsTo(initialBody, initialCode, initialLanguage, initialCodeEnabled);
    commit();
    showToast("Answer editor reset to the last saved version.", "info");
  });

  // Clear — empties the answer entirely (unlike Reset, doesn't restore the last-saved answer, just
  // wipes it) so a question can be blanked out and re-written from scratch. Nothing is persisted
  // until Save is clicked, same as every other edit in this popup.
  clearAnswerBtn.addEventListener("click", () => {
    if (!window.confirm("Clear this answer completely? This empties the answer text and code snippet in the editor — nothing is saved until you click Save.")) return;
    resetFieldsTo("", "", DEFAULT_CODE_LANGUAGE, false);
    commit();
    showToast("Answer cleared — click Save to make it permanent.", "info");
  });

  // --- Undo/Redo history: one combined timeline across every field above, not just typing. ---
  const getState = () => ({
    body: textarea.value,
    code: codeTextarea.value,
    language: languageSelect.value,
    codeEnabled: codeEnableCheckbox.checked,
    clean: cleanBtn.checked,
    bullet: bulletBtn.checked,
    numbered: numberedBtn.checked,
    minify: minifyBtn.checked,
    plain: plainBtn.checked,
  });
  /** @param {ReturnType<typeof getState>} state */
  const applyState = (state) => {
    textarea.value = state.body;
    codeTextarea.value = state.code;
    languageSelect.value = state.language;
    codeEnableCheckbox.checked = state.codeEnabled;
    codeContentWrap.hidden = !state.codeEnabled;
    cleanBtn.checked = state.clean;
    bulletBtn.checked = state.bullet;
    numberedBtn.checked = state.numbered;
    minifyBtn.checked = state.minify;
    plainBtn.checked = state.plain;
    for (const cb of toggleableFormatButtons) cb.disabled = state.plain;
    if (!answerPreview.previewEl.hidden) answerPreview.refresh();
    codePreview.refresh();
  };
  history = makeEditorHistory(getState, applyState);

  // Typing commits on a short pause (so a burst of keystrokes is one undo step, not one per
  // character) — every other change above (checkboxes, toolbar actions, language, Reset/Clear)
  // commits immediately at its own call site. A commit that finds no actual state change (e.g. this
  // debounce firing after an already-committed toolbar action) is a no-op — see makeEditorHistory.
  let typingDebounce = /** @type {ReturnType<typeof setTimeout>|null} */ (null);
  const scheduleCommit = () => {
    if (typingDebounce) clearTimeout(typingDebounce);
    typingDebounce = setTimeout(commit, 500);
  };
  textarea.addEventListener("input", scheduleCommit);
  codeTextarea.addEventListener("input", scheduleCommit);

  /** @param {KeyboardEvent} e */
  const handleUndoRedoKeydown = (e) => {
    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (key === "z" && !e.shiftKey) {
      e.preventDefault();
      if (typingDebounce) {
        clearTimeout(typingDebounce);
        typingDebounce = null;
        commit();
      }
      /** @type {NonNullable<typeof history>} */ (history).undo();
    } else if (key === "y" || (key === "z" && e.shiftKey)) {
      e.preventDefault();
      /** @type {NonNullable<typeof history>} */ (history).redo();
    }
  };
  document.addEventListener("keydown", handleUndoRedoKeydown);

  openModal({
    title: q.answer ? "Edit Answer" : "Add Answer",
    bodyEl: wrap,
    saveLabel: "Save",
    onSave: () => {
      const code = codeEnableCheckbox.checked ? codeTextarea.value : "";
      const answer = appendCodeSnippet(textarea.value, code, languageSelect.value);
      const rawData = updateQuestion(appState.rawData, questionId, { answer });
      setActiveQuestionQuiet(questionId);
      applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
    },
    onClose: () => {
      if (typingDebounce) clearTimeout(typingDebounce);
      document.removeEventListener("keydown", handleUndoRedoKeydown);
    },
  });
}
