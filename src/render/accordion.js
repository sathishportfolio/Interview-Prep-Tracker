// @ts-check
/**
 * render/accordion.js — custom accordion component, fully driven by appState.openNodeKeys (never
 * Bootstrap's data-api collapse — see README-AI gotcha #2). Node-view create/patch functions call
 * these helpers to build a header+body pair and keep its expanded/collapsed rendering in sync with
 * app state.
 */
import { appState, isNodeOpen, toggleNodeOpen } from "../state/appState.js";

/**
 * Builds a header/body accordion shell. Caller fills in header content and body content.
 * @param {string} key Unique node key (e.g. "S::Subject", "Q::qid").
 * @param {string} levelClass e.g. "level-subject", "level-topic".
 * @param {() => void} [onToggle] Optional extra callback after this node's own open/close toggles
 *   (e.g. auto-expanding its first child — see features/autoExpand.js).
 * @returns {{item: HTMLElement, header: HTMLElement, headerControls: HTMLElement, body: HTMLElement, caret: HTMLElement, titleEl: HTMLElement}}
 */
export function createAccordionShell(key, levelClass, onToggle) {
  const item = document.createElement("div");
  item.className = `acc-item ${levelClass}`;

  const header = document.createElement("div");
  header.className = "acc-header";
  header.setAttribute("role", "button");
  header.setAttribute("tabindex", "0");

  const caret = document.createElement("i");
  caret.className = "fa-solid fa-chevron-right acc-caret";

  const titleEl = document.createElement("span");
  titleEl.className = "acc-title";

  const headerControls = document.createElement("div");
  headerControls.className = "acc-header-controls";

  header.appendChild(caret);
  header.appendChild(titleEl);
  header.appendChild(headerControls);

  const body = document.createElement("div");
  body.className = "acc-body";

  item.appendChild(header);
  item.appendChild(body);

  bindHeader(header, key, onToggle);
  applyOpenState(header, body, key);

  return { item, header, headerControls, body, caret, titleEl };
}

/**
 * Wires a header's click/keyboard toggle. Any nested clickable control INSIDE the header (icon
 * buttons, etc.) must call `e.stopPropagation()` in its own listener — that alone is sufficient
 * here since this is a plain bubble-phase listener, not Bootstrap's capture-phase data-api one.
 * @param {HTMLElement} header
 * @param {string} key
 * @param {() => void} [onToggle] Optional extra callback after toggling (e.g. to trigger a patch).
 */
export function bindHeader(header, key, onToggle) {
  const handler = (e) => {
    toggleNodeOpen(key);
    const body = /** @type {HTMLElement|null} */ (header.nextElementSibling);
    if (body) applyOpenState(header, body, key);
    if (onToggle) onToggle();
  };
  header.addEventListener("click", handler);
  header.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handler(e);
    }
  });
}

/**
 * Syncs header/body DOM classes to appState.openNodeKeys for a given key (call after any external
 * state change too, e.g. Close All / Jump to Question).
 * @param {HTMLElement} header
 * @param {HTMLElement} body
 * @param {string} key
 */
export function applyOpenState(header, body, key) {
  const open = isNodeOpen(key);
  header.classList.toggle("expanded", open);
  body.classList.toggle("open", open);
}

/**
 * Force-opens a node (used by expand-to-question / search jump).
 * @param {string} key
 */
export function openNode(key) {
  appState.openNodeKeys.add(key);
}
