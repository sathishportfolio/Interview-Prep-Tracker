// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import { linesToList, minifyHtml, prettyPrintHtml, stripAttributesAndComments, stripDisallowedTags, cleanFormatting, escapeHtml, unescapeHtml, buildCodeSnippetBlock, appendCodeSnippet, splitTrailingCodeSnippet, DEFAULT_CODE_LANGUAGE } from "./answerFormat.js";

test("linesToList wraps each non-blank line as its own <li> in a <ul>, pretty-printed one per line", () => {
  assert.equal(linesToList("First point\nSecond point\nThird point", false), "<ul>\n  <li>First point</li>\n  <li>Second point</li>\n  <li>Third point</li>\n</ul>");
});

test("linesToList wraps each non-blank line as its own <li> in an <ol> when ordered, pretty-printed one per line", () => {
  assert.equal(linesToList("First point\nSecond point", true), "<ol>\n  <li>First point</li>\n  <li>Second point</li>\n</ol>");
});

test("linesToList drops blank lines", () => {
  assert.equal(linesToList("First\n\n  \nSecond", false), "<ul>\n  <li>First</li>\n  <li>Second</li>\n</ul>");
});

test("linesToList trims each line's surrounding whitespace", () => {
  assert.equal(linesToList("  First  \n  Second  ", false), "<ul>\n  <li>First</li>\n  <li>Second</li>\n</ul>");
});

test("linesToList leaves a blank/whitespace-only input untouched", () => {
  assert.equal(linesToList("", false), "");
  assert.equal(linesToList("   ", false), "   ");
});

test("linesToList keeps a line's own nested/inline tags intact, pretty-printed", () => {
  assert.equal(
    linesToList("Plain line\n<strong>Bold</strong> line with <em>emphasis</em>", false),
    "<ul>\n  <li>Plain line</li>\n  <li><strong>Bold</strong> line with <em>emphasis</em></li>\n</ul>"
  );
});

test("linesToList is idempotent — clicking Bulleted list again on its own (pretty-printed) output doesn't nest a fresh <li> around every existing <li>/<ul> line", () => {
  const once = linesToList("First point\nSecond point", false);
  assert.equal(linesToList(once, false), once);
});

test("linesToList re-run on an already-minified (single-line) list is also idempotent", () => {
  const minified = "<ul><li>First point</li><li>Second point</li></ul>";
  assert.equal(linesToList(minified, false), "<ul>\n  <li>First point</li>\n  <li>Second point</li>\n</ul>");
});

test("linesToList switches an existing bulleted list to numbered (and vice versa) by re-deriving lines from its <li>s, not the raw pretty-printed markup", () => {
  const bulleted = linesToList("First point\nSecond point", false);
  assert.equal(linesToList(bulleted, true), "<ol>\n  <li>First point</li>\n  <li>Second point</li>\n</ol>");
});

test("prettyPrintHtml puts each block element on its own line, indented one level per nesting", () => {
  assert.equal(prettyPrintHtml("<ul><li>One</li><li>Two</li></ul>"), "<ul>\n  <li>One</li>\n  <li>Two</li>\n</ul>");
});

test("prettyPrintHtml indents a nested list under its parent <li> — once an <li> has a block child, ALL its content (including its own leading text) moves onto indented lines rather than just the nested part", () => {
  assert.equal(
    prettyPrintHtml("<ul><li>Parent<ul><li>Child one</li><li>Child two</li></ul></li></ul>"),
    "<ul>\n  <li>\n    Parent\n    <ul>\n      <li>Child one</li>\n      <li>Child two</li>\n    </ul>\n  </li>\n</ul>"
  );
});

test("prettyPrintHtml keeps inline tags (b/strong/em/u/a) flowing on the same line as surrounding text", () => {
  assert.equal(prettyPrintHtml("<p>Hello <strong>bold</strong> and <em>emphasis</em> world</p>"), "<p>Hello <strong>bold</strong> and <em>emphasis</em> world</p>");
});

