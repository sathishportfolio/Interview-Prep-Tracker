// @ts-check
/**
 * features/bulkPanelUI.js — shared DOM builder for the "+ Bulk Add/Update/Copy (CSV)" panel shell,
 * reused at root/Subject/Topic/SubTopic level by bulkAdd.js/bulkUpdate.js/bulkCopy.js. Not part of
 * render/* (it's a one-off imperative panel, not part of the tree's keyed reconciliation), but kept
 * as a single shared builder so the three bulk features don't each hand-roll textarea+buttons.
 */
import { sampleBulkRow } from "../data/csv/bulkCsv.js";
import { attachDuplicateHints } from "./duplicateHints.js";
import { appState } from "../state/appState.js";

/**
 * Resolves the Subject/Topic/SubTopic to prefill the sample row with: the panel's own fixed scope
 * (set when it's mounted under a Subject/Topic/SubTopic accordion) if any, otherwise — for a
 * root-level panel with no fixed scope — whichever Subject/Topic/SubTopic is currently expanded in
 * the accordion (deepest open chain wins), mirroring the same "current chain" scan
 * features/activeQuestion.js's computeBreadcrumbData uses for the header breadcrumb.
 * @param {{fixedSubject?: string|null, fixedTopic?: string|null, fixedSubTopic?: string|null}} scope
 * @returns {{subject?: string, topic?: string, subTopic?: string}}
 */
function resolveSampleScope(scope) {
  if (scope.fixedSubject || scope.fixedTopic || scope.fixedSubTopic) {
    return { subject: scope.fixedSubject || undefined, topic: scope.fixedTopic || undefined, subTopic: scope.fixedSubTopic || undefined };
  }
  let subject, topic, subTopic;
  for (const key of appState.openNodeKeys) {
    if (key.startsWith("S::")) subject = key.slice(3);
    const topicMatch = /^(.+)::T::(.+)$/.exec(key);
    if (topicMatch) {
      subject = topicMatch[1];
      topic = topicMatch[2];
    }
    const subTopicMatch = /^(.+)::(.+)::ST::(.+)$/.exec(key);
    if (subTopicMatch) {
      subject = subTopicMatch[1];
      topic = subTopicMatch[2];
      subTopic = subTopicMatch[3];
    }
  }
  return { subject, topic, subTopic };
}

/**
 * @param {{
 *   label: string,
 *   toggleLabel: string,
 *   onSubmit: (text: string) => {summaryText: string},
 *   showSampleLink?: boolean,
 *   sampleScope?: {fixedSubject?: string|null, fixedTopic?: string|null, fixedSubTopic?: string|null},
 * }} config
 * @returns {HTMLElement}
 */
export function buildBulkPanel(config) {
  const wrap = document.createElement("div");
  wrap.className = "bulk-add-panel";

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "btn btn-sm btn-outline-primary";
  toggleBtn.textContent = config.toggleLabel;
  wrap.appendChild(toggleBtn);

  const body = document.createElement("div");
  body.className = "bulk-panel-body";
  body.hidden = true;

  const help = document.createElement("div");
  help.className = "text-muted";
  help.style.fontSize = "0.75rem";
  help.textContent = "Comma-separated, header row required: Subject,Topic,SubTopic,Question,Answer[,Done,ReviewLater,Duplicate,LessImportant,Starred]";
  body.appendChild(help);

  if (config.showSampleLink !== false) {
    const sampleLink = document.createElement("a");
    sampleLink.href = "#";
    sampleLink.textContent = "Copy/insert sample row";
    sampleLink.style.fontSize = "0.75rem";
    sampleLink.addEventListener("click", (e) => {
      e.preventDefault();
      textarea.value = sampleBulkRow(resolveSampleScope(config.sampleScope || {}));
    });
    body.appendChild(sampleLink);
  }

  const textarea = document.createElement("textarea");
  body.appendChild(textarea);

  const hintsMount = document.createElement("div");
  body.appendChild(hintsMount);
  if (config.label === "Add") {
    attachDuplicateHints(textarea, hintsMount);
  }

  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className = "btn btn-sm btn-primary bulk-panel-submit";
  submitBtn.textContent = config.label;
  body.appendChild(submitBtn);

  const resultEl = document.createElement("div");
  resultEl.className = "bulk-add-result";
  body.appendChild(resultEl);

  toggleBtn.addEventListener("click", () => {
    body.hidden = !body.hidden;
  });

  submitBtn.addEventListener("click", () => {
    if (!textarea.value.trim()) return;
    const { summaryText } = config.onSubmit(textarea.value);
    resultEl.textContent = summaryText;
    textarea.value = "";
  });

  wrap.appendChild(body);
  return wrap;
}
