// @ts-check
/**
 * data/relativeTime.js — human-readable "time ago" formatting for a Date.now()-based timestamp
 * (e.g. Question.updatedAt). Pure, zero DOM.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * Compact age label — sized to sit inline next to an icon without crowding the row.
 * @param {number} ts Date.now()-based timestamp.
 * @param {number} [now] Injectable for tests; defaults to Date.now().
 * @returns {string} "Just now", "N min", "N hr", "N day", "N mon", or "N yr".
 */
export function formatRelativeTime(ts, now = Date.now()) {
  const diff = Math.max(0, now - ts);
  if (diff < MINUTE) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} hr`;
  if (diff < MONTH) return `${Math.floor(diff / DAY)} day`;
  if (diff < YEAR) return `${Math.floor(diff / MONTH)} mon`;
  return `${Math.floor(diff / YEAR)} yr`;
}
