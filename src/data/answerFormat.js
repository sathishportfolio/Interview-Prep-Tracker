// @ts-check
/**
 * data/answerFormat.js — Answer HTML cleanup pipeline (features/answerEditor.js,
 * features/fileManager.js). Answers are meant to be plain, readable notes, not a copy-pasted "Text
 * to HTML" export dragging along inline styles/classes/ids/comments/layout tags — so every save
 * strips all of that down to bare elements, drops every tag that isn't `ul`/`li`/`b`/`strong`
 * (unwrapping their content rather than deleting it — a `<p>`/`<div>`/`<span>`/heading disappears
 * but its text stays), wraps loose text as a single bullet if it isn't already a list, and minifies
 * whitespace, in that order (attributes/comments and disallowed tags are both stripped before the
 * <li> check below so it isn't fooled by a leading `<ul class="...">` or a `<p>` in front of an
 * existing list). Loaded (already-stored) answers get the same strip+minify pass on every app load
 * (see normalizeStoredAnswer/minifyAllAnswers) but are never re-wrapped — wrapping is an explicit
 * save-time decision, not something a background pass should impose retroactively on every legacy
 * answer's structure.
 * @typedef {import('../types.js').Question} Question
 */

/** Every tag allowed to survive answer cleanup — everything else is unwrapped (content kept, tag dropped). */
const ALLOWED_TAGS = new Set(["ul", "li", "b", "strong"]);

/**
 * @param {string} answer
 * @returns {string}
 */
export function wrapAnswerAsList(answer) {
  const trimmed = answer.trim();
  if (!trimmed) return answer;
  // Any existing <li> means the user already supplied list markup somewhere in the answer (not
  // necessarily at the very start, e.g. a lead-in sentence before the list) — wrapping again would
  // nest a second <ul><li> around content that's already a list.
  if (/<li[\s>]/i.test(trimmed)) return answer;
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
 * Drops every tag that isn't in {@link ALLOWED_TAGS} (`ul`, `li`, `b`, `strong`), unwrapping —
 * never deleting — their content: `<p>`, `<div>`, `<span>`, and every heading disappear but the
 * text inside stays in place. Expects attributes already stripped (run after
 * stripAttributesAndComments), so tags are matched bare.
 * @param {string} html
 * @returns {string}
 */
export function stripDisallowedTags(html) {
  return html.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)>/g, (match, slash, tag) => (ALLOWED_TAGS.has(tag.toLowerCase()) ? match : ""));
}

/**
 * Full save-time pipeline: strip all attributes/comments, wrap as a single bullet if not already a
 * list, then minify whitespace. Used by features/answerEditor.js on every Add/Edit Answer save.
 * @param {string} answer
 * @returns {string}
 */
export function cleanAnswerHtml(answer) {
  return minifyHtml(wrapAnswerAsList(stripDisallowedTags(stripAttributesAndComments(answer))));
}

/**
 * Load-time normalization: strip attributes/comments and minify, but deliberately does NOT wrap —
 * see the module doc comment for why.
 * @param {string} answer
 * @returns {string}
 */
export function normalizeStoredAnswer(answer) {
  return minifyHtml(stripDisallowedTags(stripAttributesAndComments(answer)));
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
