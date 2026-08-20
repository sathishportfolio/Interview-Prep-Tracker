// @ts-check
/**
 * data/syncMerge.js — pure per-question "last write wins" merge with delete tombstones, used by
 * sync/gists.js on pull instead of wholesale-replacing a file's rawData. Zero DOM/persistence, so
 * it's independently unit-testable under `node --test` (see syncMerge.test.js).
 * @typedef {import('../types.js').Question} Question
 * @typedef {import('../types.js').Tombstone} Tombstone
 */

/** @param {Question} q @returns {number} */
function questionTimestamp(q) {
  return q.updatedAt ?? 0;
}

/**
 * Merges one file's rawData+tombstones between two snapshots (typically "local" as `a` and "remote"
 * as `b`) by per-question last-write-wins, using tombstones to resolve delete-vs-edit conflicts:
 * a tombstone newer than the other side's still-alive copy means the delete wins (stays deleted); an
 * alive copy newer than a tombstone means it was edited elsewhere after the delete propagated, so it
 * wins and un-deletes. An id present on only one side is included as-is (nothing to compare against).
 *
 * Tie-break (both sides have a candidate with the exact same timestamp): prefer "alive" over "dead"
 * so an exact tie never silently loses data, then prefer side `a` — arbitrary but deterministic, and
 * `a` is conventionally "local" at the sync/gists.js call site, so an unresolvable tie keeps what's
 * already here rather than pulling in a change that looks identical in age.
 * @param {{rawData: Question[], tombstones: Tombstone[]}} a
 * @param {{rawData: Question[], tombstones: Tombstone[]}} b
 * @returns {{rawData: Question[], tombstones: Tombstone[]}}
 */
export function mergeRawData(a, b) {
  const aQuestions = new Map(a.rawData.map((q) => [q.id, q]));
  const bQuestions = new Map(b.rawData.map((q) => [q.id, q]));
  const aTombstones = new Map(a.tombstones.map((t) => [t.id, t]));
  const bTombstones = new Map(b.tombstones.map((t) => [t.id, t]));

  const allIds = new Set([...aQuestions.keys(), ...bQuestions.keys(), ...aTombstones.keys(), ...bTombstones.keys()]);

  /** @type {Question[]} */
  const rawData = [];
  /** @type {Tombstone[]} */
  const tombstones = [];

  for (const id of allIds) {
    /** @type {Array<{kind: "alive"|"dead", side: "a"|"b", at: number, question?: Question, tombstone?: Tombstone}>} */
    const candidates = [];
    const aQ = aQuestions.get(id);
    const bQ = bQuestions.get(id);
    const aT = aTombstones.get(id);
    const bT = bTombstones.get(id);
    if (aQ) candidates.push({ kind: "alive", side: "a", at: questionTimestamp(aQ), question: aQ });
    if (bQ) candidates.push({ kind: "alive", side: "b", at: questionTimestamp(bQ), question: bQ });
    if (aT) candidates.push({ kind: "dead", side: "a", at: aT.deletedAt, tombstone: aT });
    if (bT) candidates.push({ kind: "dead", side: "b", at: bT.deletedAt, tombstone: bT });

    candidates.sort((x, y) => {
      if (y.at !== x.at) return y.at - x.at;
      if (x.kind !== y.kind) return x.kind === "alive" ? -1 : 1;
      return x.side === "a" ? -1 : 1;
    });

    const winner = candidates[0];
    if (winner.kind === "alive") rawData.push(/** @type {Question} */ (winner.question));
    else tombstones.push(/** @type {Tombstone} */ (winner.tombstone));
  }

  return { rawData, tombstones };
}
