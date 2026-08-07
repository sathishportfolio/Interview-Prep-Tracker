// @ts-check
/**
 * features/bulkPanelUI.js — shared DOM builder for the "+ Bulk Add/Update/Copy (CSV)" panel shell,
 * reused at root/Subject/Topic/SubTopic level by bulkAdd.js/bulkUpdate.js/bulkCopy.js. Not part of
 * render/* (it's a one-off imperative panel, not part of the tree's keyed reconciliation), but kept
 * as a single shared builder so the three bulk features don't each hand-roll textarea+buttons.
 */
import { sampleBulkRow } from "../data/csv/bulkCsv.js";
import { attachDuplicateHints } from "./duplicateHints.js";

/**
 * @param {{
 *   label: string,
 *   toggleLabel: string,
 *   onSubmit: (text: string) => {summaryText: string},
 *   showSampleLink?: boolean,
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
      textarea.value = sampleBulkRow();
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
