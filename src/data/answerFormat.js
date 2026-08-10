// @ts-check
/**
 * data/answerFormat.js — Answer save-time HTML wrapping (features/answerEditor.js). Most answers
 * are meant to render as a bullet list; an answer that doesn't already start with <ul><li> gets
 * auto-wrapped as a single list item on save, while one that's already a list (or blank) is left
 * untouched so re-saving an already-wrapped answer doesn't nest it again.
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
