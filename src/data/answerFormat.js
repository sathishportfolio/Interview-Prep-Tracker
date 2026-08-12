// @ts-check
/**
 * data/answerFormat.js — Answer HTML cleanup pipeline (features/answerEditor.js,
 * features/fileManager.js). Answers are meant to be plain, readable notes, not a copy-pasted "Text
 * to HTML" export dragging along inline styles/classes/ids/comments — so every save strips all of
 * that down to bare elements, wraps loose text as a single bullet if it isn't already a list, and
 * minifies whitespace, in that order (stripping first so the <ul><li> detection below isn't fooled
 * by a leading `<ul class="...">`). Loaded (already-stored) answers get the same strip+minify pass
 * on every app load (see normalizeStoredAnswer/minifyAllAnswers) but are never re-wrapped — wrapping
 * is an explicit save-time decision, not something a background pass should impose retroactively on
 * every legacy answer's structure.
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
 * a browser would collapse away when rendering anyway. `<pre>...</pre>` blocks (code snippets) are
 * carved out and restored byte-for-byte before that collapsing happens, since browsers render
 * whitespace inside `<pre>` literally — collapsing it would flatten multi-line code onto one line.
 * @param {string} html
 * @returns {string}
 */
export function minifyHtml(html) {
  const preBlocks = [];
  const withPlaceholders = html.replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, (match) => {
    preBlocks.push(match);
    return "@@PRE" + (preBlocks.length - 1) + "@@";
  });
  const minified = withPlaceholders
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .replace(/>\s+(@@PRE\d+@@)/g, ">$1")
    .replace(/(@@PRE\d+@@)\s+</g, "$1<")
    .trim();
  return minified.replace(/@@PRE(\d+)@@/g, (_, i) => preBlocks[Number(i)]);
}

/**
 * Strips every HTML comment and every attribute (style, class, id, href, src, everything) from
 * every tag, leaving bare elements only — e.g. `<p class="x" style="y">` becomes `<p>`, `<img
 * src="...">` becomes `<img>`. Regex-based rather than a DOM parse (data/* stays DOM-free/testable
 * under plain `node --test`, same as data/csv/csvCore.js's hand-rolled CSV parser) — adequate for
 * the well-formed tag-soup answers this app actually deals with; not a general HTML sanitizer.
 * @param {string} html
 * @returns {string}
 */
export function stripAttributesAndComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(\/?[a-zA-Z][a-zA-Z0-9]*)[^>]*>/g, "<$1>");
}

/**
 * Full save-time pipeline: strip all attributes/comments, wrap as a single bullet if not already a
 * list, then minify whitespace. Used by features/answerEditor.js on every Add/Edit Answer save.
 * @param {string} answer
 * @returns {string}
 */
export function cleanAnswerHtml(answer) {
  return minifyHtml(wrapAnswerAsList(stripAttributesAndComments(answer)));
}

/**
 * Load-time normalization: strip attributes/comments and minify, but deliberately does NOT wrap —
 * see the module doc comment for why.
 * @param {string} answer
 * @returns {string}
 */
export function normalizeStoredAnswer(answer) {
  return minifyHtml(stripAttributesAndComments(answer));
}

/**
 * Normalizes every question's answer HTML in one pass (fileManager.bootstrapFromStorage — cleans up
 * answers saved before this cleanup existed, so the very next persist/sync carries the cleaned
 * version instead of waiting for each question to be individually re-saved). Only allocates a new
 * question object for ones that actually change, so a rawData array with nothing to normalize is
 * returned with `changed: false` and every question reference untouched.
 * @param {Question[]} rawData
 * @returns {{rawData: Question[], changed: boolean}}
 */
export function minifyAllAnswers(rawData) {
  let changed = false;
  const next = rawData.map((q) => {
    if (!q.answer) return q;
    const normalized = normalizeStoredAnswer(q.answer);
    if (normalized === q.answer) return q;
    changed = true;
    return { ...q, answer: normalized };
  });
  return { rawData: next, changed };
}