test("prettyPrintHtml preserves a tag's attributes exactly (not stripped, just reflowed)", () => {
  assert.equal(prettyPrintHtml('<p><a href="https://example.com">link</a></p>'), '<p><a href="https://example.com">link</a></p>');
});

test("prettyPrintHtml leaves <pre><code> block content byte-for-byte untouched, including its own whitespace", () => {
  const input = '<p>Before</p><pre><code class="language-java">public class X {\n    int a = 1;\n}</code></pre>';
  assert.equal(prettyPrintHtml(input), '<p>Before</p>\n<pre><code class="language-java">public class X {\n    int a = 1;\n}</code></pre>');
});

test("prettyPrintHtml is idempotent — pretty-printing already-pretty HTML doesn't add extra indentation", () => {
  const once = prettyPrintHtml("<ul><li>One</li><li>Two<ul><li>Nested</li></ul></li></ul>");
  assert.equal(prettyPrintHtml(once), once);
});

test("prettyPrintHtml leaves plain text with no tags untouched", () => {
  assert.equal(prettyPrintHtml("Just plain text, no markup."), "Just plain text, no markup.");
});

test("prettyPrintHtml leaves blank input untouched", () => {
  assert.equal(prettyPrintHtml(""), "");
  assert.equal(prettyPrintHtml("   "), "   ");
});

test("minifyHtml collapses whitespace between tags", () => {
  assert.equal(minifyHtml("<ul>\n  <li>Some text</li>\n</ul>"), "<ul><li>Some text</li></ul>");
});

test("minifyHtml collapses runs of whitespace inside text content to a single space", () => {
  assert.equal(minifyHtml("<ul><li>Some   text\n  here</li></ul>"), "<ul><li>Some text here</li></ul>");
});

test("minifyHtml trims leading/trailing whitespace", () => {
  assert.equal(minifyHtml("  <ul><li>Text</li></ul>  "), "<ul><li>Text</li></ul>");
});

test("minifyHtml is a no-op on already-minified HTML", () => {
  const minified = "<ul><li>Some text here</li></ul>";
  assert.equal(minifyHtml(minified), minified);
});

test("minifyHtml preserves whitespace/newlines inside a <pre><code> block", () => {
  const input = "<ul><li><pre><code>import java.lang.annotation.*;\n\n@Retention(RetentionPolicy.RUNTIME)\npublic @interface MyCustomAnnotation {\n    String value() default \"Default Text\";\n}</code></pre></li>\n</ul>";
  assert.equal(
    minifyHtml(input),
    "<ul><li><pre><code>import java.lang.annotation.*;\n\n@Retention(RetentionPolicy.RUNTIME)\npublic @interface MyCustomAnnotation {\n    String value() default \"Default Text\";\n}</code></pre></li></ul>"
  );
});

test("minifyHtml still collapses whitespace outside <pre> blocks while leaving the block untouched", () => {
  const input = "<p>Before</p>\n  <pre>  keep   this   </pre>\n  <p>After</p>";
  assert.equal(minifyHtml(input), "<p>Before</p><pre>  keep   this   </pre><p>After</p>");
});

test("stripAttributesAndComments removes style/class/id and every other attribute, including custom/data-*/aria-*/on* ones", () => {
  const input = '<div id="x" class="y" style="color:red" data-foo="bar" aria-label="z" onclick="alert(1)" data-whatever-custom-thing="123">text</div>';
  assert.equal(stripAttributesAndComments(input), "<div>text</div>");
});

test("stripAttributesAndComments removes HTML comments entirely", () => {
  assert.equal(stripAttributesAndComments("<p>a</p><!-- a comment --><p>b</p>"), "<p>a</p><p>b</p>");
});

test("stripAttributesAndComments strips attributes from self-closing/void tags too", () => {
  assert.equal(stripAttributesAndComments('<img src="x.png" alt="pic" />'), "<img>");
  assert.equal(stripAttributesAndComments('<br class="x"/>'), "<br>");
});

test("stripAttributesAndComments leaves plain tags and text content untouched", () => {
  const input = "<ul><li>Already plain</li></ul>";
  assert.equal(stripAttributesAndComments(input), input);
});

