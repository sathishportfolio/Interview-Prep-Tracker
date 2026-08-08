// @ts-check
/**
 * render/breadcrumb.js — header breadcrumb: shows whichever Subject/Topic/SubTopic chain is
 * currently open, or (if set) the Active Question's chain with a flag icon, which takes priority.
 */

let containerEl = null;
let onActiveQuestionClick = null;

/**
 * @param {HTMLElement} container
 * @param {() => void} clickHandler Called when the user clicks the active-question breadcrumb link.
 */
export function initBreadcrumb(container, clickHandler) {
  containerEl = container;
  onActiveQuestionClick = clickHandler;
}

/**
 * @param {{chainText: string|null, activeQuestionChainText: string|null, activeQuestionText: string|null}} data
 */
export function renderBreadcrumb({ chainText, activeQuestionChainText, activeQuestionText }) {
  if (!containerEl) return;
  containerEl.textContent = "";

  // Mode classes let CSS key off which content is showing (see style.css's mobile media query,
  // which hides the whole breadcrumb unless an Active Question link is present, and even then
  // hides the chain-text prefix — mobile only ever shows the flag link).
  containerEl.classList.toggle("bc-mode-active", !!activeQuestionChainText);
  containerEl.classList.toggle("bc-mode-chain", !activeQuestionChainText && !!chainText);

  if (activeQuestionChainText) {
    const span = document.createElement("span");
    span.className = "bc-chain-text";
    span.textContent = activeQuestionChainText;
    containerEl.appendChild(span);

    const link = document.createElement("a");
    link.href = "#";
    link.className = "bc-flag-link";
    link.innerHTML = `<i class="fa-solid fa-flag"></i> ${escapeHtml(activeQuestionText || "Active Question")}`;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      if (onActiveQuestionClick) onActiveQuestionClick();
    });
    containerEl.appendChild(link);
    return;
  }

  const span = document.createElement("span");
  span.className = "bc-chain-text";
  span.textContent = chainText || "";
  containerEl.appendChild(span);
}

/** @param {string} s */
function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
