// @ts-check
/**
 * sync/jsonbin.js — thin fetch wrapper around the JSONBin.io REST API. No app-specific logic here
 * (that's autoPush.js/autoPull.js/manualPull.js); this module just knows how to PUT/GET a bin.
 */

const API_BASE = "https://api.jsonbin.io/v3/b";
const FREE_TIER_CAP_BYTES = 100 * 1024;

/**
 * @param {{masterKey: string, binId: string, payload: string}} config
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function pushToBin({ masterKey, binId, payload }) {
  try {
    const res = await fetch(`${API_BASE}/${binId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": masterKey,
      },
      body: JSON.stringify({ data: payload, updatedAt: Date.now() }),
    });
    if (!res.ok) return { ok: false, error: `JSONBin push failed: ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * @param {{masterKey: string, binId: string}} config
 * @returns {Promise<{ok: true, payload: string, updatedAt: number|null} | {ok: false, error: string}>}
 */
export async function pullFromBin({ masterKey, binId }) {
  try {
    const res = await fetch(`${API_BASE}/${binId}/latest`, {
      headers: { "X-Master-Key": masterKey },
    });
    if (!res.ok) return { ok: false, error: `JSONBin pull failed: ${res.status}` };
    const json = await res.json();
    const record = json.record || {};
    return { ok: true, payload: record.data || "", updatedAt: record.updatedAt || null };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * @param {number} byteLength
 * @returns {{percent: number, overCap: boolean}}
 */
export function usageAgainstFreeTierCap(byteLength) {
  const percent = Math.round((byteLength / FREE_TIER_CAP_BYTES) * 100);
  return { percent, overCap: percent >= 90 };
}
