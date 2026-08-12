// @ts-check
/**
 * features/answerEditor.js — Edit / Add Answer. Always available regardless of Edit Mode. Opens a
 * modal with a textarea for the answer's HTML source (kept simple/dependency-free rather than a
 * full rich-text WYSIWYG, since feature.md only requires "HTML supported", not a specific editor).
 */
import { updateQuestion } from "../data/mutations.js";
import { cleanAnswerHtml } from "../data/answerFormat.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { openModal } from "./modal.js";
import { showToast } from "./toast.js";
import { setActiveQuestionQuiet } from "./activeQuestion.js";

/** @param {string} questionId */
export function openAnswerEditor(questionId) {
  const q = appState.rawData.find((x) => x.id === questionId);
  if (!q) return;

  const wrap = document.createElement("div");
  const questionText = document.createElement("div");
  questionText.className = "modal-question-text";
  questionText.textContent = q.question;
  wrap.appendChild(questionText);

  const label = document.createElement("label");
  label.className = "form-label small text-muted";
  label.textContent = "Answer (HTML supported)";
  // text-html.com has no documented way to pre-fill its editor via URL/query param (plain
  // textarea + POST form, no public API) — so instead of a bare link, copy the current answer
  // text to the clipboard first so the user only has to paste once on the destination site.
  const converterLink = document.createElement("a");
  converterLink.href = "https://text-html.com/";
  converterLink.target = "_blank";
  converterLink.rel = "noopener noreferrer";
  converterLink.className = "small";
  converterLink.style.marginLeft = "0.5rem";
  converterLink.textContent = "Text to HTML ↗ (copies answer first)";
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
  label.appendChild(converterLink);
  const textarea = document.createElement("textarea");
  textarea.className = "form-control";
  textarea.rows = 10;
  textarea.value = q.answer || "";
  wrap.appendChild(label);
  wrap.appendChild(textarea);

  openModal({
    title: q.answer ? "Edit Answer" : "Add Answer",
    bodyEl: wrap,
    saveLabel: "Save",
    onSave: () => {
      const answer = cleanAnswerHtml(textarea.value);
      const rawData = updateQuestion(appState.rawData, questionId, { answer });
      setActiveQuestionQuiet(questionId);
      applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
    },
  });
}
