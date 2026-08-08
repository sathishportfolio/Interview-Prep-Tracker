// @ts-check
/**
 * render/accordion.js — custom accordion component, fully driven by appState.openNodeKeys (never
 * Bootstrap's data-api collapse — see README-AI gotcha #2). Node-view create/patch functions call
 * these helpers to build a header+body pair and keep its expanded/collapsed rendering in sync with
 * app state.
 */
import { appState, isNodeOpen, toggleNodeOpen, toggleNodeOpenExclusive, openNodeExclusive } from "../state/appState.js";
import { groupKey } from "../data/selectionKeys.js";

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
 * Whether single-open exclusivity should be skipped for `key` because bulk-select mode is active
 * for its parent — e.g. every SubTopic under a Topic needs to stay open at once while the user is
 * checking boxes across them, not auto-collapse the previous one on each click.
 * @param {string} key
 * @returns {boolean}
 */
function exclusivityRelaxedFor(key) {
  if (key.startsWith("S::")) return document.body.classList.contains("select-subject-on");
  const parts = key.split("::");
  if (parts.length === 3 && parts[1] === "T") return appState.childSelectModeKeys.has(groupKey("subject", { subject: parts[0] }));
  if (parts.length === 4 && parts[2] === "ST") return appState.childSelectModeKeys.has(groupKey("topic", { subject: parts[0], topic: parts[1] }));
  return false;
}

/**
 * Wires a header's click/keyboard toggle. Any nested clickable control INSIDE the header (icon
 * buttons, etc.) must call `e.stopPropagation()` in its own listener — that alone is sufficient
 * here since this is a plain bubble-phase listener, not Bootstrap's capture-phase data-api one.
 *
 * Opening normally applies single-open exclusivity (toggleNodeOpenExclusive) — only one Subject/
 * Topic/SubTopic stays open per level/parent — EXCEPT while bulk-select mode is active for that
 * level's parent (see exclusivityRelaxedFor), where every sibling needs to stay open/selectable at
 * once instead of auto-collapsing. Closing a sibling only updates appState, not that sibling's own
 * DOM classes, so callers MUST pass `onToggle` and have it repaint (see treeHandlers.js's
 * onGroupAutoExpand) or collapsed siblings will keep showing as expanded. `onToggle` also owns
 * scrolling the opened node into view (see scrollNodeIntoView) — deliberately NOT done here, since
 * scrolling before that repaint targets a stale pre-collapse layout that then visibly jumps once the
 * repaint actually lands.
 * @param {HTMLElement} header
 * @param {string} key
 * @param {() => void} [onToggle] Callback after toggling — expected to repaint (and then scroll) so
 *   sibling accordions closed by exclusivity re-sync their own DOM state first.
 */
export function bindHeader(header, key, onToggle) {
  const handler = (e) => {
    if (exclusivityRelaxedFor(key)) toggleNodeOpen(key);
    else toggleNodeOpenExclusive(key);
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
 * Force-opens a node (used by expand-to-question / search jump), applying the same single-open
 * exclusivity as a header click — jumping to a question shouldn't leave a previously-open,
 * unrelated Subject/Topic/SubTopic still expanded alongside it. Relaxed the same way as a header
 * click while bulk-select mode is active for this key's parent (see exclusivityRelaxedFor).
 * @param {string} key
 */
export function openNode(key) {
  if (exclusivityRelaxedFor(key)) appState.openNodeKeys.add(key);
  else openNodeExclusive(key);
}

/**
 * Scrolls a Subject/Topic/SubTopic's own header into view. Used after an auto-expand cascade opens
 * nested content the user didn't directly click (see features/autoExpand.js) so the newly-revealed
 * deepest level stays visible without a manual scroll — header click opens already self-scroll via
 * bindHeader, this covers the child levels a cascade opens on the user's behalf.
 * @param {string} key
 */
export function scrollNodeIntoView(key) {
  findNodeElement(key)
    ?.querySelector(":scope > .acc-header")
    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/**
 * Looks up a Subject/Topic/SubTopic's own `.acc-item` element by its dataset attributes (never by
 * building a CSS selector out of arbitrary subject/topic/subTopic text, which could contain
 * characters that break selector syntax).
 * @param {string} key
 * @returns {HTMLElement|null}
 */
function findNodeElement(key) {
  const parts = key.split("::");
  /** @param {string} levelClass @param {(d: DOMStringMap) => boolean} match */
  const find = (levelClass, match) =>
    /** @type {HTMLElement|null} */ ([...document.querySelectorAll(`.${levelClass}`)].find((el) => match(/** @type {HTMLElement} */ (el).dataset)) ?? null);

  if (key.startsWith("S::")) {
    const subject = key.slice(3);
    return find("level-subject", (d) => d.subject === subject);
  }
  if (parts.length === 3 && parts[1] === "T") return find("level-topic", (d) => d.subject === parts[0] && d.topic === parts[2]);
  if (parts.length === 4 && parts[2] === "ST") return find("level-subtopic", (d) => d.subject === parts[0] && d.topic === parts[1] && d.subTopic === parts[3]);
  return null;
}
