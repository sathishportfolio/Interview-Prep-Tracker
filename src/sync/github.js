// @ts-check
/**
 * sync/github.js — thin fetch wrapper around the GitHub Gist REST API. No app-specific logic here
 * (that's manualPush.js/manualPull.js/autoPush.js/gists.js); this module just knows how to
 * create/PATCH/GET a gist. There's no whole-gist DELETE — the app only ever deletes individual FILES
 * within the shared sync gist (PATCH with a file value of `null`), never the gist itself.
 */

const API_BASE = "https://api.github.com/gists";
// Not a hard cap like JSONBin's — Gist has no documented per-file byte limit, but files over ~1MB
// are known to be unreliable via the web UI/API, so this is informational guidance only.
const SAFE_FILE_BYTES = 1024 * 1024;

/** @param {string} token */
function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

/**
 * Builds a diagnosable error string from a failed response — GitHub's error bodies carry a
 * `message` field (e.g. "Not Found", "Bad credentials") that's far more useful than a bare status
 * code when a pull silently comes back empty and this is the only clue why.
 * @param {string} label
 * @param {Response} res
 * @returns {Promise<string>}
 */
async function describeError(label, res) {
  try {
    const body = await res.json();
    if (body && body.message) return `${label} failed: ${res.status} ${body.message}`;
  } catch {
    // body wasn't JSON (or was empty) — fall through to the status-only message
  }
  return `${label} failed: ${res.status}`;
}

/**
 * @param {{token: string, files: Record<string, {content: string}>, description?: string}} config
 * @returns {Promise<{ok: true, gistId: string} | {ok: false, error: string}>}
 */
export async function createGist({ token, files, description }) {
  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ description: description || "", public: false, files }),
    });
    if (!res.ok) return { ok: false, error: await describeError("Gist create", res) };
    const json = await res.json();
    if (!json.id) return { ok: false, error: "Gist create: no gist id returned" };
    return { ok: true, gistId: json.id };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * @param {{token: string, gistId: string, files: Record<string, {content: string}|null>}} config A
 *   file value of `null` deletes that file from the gist (the Gist API's own convention for PATCH).
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function pushToGist({ token, gistId, files }) {
  try {
    const res = await fetch(`${API_BASE}/${gistId}`, {
      method: "PATCH",
      headers: headers(token),
      body: JSON.stringify({ files }),
    });
    if (!res.ok) return { ok: false, error: await describeError("Gist push", res) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * @param {{token: string, gistId: string}} config
 * @returns {Promise<{ok: true, files: Record<string, {content: string}>, updatedAt: number|null} | {ok: false, error: string}>}
 */
export async function pullFromGist({ token, gistId }) {
  try {
    const res = await fetch(`${API_BASE}/${gistId}`, { headers: headers(token) });
    if (!res.ok) return { ok: false, error: await describeError("Gist pull", res) };
    const json = await res.json();
    /** @type {Record<string, {content: string}>} */
    const files = {};
    for (const [name, f] of Object.entries(json.files || {})) {
      files[name] = { content: /** @type {any} */ (f).content || "" };
    }
    const updatedAt = json.updated_at ? Date.parse(json.updated_at) : null;
    return { ok: true, files, updatedAt: Number.isFinite(updatedAt) ? updatedAt : null };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * @param {number} byteLength
 * @returns {{percent: number, overCap: boolean}}
 */
export function usageAgainstSafeCeiling(byteLength) {
  const percent = Math.round((byteLength / SAFE_FILE_BYTES) * 100);
  return { percent, overCap: percent >= 90 };
}
