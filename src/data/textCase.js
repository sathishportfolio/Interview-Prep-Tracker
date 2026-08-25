// @ts-check
/**
 * data/textCase.js — Title Case normalization for Subject/Topic/SubTopic names (e.g. "spring
 * ecosystem" -> "Spring Ecosystem"). Applied at every point a name is newly typed/imported so
 * storage and retrieval always agree, rather than normalizing only at render time.
 */

/**
 * Capitalizes the first letter of every word, leaving the rest of each word untouched — so an
 * acronym typed/imported in full caps (e.g. "SQL", "OOP", "ST1") survives rather than getting
 * lowercased into "Sql"/"Oop"/"St1".
 * @param {string|undefined|null} value
 * @returns {string}
 */
export function toTitleCase(value) {
  return (value || "").replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}
