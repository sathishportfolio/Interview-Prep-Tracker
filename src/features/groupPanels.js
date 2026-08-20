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
import * as reorderModeFeature from "./reorderMode.js";
import { appState } from "../state/appState.js";

/** @param {"subject"|"topic"|"subTopic"|"root"} level @returns {"subject"|"topic"|"subTopic"|"question"} */
function childLevelFor(level) {
  return level === "root" ? "subject" : level === "subject" ? "topic" : level === "topic" ? "subTopic" : "question";
}

/** @param {"subject"|"topic"|"subTopic"|"root"} level @param {{subject?: string, topic?: string, subTopic?: string}} scope */
function parentScopeFor(level, scope) {
  if (level === "root") return {};
  if (level === "subject") return { subject: scope.subject };
  if (level === "topic") return { subject: scope.subject, topic: scope.topic };
  return { subject: scope.subject, topic: scope.topic, subTopic: scope.subTopic };
}

/** @param {{subject?: string, topic?: string, subTopic?: string}} a @param {{subject?: string, topic?: string, subTopic?: string}} b */
function sameScope(a, b) {
  return a.subject === b.subject && a.topic === b.topic && a.subTopic === b.subTopic;
}

/**
 * Reorder button lives inline with the rest of this level's panel controls (see mountGroupPanels)
 * and toggles between "start a Reorder session for this level's own direct children" and, once a
 * matching session is active, "Commit (n)" — click sequence numbering shows up as badges on the
 * eligible child accordions themselves (see render/nodeViews/*'s reorder-badge). Runs on every call
 * (unlike the rest of this mount, which is idempotent after first paint) so its label stays live as
 * selections change elsewhere in the tree.
 * @param {"subject"|"topic"|"subTopic"|"root"} level
 * @param {{subject?: string, topic?: string, subTopic?: string}} scope
 * @param {HTMLElement} mountEl
 */
function mountReorderButton(level, scope, mountEl) {
  const childLevel = childLevelFor(level);
  const parentScope = parentScopeFor(level, scope);
  let btn = /** @type {HTMLButtonElement|null} */ (mountEl.querySelector(":scope > .reorder-trigger-btn"));
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-sm btn-outline-secondary reorder-trigger-btn edit-gated";
    btn.addEventListener("click", () => {
      const mode = appState.reorderMode;
      const isThisSession = !!mode && mode.childLevel === childLevel && sameScope(mode.parentScope, parentScope);
      if (isThisSession) reorderModeFeature.commitReorder();
      else reorderModeFeature.enterReorderMode(childLevel, parentScope);
    });
    mountEl.appendChild(btn);
  }
  const mode = appState.reorderMode;
  const isThisSession = !!mode && mode.childLevel === childLevel && sameScope(mode.parentScope, parentScope);
  const childLabel = childLevel === "subTopic" ? "SubTopics" : childLevel === "question" ? "Questions" : childLevel === "topic" ? "Topics" : "Subjects";
  btn.textContent = isThisSession ? `Commit Reorder (${mode.selections.length})` : `Reorder ${childLabel}`;
  btn.title = isThisSession ? "Click the accordions below in your desired order, then click here to commit" : `Number these ${childLabel} in a new order by clicking them, then commit`;
  btn.classList.toggle("active", isThisSession);
  // A DIFFERENT level/scope's session is active — this button's own action would be ignored (see
  // features/reorderMode.js's selectForReorder no-op guard), so disable it to avoid a confusing click.
  btn.disabled = !!mode && !isThisSession;
}

/**
 * @param {"subject"|"topic"|"subTopic"|"root"} level
 * @param {{subject?: string, topic?: string, subTopic?: string}} scope
 * @param {HTMLElement} mountEl
 */
export function mountGroupPanels(level, scope, mountEl) {
  mountReorderButton(level, scope, mountEl);
  if (mountEl.dataset.panelsMounted) return; // idempotent — don't clobber open panels on re-render
  mountEl.dataset.panelsMounted = "1";

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
