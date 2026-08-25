// @ts-check
/**
 * data/answerFormat.js — Answer HTML formatting tools (features/answerEditor.js). Nothing here runs
 * automatically anymore on save/load/sync — every transform is opt-in, applied only when the user
 * explicitly checks a box in the Add/Edit Answer popup (see answerEditor.js), and reversible by
 * unchecking it there. This module just exposes the individual building blocks.
 * @typedef {import('../types.js').Question} Question
 */

/** Every tag allowed to survive the "Clean formatting" transform — everything else is unwrapped (content kept, tag dropped). */
const ALLOWED_TAGS = new Set(["ul", "li", "b", "strong", "h1", "h2", "h3", "h4", "h5", "em", "u", "p"]);

/** Languages the Code Snippet field's language picker offers (features/answerEditor.js) — also the
 *  highlight.js language names/aliases used both there and in the real question view's syntax
 *  highlighting (see render/codeHighlight.js), so no separate mapping table is needed. */
export const CODE_LANGUAGES = /** @type {const} */ (["java", "html", "css", "javascript", "typescript", "sql", "markdown"]);

/** @type {Record<typeof CODE_LANGUAGES[number], string>} */
export const CODE_LANGUAGE_LABELS = {
  java: "Java",
  html: "HTML",
  css: "CSS",
  javascript: "JavaScript",
  typescript: "TypeScript",
  sql: "SQL",
  markdown: "Markdown",
};

/** Pre-selected by default in the Code Snippet language picker (features/answerEditor.js). */
export const DEFAULT_CODE_LANGUAGE = "java";

/**
 * Splits `text` on newlines and wraps each non-blank line as its own list item — `ordered` picks
 * `<ol>` (numbered) vs `<ul>` (bulleted). Blank lines are dropped rather than producing empty `<li>`s.
 * @param {string} text
 * @param {boolean} ordered
 * @returns {string}
 */
export function linesToList(text, ordered) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return text;
  const tag = ordered ? "ol" : "ul";
  return `<${tag}>${lines.map((line) => `<li>${line}</li>`).join("")}</${tag}>`;
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
 * Drops every tag that isn't in {@link ALLOWED_TAGS} (`ul`, `li`, `b`, `strong`, `em`, `u`, `p`,
 * `h1`-`h5`), unwrapping — never deleting — their content: `<div>`, `<span>`, and every OTHER
 * heading level/tag disappear but the text inside stays in place. Expects attributes already
 * stripped (run after stripAttributesAndComments), so tags are matched bare.
 * @param {string} html
 * @returns {string}
 */
export function stripDisallowedTags(html) {
  return html.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)>/g, (match, slash, tag) => (ALLOWED_TAGS.has(tag.toLowerCase()) ? match : ""));
}

/**
 * "Clean formatting" — strips attributes/comments then unwraps disallowed tags, i.e. everything a
 * "Text to HTML" copy/paste export drags along (inline styles/classes/ids/comments/layout tags) down
 * to bare `ul`/`li`/`b`/`strong`/`em`/`u`/`p`/`h1`-`h5`. The combined single-checkbox transform in
 * answerEditor.js.
 * @param {string} html
 * @returns {string}
 */
export function cleanFormatting(html) {
  return stripDisallowedTags(stripAttributesAndComments(html));
}

/**
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * @param {string} text
 * @returns {string}
 */
export function unescapeHtml(text) {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

/**
 * The code snippet field (features/answerEditor.js) is kept as its own textarea, separate from the
 * main answer body, specifically so raw code (which often contains `<`/`>`/`&`) is never run through
 * the HTML-formatting checkboxes or interpreted as markup — it's escaped and wrapped in a
 * `<pre><code class="language-xxx">` block instead. The `language-xxx` class is both how the chosen
 * language round-trips back into the editor's language picker on the next edit (see
 * splitTrailingCodeSnippet) AND the exact class highlight.js looks for to pick a syntax highlighter
 * (see render/codeHighlight.js) — one class serves both purposes, no separate storage needed.
 * @param {string} code
 * @param {string} [language] Defaults to DEFAULT_CODE_LANGUAGE.
 * @returns {string}
 */
export function buildCodeSnippetBlock(code, language) {
  const lang = /** @type {any} */ (CODE_LANGUAGES).includes(language) ? language : DEFAULT_CODE_LANGUAGE;
  return `<pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>`;
}

/**
 * Appends a code snippet (see buildCodeSnippetBlock) to the end of the main answer body at Save
 * time — the two are edited as separate fields but stored as one `answer` string, same as any other
 * HTML in it. No-ops (returns `body` unchanged) when `code` is blank.
 * @param {string} body
 * @param {string} code
 * @param {string} [language]
 * @returns {string}
 */
export function appendCodeSnippet(body, code, language) {
  if (!code.trim()) return body;
  const block = buildCodeSnippetBlock(code, language);
  return body.trim() ? `${body}${block}` : block;
}

/**
 * The inverse of appendCodeSnippet, run when the answer editor opens on an existing answer: if the
 * stored HTML ends in exactly one `<pre><code class="language-xxx">...</code></pre>` block, that
 * block is pulled back out into its own `code` string (entities un-escaped back to raw text) and
 * `language` (falling back to DEFAULT_CODE_LANGUAGE if the class is missing/unrecognized — e.g. an
 * answer saved before this feature existed) so both repopulate the separate Code Snippet field
 * instead of showing up inside the main answer textarea too. An answer with no such trailing block
 * comes back with `code: ""` and `body` completely untouched.
 * @param {string} answer
 * @returns {{body: string, code: string, language: string}}
 */
export function splitTrailingCodeSnippet(answer) {
  const match = /^([\s\S]*?)\s*<pre><code(?:\s+class="language-([a-z]+)")?>([\s\S]*?)<\/code><\/pre>\s*$/i.exec(answer);
  if (!match) return { body: answer, code: "", language: DEFAULT_CODE_LANGUAGE };
  const language = /** @type {any} */ (CODE_LANGUAGES).includes(match[2]) ? match[2] : DEFAULT_CODE_LANGUAGE;
  return { body: match[1], code: unescapeHtml(match[3]), language };
}
