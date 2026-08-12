// @ts-check
/**
 * features/closeAll.js — Close All Accordions floating button, plus an Escape-key shortcut that
 * does the same thing whenever any accordion is open (backs off while typing, same as
 * features/reviewShortcuts.js, so Escape in a text field/textarea keeps its normal behavior).
 */
import { appState, closeAllNodes } from "../state/appState.js";
import { repaint } from "./refresh.js";

export function closeAllAccordions() {
  closeAllNodes();
  repaint();
}

/** @param {EventTarget|null} target */
function isTypingTarget(target) {
  const el = /** @type {HTMLElement|null} */ (target);
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function initCloseAllShortcut() {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (isTypingTarget(e.target)) return;
    if (appState.openNodeKeys.size === 0) return;
    closeAllAccordions();
  });
}