test("stripDisallowedTags unwraps div/span/a/img, keeping ul/li/b/strong/em/u/p/h1-h5", () => {
  assert.equal(stripDisallowedTags("<div><span>text</span></div>"), "text");
  assert.equal(stripDisallowedTags("<a>link</a><img>"), "link");
  assert.equal(stripDisallowedTags("<ul><li><b>bold</b> and <strong>strong</strong></li></ul>"), "<ul><li><b>bold</b> and <strong>strong</strong></li></ul>");
});

test("stripDisallowedTags keeps h1 through h5 but unwraps h6 and other headings-adjacent tags", () => {
  assert.equal(stripDisallowedTags("<h1>Title</h1>"), "<h1>Title</h1>");
  assert.equal(stripDisallowedTags("<h2>Sub</h2>"), "<h2>Sub</h2>");
  assert.equal(stripDisallowedTags("<h5>Small</h5>"), "<h5>Small</h5>");
  assert.equal(stripDisallowedTags("<h6>Too small</h6>"), "Too small");
});

test("stripDisallowedTags keeps em/u/p (Italic/Underline/Paragraph toolbar output)", () => {
  assert.equal(stripDisallowedTags("<em>Italic</em>"), "<em>Italic</em>");
  assert.equal(stripDisallowedTags("<u>Underlined</u>"), "<u>Underlined</u>");
  assert.equal(stripDisallowedTags("<p>Paragraph</p>"), "<p>Paragraph</p>");
});

test("cleanFormatting strips attributes/comments and unwraps disallowed tags from a real 'Text to HTML' export", () => {
  const input = `<p class="demoTitle">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span style="background: #16643d; color: #fff;"> &nbsp;Text </span>&nbsp;-&nbsp;HTML&nbsp;.&nbsp;com</p>
<p class="intro">Convert your visual text documents to HTML code instantly. Edit and clean your markup with a couple of clicks.</p>
<p style="text-align: center;"><a href="https://text-html.com/" target="_blank" rel="nofollow"><img style="width: 90%; max-width: 400px;" src="https://text-html.com/pics/paste-text-here-convert-html.jpg" alt="screenshot" /></a></p>
<h2>How to use the Text to HTML converter?</h2>
<ul>
<li>Paste a visual document to the left to convert it to HTML</li>
<li>Paste your HTML code it the right to preview the document</li>
</ul>
<p><strong>Press the <span style="display: inline-block; background: #16643d; color: #fff; padding: 5px 15px; border-radius: 8px;">Clean</span> button to execute the <em style="background: transparent url('https://text-html.com/pics/checkmark.png') no-repeat scroll 4px -64px; display: inline-block; padding: 0 10px 0 20px; color: #16643d; font-weight: bold;">checked</em> <a href="https://html-cleaner.com/" target="_blank" rel="nofollow">HTML cleaning</a> options.</strong></p>
<p class="aligncenter">Erase the page to get started. <span style="background: url('pics/png.png') no-repeat scroll -75px 0 transparent; height: 25px; width: 25px; display: inline-block;">&nbsp;</span></p>
<p>&nbsp;</p>
<!-- Comments are visible in the HTML source only -->`;
  const result = cleanFormatting(input);
  // No leftover attributes (of any name, including custom ones) or comments.
  assert.equal(/<[a-z][a-z0-9]*\s+[^>]/i.test(result), false, "no tag should have anything after its name");
  assert.equal(/<!--/.test(result), false);
  // span/a/img are unwrapped; p/h2/strong/em all survive (allowed tags), just stripped of attributes.
  assert.equal(
    result,
    '<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;  &nbsp;Text &nbsp;-&nbsp;HTML&nbsp;.&nbsp;com</p>\n<p>Convert your visual text documents to HTML code instantly. Edit and clean your markup with a couple of clicks.</p>\n<p></p>\n<h2>How to use the Text to HTML converter?</h2>\n<ul>\n<li>Paste a visual document to the left to convert it to HTML</li>\n<li>Paste your HTML code it the right to preview the document</li>\n</ul>\n<p><strong>Press the Clean button to execute the <em>checked</em> HTML cleaning options.</strong></p>\n<p>Erase the page to get started. &nbsp;</p>\n<p>&nbsp;</p>\n'
  );
});

