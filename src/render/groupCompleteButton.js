// @ts-check
/**
 * render/groupCompleteButton.js — shared, READ-ONLY progress-pie indicator for a Subject/Topic/
 * SubTopic accordion header, built once and reused identically by subjectView.js/topicView.js/
 * subTopicView.js (see css/style.css's .group-complete-indicator for the three visual states this
 * drives: 0% dashed ring, 1-99% conic-gradient pie + percentage text, 100% solid filled checkmark).
 * Purely a readout of data/group.js's derived completePercent — never settable by clicking it. A
 * question's own `done` flag only ever changes via that question's own Done button; nothing here
 * cascades a bulk edit onto any question.
 */

/** @returns {HTMLElement} */
export function createGroupCompleteButton() {
  const el = document.createElement("span");
  el.className = "group-complete-indicator";
  el.innerHTML = '<i class="fa-solid fa-check"></i><span class="group-complete-pct"></span>';
  return el;
}

/**
 * @param {Element|null} el
 * @param {number} percent 0-100, from data/group.js's derived completePercent.
 * @param {number} [doneCount] Raw count behind percent (data/group.js's doneCount) — Not Important
 *   questions already excluded. Omit to fall back to the plain "Z% done" title (e.g. call sites that
 *   haven't been updated yet).
 * @param {number} [totalCount] Raw count behind percent (data/group.js's totalCount).
 * @param {number} [ignoredCount] Not Important questions excluded from the percentage above (data/
 *   group.js's ignoredCount) — called out in the title so it's clear why the fraction isn't out of
 *   every question in scope.
 * @param {string} [unitLabel] What doneCount/totalCount are counting — "questions" for every level
 *   (Subject/Topic/SubTopic all share the same Not-Important-excluded question-based basis).
 */
export function patchGroupCompleteButton(el, percent, doneCount, totalCount, ignoredCount, unitLabel = "questions") {
  if (!el) return;
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  el.classList.toggle("is-complete", clamped >= 100);
  el.classList.toggle("is-partial", clamped > 0 && clamped < 100);
  /** @type {HTMLElement} */ (el).style.setProperty("--pct", String(clamped));
  let title = `${clamped}% done`;
  if (totalCount != null && doneCount != null) {
    title = `Done: ${doneCount} of ${totalCount} ${unitLabel} (${clamped}%)`;
    if (ignoredCount) title += ` — ${ignoredCount} Not Important ignored`;
  }
  el.setAttribute("title", title);
  const pctText = el.querySelector(".group-complete-pct");
  if (pctText) pctText.textContent = clamped > 0 && clamped < 100 ? `${clamped}%` : "";
}
