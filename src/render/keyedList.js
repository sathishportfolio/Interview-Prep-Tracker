// @ts-check
/**
 * render/keyedList.js — generic keyed-diff/patch primitive, reused at every tree level (Subject/
 * Topic/SubTopic/Question lists). Classic keyed reconciliation (same class of algorithm as React/
 * Vue's keyed lists, no VDOM): index existing DOM children by key, reuse+patch matching keys in
 * place (preserving scroll/focus/open state for free), compute the LIS of retained positions to
 * minimize insertBefore calls, remove stale keys last.
 *
 * This module is the ONLY place that does raw DOM child list manipulation for tree nodes — every
 * node-view create/patch function funnels through here rather than hand-rolling insert/remove.
 */

/**
 * @template T
 * @param {HTMLElement} container Parent whose direct children are the keyed list (only tracks
 *   children carrying a `data-key` attribute — safe to co-locate with other non-keyed children).
 * @param {T[]} items
 * @param {(item: T) => string} getKey
 * @param {(item: T) => HTMLElement} createFn Called for a brand-new key. Must set `data-key`.
 * @param {(el: HTMLElement, item: T) => void} patchFn Called for an existing key with new data.
 */
export function reconcileKeyedList(container, items, getKey, createFn, patchFn) {
  const newKeys = items.map(getKey);

  /** @type {Map<string, HTMLElement>} */
  const existingByKey = new Map();
  for (const child of Array.from(container.children)) {
    const key = /** @type {HTMLElement} */ (child).dataset?.key;
    if (key) existingByKey.set(key, /** @type {HTMLElement} */ (child));
  }

  // Patch/create every item's element first (without touching DOM order yet).
  /** @type {HTMLElement[]} */
  const elements = items.map((item, i) => {
    const key = newKeys[i];
    let el = existingByKey.get(key);
    if (el) {
      patchFn(el, item);
    } else {
      el = createFn(item);
      el.dataset.key = key;
    }
    return el;
  });

  // Determine which retained (previously-existing) elements are already in relative order via LIS
  // over their CURRENT DOM position, to minimize insertBefore calls.
  const currentOrder = Array.from(container.children).filter(
    (c) => /** @type {HTMLElement} */ (c).dataset?.key
  );
  const currentIndexByKey = new Map(
    currentOrder.map((el, i) => [/** @type {HTMLElement} */ (el).dataset.key, i])
  );

  // Sequence of current-positions for keys that already existed, in NEW order.
  /** @type {number[]} */
  const seq = [];
  /** @type {number[]} */
  const seqToNewIndex = [];
  newKeys.forEach((key, newIndex) => {
    if (currentIndexByKey.has(key)) {
      seq.push(/** @type {number} */ (currentIndexByKey.get(key)));
      seqToNewIndex.push(newIndex);
    }
  });
  const lisIndices = longestIncreasingSubsequence(seq); // indices into `seq`
  const keepInPlace = new Set(lisIndices.map((i) => newKeys[seqToNewIndex[i]]));

  // Walk new order back-to-front, inserting anything not "keep in place" before its successor.
  let anchor = null;
  for (let i = items.length - 1; i >= 0; i--) {
    const key = newKeys[i];
    const el = elements[i];
    if (keepInPlace.has(key)) {
      anchor = el;
      continue;
    }
    if (anchor) {
      container.insertBefore(el, anchor);
    } else {
      container.appendChild(el);
    }
    anchor = el;
  }

  // Remove stale keys last.
  for (const [key, el] of existingByKey) {
    if (!newKeys.includes(key)) {
      el.remove();
    }
  }
}

/**
 * Standard patience-style LIS, returning INDICES into `arr` forming a longest strictly-increasing
 * subsequence.
 * @param {number[]} arr
 * @returns {number[]}
 */
function longestIncreasingSubsequence(arr) {
  if (arr.length === 0) return [];
  const tails = []; // indices into arr, tails[k] = index of smallest tail value of an increasing subsequence of length k+1
  const prev = new Array(arr.length).fill(-1);

  for (let i = 0; i < arr.length; i++) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[tails[mid]] < arr[i]) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1];
    if (lo === tails.length) tails.push(i);
    else tails[lo] = i;
  }

  const result = [];
  let k = tails[tails.length - 1];
  while (k !== -1) {
    result.push(k);
    k = prev[k];
  }
  return result.reverse();
}

export { longestIncreasingSubsequence };