test("cleanFormatting leaves an already-plain ul/li/strong answer untouched", () => {
  const input = "<ul><li>Existing point one</li><li>Existing point two</li></ul>";
  assert.equal(cleanFormatting(input), input);
});

test("escapeHtml escapes &, <, > only, in the correct order", () => {
  assert.equal(escapeHtml("if (a < b && b > c) return;"), "if (a &lt; b &amp;&amp; b &gt; c) return;");
});

test("unescapeHtml reverses escapeHtml", () => {
  const code = `if (a < b && b > c) { return "x & y"; }`;
  assert.equal(unescapeHtml(escapeHtml(code)), code);
});

test("buildCodeSnippetBlock wraps escaped code in a <pre><code class=\"language-xxx\"> block", () => {
  assert.equal(buildCodeSnippetBlock("int x = 1 < 2;", "javascript"), '<pre><code class="language-javascript">int x = 1 &lt; 2;</code></pre>');
});

test("buildCodeSnippetBlock falls back to DEFAULT_CODE_LANGUAGE for a missing/unrecognized language", () => {
  assert.equal(buildCodeSnippetBlock("x", undefined), `<pre><code class="language-${DEFAULT_CODE_LANGUAGE}">x</code></pre>`);
  assert.equal(buildCodeSnippetBlock("x", "cobol"), `<pre><code class="language-${DEFAULT_CODE_LANGUAGE}">x</code></pre>`);
});

test("appendCodeSnippet appends the code block directly after the body when both are present", () => {
  assert.equal(appendCodeSnippet("Some explanation.", "return 1;", "java"), 'Some explanation.<pre><code class="language-java">return 1;</code></pre>');
});

test("appendCodeSnippet returns the code block alone when the body is blank", () => {
  assert.equal(appendCodeSnippet("", "return 1;", "java"), '<pre><code class="language-java">return 1;</code></pre>');
  assert.equal(appendCodeSnippet("   ", "return 1;", "java"), '<pre><code class="language-java">return 1;</code></pre>');
});

test("appendCodeSnippet no-ops (returns body unchanged) when code is blank", () => {
  assert.equal(appendCodeSnippet("Some explanation.", "", "java"), "Some explanation.");
  assert.equal(appendCodeSnippet("Some explanation.", "   ", "java"), "Some explanation.");
});

test("splitTrailingCodeSnippet round-trips through appendCodeSnippet, including language", () => {
  const body = "Some explanation.<ul><li>A point</li></ul>";
  const code = `if (a < b) {\n  return "x & y";\n}`;
  const answer = appendCodeSnippet(body, code, "typescript");
  const result = splitTrailingCodeSnippet(answer);
  assert.equal(result.body, body);
  assert.equal(result.code, code);
  assert.equal(result.language, "typescript");
});

test("splitTrailingCodeSnippet leaves an answer with no trailing code block untouched, code empty, default language", () => {
  const answer = "Just a plain explanation, no code.";
  assert.deepEqual(splitTrailingCodeSnippet(answer), { body: answer, code: "", language: DEFAULT_CODE_LANGUAGE });
});

test("splitTrailingCodeSnippet returns an empty body when the whole answer is just the code block", () => {
  const result = splitTrailingCodeSnippet(appendCodeSnippet("", "return 1;", "sql"));
  assert.equal(result.body, "");
  assert.equal(result.code, "return 1;");
  assert.equal(result.language, "sql");
});

test("splitTrailingCodeSnippet falls back to DEFAULT_CODE_LANGUAGE for a legacy code block with no language class", () => {
  const answer = "Legacy answer.<pre><code>old code here</code></pre>";
  const result = splitTrailingCodeSnippet(answer);
  assert.equal(result.body, "Legacy answer.");
  assert.equal(result.code, "old code here");
  assert.equal(result.language, DEFAULT_CODE_LANGUAGE);
});
