// @ts-check
/**
 * sync/jsonbin.js — thin fetch wrapper around the JSONBin.io REST API. No app-specific logic here
 * (that's manualPush.js/manualPull.js/autoPush.js/bins.js); this module just knows how to PUT/GET a
 * bin.
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
 * Creates a brand-new bin (JSONBin has no separate "create empty bin" call — a bin is created by
 * its first PUT-equivalent write, via POST with no id in the URL). Used by the Sync Manager's
 * "+ New Bin" action.
 * @param {{masterKey: string, payload: string, label?: string}} config
 * @returns {Promise<{ok: true, binId: string} | {ok: false, error: string}>}
 */
export async function createBin({ masterKey, payload, label }) {
  try {
    const headers = { "Content-Type": "application/json", "X-Master-Key": masterKey };
    if (label) headers["X-Bin-Name"] = label;
    const res = await fetch(API_BASE, {
      method: "POST",
      headers,
      body: JSON.stringify({ data: payload, updatedAt: Date.now() }),
    });
    if (!res.ok) return { ok: false, error: `JSONBin create failed: ${res.status}` };
    const json = await res.json();
    const binId = json?.metadata?.id;
    if (!binId) return { ok: false, error: "JSONBin create: no bin id returned" };
    return { ok: true, binId };
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
