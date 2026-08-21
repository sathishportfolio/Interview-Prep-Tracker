// @ts-check
/**
 * id.js — stable ID generation. Zero DOM, zero imports outside this file.
 */

let counter = 0;

/**
 * Generates a reasonably unique, sortable-ish ID. Prefixed so IDs are visually distinguishable
 * by kind if ever mixed (question vs file).
 * @param {string} prefix
 * @returns {string}
 */
export function generateId(prefix) {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

/** @returns {string} */
export function newQuestionId() {
  return generateId("q");
}

/** @returns {string} */
export function newFileId() {
  return generateId("f");
}

/** @returns {string} */
export function newLinkId() {
  return generateId("l");
}
