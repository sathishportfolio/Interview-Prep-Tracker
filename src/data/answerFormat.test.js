// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import { wrapAnswerAsList, minifyHtml, minifyAllAnswers, stripAttributesAndComments, cleanAnswerHtml, normalizeStoredAnswer } from "./answerFormat.js";

test("wrapAnswerAsList wraps plain text in <ul><li>", () => {
  assert.equal(wrapAnswerAsList("Plain answer text"), "<ul><li>Plain answer text</li></ul>");
});

test("wrapAnswerAsList leaves an already-wrapped answer untouched", () => {
  const already = "<ul><li>Already a list</li></ul>";
  assert.equal(wrapAnswerAsList(already), already);
});

test("wrapAnswerAsList is case-insensitive when detecting an existing list", () => {
  const already = "<UL><LI>Already a list</LI></UL>";
  assert.equal(wrapAnswerAsList(already), already);
});

test("wrapAnswerAsList leaves a blank/whitespace-only answer untouched", () => {
  assert.equal(wrapAnswerAsList(""), "");
  assert.equal(wrapAnswerAsList("   "), "   ");
});

test("wrapAnswerAsList trims surrounding whitespace when wrapping", () => {
  assert.equal(wrapAnswerAsList("  Plain answer  "), "<ul><li>Plain answer</li></ul>");
});

test("wrapAnswerAsList wraps HTML that isn't already a top-level <ul><li>", () => {
  assert.equal(wrapAnswerAsList("<p>Some paragraph</p>"), "<ul><li><p>Some paragraph</p></li></ul>");
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

test("minifyAllAnswers minifies only answers that need it, reporting changed:true", () => {
  const rawData = [
    { id: "a", answer: "<ul>\n  <li>Needs minifying</li>\n</ul>" },
    { id: "b", answer: "<ul><li>Already minified</li></ul>" },
    { id: "c", answer: "" },
  ];
  const result = minifyAllAnswers(rawData);
  assert.equal(result.changed, true);
  assert.equal(result.rawData.find((q) => q.id === "a").answer, "<ul><li>Needs minifying</li></ul>");
  // Untouched questions keep their exact original object reference (no unnecessary churn).
  assert.equal(result.rawData.find((q) => q.id === "b"), rawData[1]);
  assert.equal(result.rawData.find((q) => q.id === "c"), rawData[2]);
});

test("minifyAllAnswers reports changed:false when nothing needs minifying", () => {
  const rawData = [{ id: "a", answer: "<ul><li>Already minified</li></ul>" }, { id: "b", answer: "" }];
  const result = minifyAllAnswers(rawData);
  assert.equal(result.changed, false);
  assert.deepEqual(result.rawData, rawData);
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

test("cleanAnswerHtml strips attributes/comments, wraps, and minifies a real 'Text to HTML' export", () => {
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
  const result = cleanAnswerHtml(input);
  // No leftover attributes (of any name, including custom ones) or comments.
  assert.equal(/<[a-z][a-z0-9]*\s+[^>]/i.test(result), false, "no tag should have anything after its name");
  assert.equal(/<!--/.test(result), false);
  // Every original tag/text survives, just bare — wrapped as a single outer bullet since the
  // cleaned content didn't already start with <ul><li>.
  assert.equal(
    result,
    "<ul><li><p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span> &nbsp;Text </span>&nbsp;-&nbsp;HTML&nbsp;.&nbsp;com</p>" +
      "<p>Convert your visual text documents to HTML code instantly. Edit and clean your markup with a couple of clicks.</p>" +
      "<p><a><img></a></p>" +
      "<h2>How to use the Text to HTML converter?</h2>" +
      "<ul><li>Paste a visual document to the left to convert it to HTML</li>" +
      "<li>Paste your HTML code it the right to preview the document</li></ul>" +
      "<p><strong>Press the <span>Clean</span> button to execute the <em>checked</em><a>HTML cleaning</a> options.</strong></p>" +
      "<p>Erase the page to get started. <span>&nbsp;</span></p>" +
      "<p>&nbsp;</p></li></ul>"
  );
});

test("normalizeStoredAnswer strips attributes/comments and minifies but does NOT wrap unwrapped content", () => {
  const input = '<p class="x">Legacy answer</p>';
  assert.equal(normalizeStoredAnswer(input), "<p>Legacy answer</p>");
});
