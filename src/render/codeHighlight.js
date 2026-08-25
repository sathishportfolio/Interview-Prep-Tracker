// @ts-check
/**
 * render/codeHighlight.js — thin wrapper around the highlight.js global (loaded via CDN
 * `<script>`/`<link>` in index.html, same pattern as Bootstrap/Font Awesome there) so both the real
 * question view (render/nodeViews/questionView.js) and the Add/Edit Answer popup's live preview
 * (features/answerEditor.js) apply the exact same language-specific syntax highlighting to any
 * `<pre><code class="language-xxx">` block — the class data/answerFormat.js's buildCodeSnippetBlock
 * always writes, and the exact convention highlight.js itself looks for. Guarded against hljs not
 * being loaded yet/at all (offline, CDN blocked, script still loading) — falls back to plain
 * unhighlighted (but still escaped, since the markup was already built with escapeHtml) code rather
 * than throwing.
 */

/**
 * Highlights every code block inside `container` in place.
 * @param {ParentNode} container
 */
export function highlightCodeBlocks(container) {
  const hljs = /** @type {any} */ (window).hljs;
  if (!hljs) return;
  for (const el of container.querySelectorAll('pre code[class*="language-"]')) {
    try {
      hljs.highlightElement(el);
    } catch {
      // unsupported/unrecognized language alias — leave the block as plain escaped text
    }
  }
}
