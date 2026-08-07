// @ts-check
/**
 * sync/autoPush.js — every local change is pushed to the sync bin in the background after a short
 * debounce, with no interruption to the user's work. Subscribes to persistence/store.js's
 * "iqv:persisted" DOM event (the explicit hook, per the plan — not a monkey-patched
 * localStorage.setItem).
 */
import { gzipToBase64 } from "./gzip.js";
import { pushToBin, usageAgainstFreeTierCap } from "./jsonbin.js";
import { appState } from "../state/appState.js";

const DEBOUNCE_MS = 1500;
let debounceHandle = null;
let onUsageUpdate = null;

/** @param {(usage: {percent: number, overCap: boolean}) => void} callback */
export function initAutoPush(callback) {
  onUsageUpdate = callback;
  document.addEventListener("iqv:persisted", (e) => {
    if (!appState.sync || !appState.sync.masterKey || !appState.sync.binId) return;
    if (appState.toggles.tempMode) return; // temp mode never syncs
    if (debounceHandle) clearTimeout(debounceHandle);
    debounceHandle = setTimeout(() => doPush(/** @type {any} */ (e).detail.schema), DEBOUNCE_MS);
  });
}

/** @param {any} schema */
async function doPush(schema) {
  const json = JSON.stringify(schema);
  const compressed = await gzipToBase64(json);
  const usage = usageAgainstFreeTierCap(compressed.length);
  if (onUsageUpdate) onUsageUpdate(usage);

  const result = await pushToBin({
    masterKey: /** @type {string} */ (appState.sync.masterKey),
    binId: /** @type {string} */ (appState.sync.binId),
    payload: compressed,
  });
  if (result.ok) {
    // Deliberately kept in-memory only (not re-persisted via store.writeSync here) — writing back
    // through store.js would re-dispatch "iqv:persisted" and re-trigger this very push handler,
    // an infinite feedback loop. These timestamps are session-scoped bookkeeping for the usage
    // badge; the next real settings change persists sync config properly.
    appState.sync = { ...appState.sync, lastPushAt: Date.now(), lastKnownRemoteUpdatedAt: Date.now() };
  }
}
