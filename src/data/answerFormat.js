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
 * The result is run through {@link prettyPrintHtml} — one `<li>` per line, indented under the wrapping
 * `<ul>`/`<ol>` — so a line that already carries its own nested markup (a nested list, inline tags)
 * stays editable instead of landing back on one long minified line.
 *
 * If `text` (trimmed) is ALREADY one whole `<ul>...</ul>`/`<ol>...</ol>` block — e.g. the Bulleted/
 * Numbered list button (a one-shot action, not a checkbox — see features/answerEditor.js) gets
 * clicked again, or Numbered is clicked on an existing bulleted list to switch it — this re-derives
 * one "line" per EXISTING top-level `<li>`, rather than treating the pretty-printed multi-line markup
 * itself as plain-text lines to re-wrap (which would nest a fresh `<li>` around every `<li>`/`<ul>`
 * line of the existing markup). Doesn't attempt to handle a nested list inside one of those `<li>`s —
 * same tag-soup-only scope as every other regex-based tool in this module.
 * @param {string} text
 * @param {boolean} ordered
 * @returns {string}
 */
export function linesToList(text, ordered) {
  const trimmed = text.trim();
  const existingList = /^<(ul|ol)>([\s\S]*)<\/\1>$/i.exec(trimmed);
  const lines = existingList
    ? [...existingList[2].matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((m) => m[1].trim()).filter(Boolean)
    : text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
  if (lines.length === 0) return text;
  const tag = ordered ? "ol" : "ul";
  return prettyPrintHtml(`<${tag}>${lines.map((line) => `<li>${line}</li>`).join("")}</${tag}>`);
}

/** Block-level tags — each gets its own line (and, if it has any block-level child, that child's
 *  own line too, indented one level deeper). Everything else (b/strong/em/u/span/a/code/...) stays
 *  inline, flowing on the same line as the text around it — see {@link prettyPrintHtml}. */
const PRETTY_BLOCK_TAGS = new Set(["ul", "ol", "li", "p", "h1", "h2", "h3", "h4", "h5", "h6", "div", "blockquote", "table", "thead", "tbody", "tr", "td", "th"]);
/** Void elements — no closing tag, never carry children. */
const PRETTY_VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link"]);

/**
 * Tokenizes `html` into open/close/void tags, text runs, and HTML comments (passed through verbatim,
 * untouched). Text runs have their internal whitespace collapsed to single spaces here (content inside
 * a carved-out `<pre>` placeholder — see prettyPrintHtml — never reaches this tokenizer, so real code
 * whitespace is never touched).
 * @param {string} html
 * @returns {Array<{type: "open"|"close"|"void"|"text", name?: string, attrs?: string, value?: string}>}
 */
function tokenizePrettyHtml(html) {
  /** @type {Array<{type: "open"|"close"|"void"|"text", name?: string, attrs?: string, value?: string}>} */
  const tokens = [];
  const re = /(<!--[\s\S]*?-->)|<\/([a-zA-Z][a-zA-Z0-9]*)\s*>|<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*)?)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    const [, comment, closeName, openName, attrs, selfClose, text] = m;
    if (comment !== undefined) tokens.push({ type: "text", value: comment });
    else if (closeName !== undefined) tokens.push({ type: "close", name: closeName.toLowerCase() });
    else if (openName !== undefined) {
      const name = openName.toLowerCase();
      tokens.push({ type: selfClose || PRETTY_VOID_TAGS.has(name) ? "void" : "open", name, attrs: attrs || "" });
    } else if (text !== undefined) tokens.push({ type: "text", value: text.replace(/\s+/g, " ") });
  }
  return tokens;
}

/**
 * @typedef {{name?: string, attrs?: string, void?: boolean, text?: string, children: PrettyNode[]}} PrettyNode
 * @param {ReturnType<typeof tokenizePrettyHtml>} tokens
 * @returns {PrettyNode}
 */
