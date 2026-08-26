// @ts-check
/**
 * render/statusSummary.js — the small "Done 3 · Failed 1 · Review 2 ..." chip row shown at the
 * bottom of a Subject/Topic/SubTopic accordion body, summarizing every descendant question's status
 * flags in one glance. Render-only, no handlers — purely a readout, nothing here is clickable.
 * @typedef {import('../types.js').Question} Question
 */

/** @type {Array<{flag: "done"|"failed"|"reviewLater"|"starred"|"visited"|"notImportant", label: string, cssVar: string}>} */
const SUMMARY_ITEMS = [
  { flag: "done", label: "Done", cssVar: "--done" },
  { flag: "failed", label: "Failed", cssVar: "--failed" },
  { flag: "reviewLater", label: "Review", cssVar: "--review" },
  { flag: "starred", label: "Starred", cssVar: "--starred" },
  { flag: "visited", label: "Visited", cssVar: "--visited" },
  { flag: "notImportant", label: "Not Important", cssVar: "--not-important" },
];

/** @returns {HTMLElement} an empty shell — fill/refresh its counts via patchStatusSummary */
export function createStatusSummary() {
  const row = document.createElement("div");
  row.className = "status-summary-row";
  for (const { flag, label, cssVar } of SUMMARY_ITEMS) {
    const chip = document.createElement("span");
    chip.className = `status-summary-chip status-summary-${flag}`;
    chip.style.setProperty("--chip-color", `var(${cssVar})`);
    const dot = document.createElement("span");
    dot.className = "status-summary-dot";
    const text = document.createElement("span");
    text.className = "status-summary-text";
    chip.appendChild(dot);
    chip.appendChild(text);
    chip.title = label;
    row.appendChild(chip);
  }
  return row;
}

/**
 * Recomputes counts from `questions` and updates an existing createStatusSummary() element in place.
 * Chips with a zero count are hidden entirely (not just dimmed) to keep the row compact; the whole
 * row hides itself if every count is zero (nothing worth showing yet).
 * @param {HTMLElement} row
 * @param {Question[]} questions
 */
export function patchStatusSummary(row, questions) {
  let anyVisible = false;
  for (const { flag, label } of SUMMARY_ITEMS) {
    const count = questions.reduce((n, q) => n + (q[flag] ? 1 : 0), 0);
    const chip = /** @type {HTMLElement|null} */ (row.querySelector(`.status-summary-${flag}`));
    if (!chip) continue;
    chip.hidden = count === 0;
    if (count === 0) continue;
    anyVisible = true;
    const text = chip.querySelector(".status-summary-text");
    if (text) text.textContent = `${label} ${count}`;
  }
  row.hidden = !anyVisible;
}
