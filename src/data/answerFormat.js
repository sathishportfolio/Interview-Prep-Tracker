// @ts-check
/**
 * data/answerFormat.js — Answer save-time HTML wrapping + minification (features/answerEditor.js,
 * features/fileManager.js). Most answers are meant to render as a bullet list; an answer that
 * doesn't already start with <ul><li> gets auto-wrapped as a single list item on save, while one
 * that's already a list (or blank) is left untouched so re-saving an already-wrapped answer doesn't
 * nest it again. Every save also minifies the HTML (whitespace only, never touches actual markup or
 * content) purely to keep stored/synced answers smaller.
 * @typedef {import('../types.js').Question} Question
 */

/**
 * @param {string} answer
 * @returns {string}
 */
export function wrapAnswerAsList(answer) {
  const trimmed = answer.trim();
  if (!trimmed) return answer;
  if (/^<ul>\s*<li>/i.test(trimmed)) return answer;
  return `<ul><li>${trimmed}</li></ul>`;
}

/**
 * Collapses whitespace in an HTML string to keep stored/synced answers small — never strips tags,
 * attributes, or content, only redundant whitespace (indentation, line breaks, doubled spaces) that
 * a browser would collapse away when rendering anyway.
 * @param {string} html
 * @returns {string}
 */
export function minifyHtml(html) {
  return html
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
}

/**
 * Minifies every question's answer HTML in one pass (fileManager.bootstrapFromStorage — normalizes
 * answers saved before this minification existed, so the very next persist/sync carries the
 * minified version instead of waiting for each question to be individually re-saved). Only allocates
 * a new question object for ones that actually change, so a rawData array with nothing to minify is
 * returned with `changed: false` and every question reference untouched.
 * @param {Question[]} rawData
 * @returns {{rawData: Question[], changed: boolean}}
 */
export function minifyAllAnswers(rawData) {
  let changed = false;
  const next = rawData.map((q) => {
    if (!q.answer) return q;
    const minified = minifyHtml(q.answer);
    if (minified === q.answer) return q;
    changed = true;
    return { ...q, answer: minified };
  });
  return { rawData: next, changed };
}