function buildPrettyTree(tokens) {
  /** @type {PrettyNode} */
  const root = { children: [] };
  /** @type {PrettyNode[]} */
  const stack = [root];
  for (const t of tokens) {
    const top = stack[stack.length - 1];
    if (t.type === "open") {
      /** @type {PrettyNode} */
      const node = { name: t.name, attrs: t.attrs, children: [] };
      top.children.push(node);
      stack.push(node);
    } else if (t.type === "void") {
      top.children.push({ name: t.name, attrs: t.attrs, void: true, children: [] });
    } else if (t.type === "close") {
      // Lenient: find the nearest matching open ancestor and close everything up to it (tag-soup
      // safe — never throws on a stray/mismatched closing tag, just treats it as a no-op).
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].name === t.name) {
          stack.length = i;
          break;
        }
      }
    } else {
      top.children.push({ text: t.value, children: [] });
    }
  }
  return root;
}

/** @param {PrettyNode} node @returns {string} */
function renderPrettyInline(node) {
  if (node.text !== undefined) return node.text;
  const inner = node.children.map(renderPrettyInline).join("");
  return node.void ? `<${node.name}${node.attrs}>` : `<${node.name}${node.attrs}>${inner}</${node.name}>`;
}

/** @param {PrettyNode[]} children @param {number} indent @returns {string[]} */
function renderPrettyBlockChildren(children, indent) {
  /** @type {string[]} */
  const lines = [];
  /** @type {string[]} */
  let buffer = [];
  const flush = () => {
    const joined = buffer.join("").trim();
    if (joined) lines.push("  ".repeat(indent) + joined);
    buffer = [];
  };
  for (const child of children) {
    if (child.name && PRETTY_BLOCK_TAGS.has(child.name)) {
      flush();
      lines.push(...renderPrettyBlock(child, indent));
    } else {
      buffer.push(renderPrettyInline(child));
    }
  }
  flush();
  return lines;
}

/** @param {PrettyNode} node @param {number} indent @returns {string[]} */
function renderPrettyBlock(node, indent) {
  const pad = "  ".repeat(indent);
  if (node.void) return [`${pad}<${node.name}${node.attrs}>`];
  const hasBlockChild = node.children.some((c) => c.name && PRETTY_BLOCK_TAGS.has(c.name));
  if (!hasBlockChild) {
    const inner = node.children.map(renderPrettyInline).join("").trim();
    return [`${pad}<${node.name}${node.attrs}>${inner}</${node.name}>`];
  }
  return [`${pad}<${node.name}${node.attrs}>`, ...renderPrettyBlockChildren(node.children, indent + 1), `${pad}</${node.name}>`];
}

/**
 * Pretty-prints `html` — every block-level element (ul/ol/li/p/h1-h6/div/table/...) on its own line,
 * indented two spaces per nesting level; inline elements (b/strong/em/u/span/a/code/...) and text stay
 * inline, flowing on the same line as their surrounding content. `<pre>...</pre>` blocks are carved
 * out and restored byte-for-byte untouched (same approach as {@link minifyHtml}) — their content is
 * code, not markup to re-indent. Regex-tokenizer-based, not a DOM parse (data/* stays DOM-free/
 * testable — see stripAttributesAndComments's doc comment) and lenient with malformed/mismatched tags
 * rather than throwing, since this runs on whatever a user typed or pasted.
 * @param {string} html
 * @returns {string}
 */
export function prettyPrintHtml(html) {
  if (!html.trim()) return html;
  const preBlocks = /** @type {string[]} */ ([]);
  const withPlaceholders = html.replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, (match) => {
    preBlocks.push(match);
    return `@@PRE${preBlocks.length - 1}@@`;
  });
  const tree = buildPrettyTree(tokenizePrettyHtml(withPlaceholders));
  const lines = renderPrettyBlockChildren(tree.children, 0);
  const joined = (lines.length > 0 ? lines : [withPlaceholders.trim()]).join("\n");
  return joined.replace(/@@PRE(\d+)@@/g, (_, i) => preBlocks[Number(i)]);
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
