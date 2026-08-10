// @ts-check
/**
 * features/groupPanels.js — populates the "bulk-add-mount" placeholder each Subject/Topic/SubTopic
 * body reserves (render/nodeViews/*) with its Bulk Add / Bulk Update / Bulk Copy panels, scoped to
 * that node. Render creates the empty mount div as an explicit extension slot; this module is the
 * only thing that fills it, and only does so once per mount (idempotent) so re-renders don't wipe
 * an open panel's in-progress text.
 */
import { createBulkAddPanel } from "./bulkAdd.js";
import { createBulkUpdatePanel } from "./bulkUpdate.js";
import { bulkCopyScope } from "./bulkCopy.js";
import * as bulkSelection from "./bulkSelection.js";
import { mountBulkSelectMenu } from "./bulkSelectMenu.js";
import { quickAddQuestion } from "./quickAdd.js";

/**
 * @param {"subject"|"topic"|"subTopic"|"root"} level
 * @param {{subject?: string, topic?: string, subTopic?: string}} scope
 * @param {HTMLElement} mountEl
 */
export function mountGroupPanels(level, scope, mountEl) {
  if (mountEl.childElementCount > 0) return; // idempotent — don't clobber open panels on re-render

  const fixed = {
    fixedSubject: level === "root" ? null : scope.subject,
    fixedTopic: level === "subject" || level === "root" ? null : scope.topic,
    fixedSubTopic: level === "subTopic" ? scope.subTopic : null,
  };

  if (level === "subTopic") {
    const quickAddBtn = document.createElement("button");
    quickAddBtn.type = "button";
    quickAddBtn.className = "btn btn-sm btn-outline-primary";
    quickAddBtn.textContent = "+ Add Question";
    quickAddBtn.title = "Quick-add a single question to this SubTopic";
    quickAddBtn.addEventListener("click", () =>
      quickAddQuestion(/** @type {string} */ (scope.subject), /** @type {string} */ (scope.topic), /** @type {string} */ (scope.subTopic))
    );
    mountEl.appendChild(quickAddBtn);
  }

  mountEl.appendChild(createBulkAddPanel(fixed));
  mountEl.appendChild(createBulkUpdatePanel(fixed));

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "btn btn-sm btn-outline-secondary";
  copyBtn.textContent = "Bulk Copy (CSV)";
  copyBtn.addEventListener("click", () => bulkCopyScope(level === "root" ? undefined : scope));
  mountEl.appendChild(copyBtn);

  if (level === "root") {
    mountBulkSelectMenu(mountEl);
  } else {
    const selectAllBtn = document.createElement("button");
    selectAllBtn.type = "button";
    selectAllBtn.className = "btn btn-sm btn-outline-secondary";
    selectAllBtn.textContent = "Select All";
    selectAllBtn.title =
      level === "subject" ? "Select every Topic in this Subject" : level === "topic" ? "Select every SubTopic in this Topic" : "Select every Question in this SubTopic";
    selectAllBtn.addEventListener("click", () => bulkSelection.selectAllChildren(level, /** @type {{subject: string, topic?: string, subTopic?: string}} */ (scope)));
    mountEl.appendChild(selectAllBtn);
  }
}
