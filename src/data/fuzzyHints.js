// @ts-check
/**
 * fuzzyHints.js — duplicate-detection fuzzy matching for a draft (in-progress) question, used by
 * Quick Add / Bulk Add's "you may already have this" hints AND "Copy and search for duplicates".
 * Zero DOM.
 * @typedef {import('../types.js').Question} Question
 */

/**
 * Common English function words (articles, prepositions, auxiliaries, interrogatives, etc.) that
 * show up in almost every question regardless of topic — left unfiltered they dominate the
 * Jaccard word-overlap score and produce irrelevant matches ("what is X" vs "what is Y").
 * Combined with a short-word length cutoff below, since most noise words are also short.
 */
const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "why", "how", "what", "when", "where", "which", "who", "whom", "whose",
  "this", "that", "these", "those", "there", "here",
  "do", "does", "did", "doing", "done",
  "of", "to", "in", "on", "at", "by", "for", "with", "from", "as", "into", "onto", "about",
  "and", "or", "but", "if", "so", "than", "then",
  "you", "your", "yours", "it", "its", "they", "them", "their",
  "can", "could", "should", "would", "will", "shall", "may", "might", "must",
  "not", "no", "yes", "also", "just", "any", "all", "some",
]);

/** @param {string} s @returns {string} */
function normalize(s) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * @param {string} s
 * @param {boolean} ignoreCommonWords Drop stopwords + words of length <=3 (almost always noise:
 *   articles, short prepositions, pronouns) so similarity reflects the meaningful/topical words.
 * @returns {Set<string>}
 */
function wordSet(s, ignoreCommonWords) {
  const words = normalize(s).split(/[^a-z0-9]+/).filter(Boolean);
  const kept = ignoreCommonWords ? words.filter((w) => w.length > 3 && !STOPWORDS.has(w)) : words;
  return new Set(kept);
}

/**
 * Jaccard similarity of word sets — simple, dependency-free fuzzy match good enough for
 * "you may already have this" hints (not meant to be a full fuzzy-search library).
 * @param {string} a
 * @param {string} b
 * @param {boolean} [ignoreCommonWords]
 * @returns {number} 0..1
 */
export function similarity(a, b, ignoreCommonWords = true) {
  const wa = wordSet(a, ignoreCommonWords);
  const wb = wordSet(b, ignoreCommonWords);
  if (wa.size === 0 || wb.size === 0) return 0;
  let intersection = 0;
  for (const w of wa) if (wb.has(w)) intersection += 1;
  const union = wa.size + wb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** @param {string} a @param {string} b @param {boolean} ignoreCommonWords @returns {number} count of shared words */
function wordOverlapCount(a, b, ignoreCommonWords) {
  const wa = wordSet(a, ignoreCommonWords);
  const wb = wordSet(b, ignoreCommonWords);
  let n = 0;
  for (const w of wa) if (wb.has(w)) n += 1;
  return n;
}

/**
 * @typedef {Object} FuzzyHintGroup
 * @property {string} subject
 * @property {string} topic
 * @property {string} subTopic
 * @property {Array<{question: Question, isExactMatch: boolean, score: number, matchCount: number}>} items
 * @property {boolean} autoExpand
 */

const SIMILARITY_THRESHOLD = 0.35;

/**
 * @param {Question[]} rawData Full unfiltered set to search against.
 * @param {string} draftText
 * @param {{ignoreCommonWords?: boolean}} [options]
 * @returns {FuzzyHintGroup[]}
 */
export function findDuplicateHints(rawData, draftText, options = {}) {
  const ignoreCommonWords = options.ignoreCommonWords !== false;
  const draftNorm = normalize(draftText);
  if (!draftNorm) return [];

  /** @type {Map<string, FuzzyHintGroup>} */
  const groups = new Map();

  for (const q of rawData) {
    const isExactMatch = normalize(q.question) === draftNorm;
    const score = isExactMatch ? 1 : similarity(q.question, draftText, ignoreCommonWords);
    if (!isExactMatch && score < SIMILARITY_THRESHOLD) continue;
    const matchCount = isExactMatch ? Infinity : wordOverlapCount(q.question, draftText, ignoreCommonWords);

    const key = `${q.subject}::${q.topic}::${q.subTopic}`;
    if (!groups.has(key)) {
      groups.set(key, { subject: q.subject, topic: q.topic, subTopic: q.subTopic, items: [], autoExpand: false });
    }
    const group = /** @type {FuzzyHintGroup} */ (groups.get(key));
    group.items.push({ question: q, isExactMatch, score, matchCount });
    if (isExactMatch) group.autoExpand = true;
  }

  // Exact match first, then by raw shared-word count, then by Jaccard score as a final tie-break.
  const byRelevance = (a, b) => Number(b.isExactMatch) - Number(a.isExactMatch) || b.matchCount - a.matchCount || b.score - a.score;

  return [...groups.values()]
    .map((g) => ({ ...g, items: g.items.sort(byRelevance) }))
    .sort((a, b) => Number(b.autoExpand) - Number(a.autoExpand) || b.items.length - a.items.length);
}
