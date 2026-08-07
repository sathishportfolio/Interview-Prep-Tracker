// @ts-check
/**
 * sync/autoPush.js — every local change is pushed to the cloud in the background after a short
 * debounce, with no interruption to the user's work. Subscribes to persistence/store.js's
 * "iqv:persisted" DOM event (the explicit hook, per the plan — not a monkey-patched
 * localStorage.setItem). Delegates the actual per-bin read-merge-write to sync/bins.js, since a
 * device's locally-loaded files can be spread across more than one bin.
 */
import { appState } from "../state/appState.js";
import * as bins from "./bins.js";
import { gzipToBase64 } from "./gzip.js";
import { usageAgainstFreeTierCap } from "./jsonbin.js";

const DEBOUNCE_MS = 1500;
let debounceHandle = null;
let onUsageUpdate = null;
let onPushed = null;

/**
 * @param {(usage: {percent: number, overCap: boolean}) => void} callback Fires after each push
 *   attempt with the default bin's usage against the free-tier cap.
 * @param {() => void} [pushedCallback] Called after each successful push round (e.g. to refresh a
 *   "last synced" label) — separate from `callback`, which fires regardless of success.
 */
export function initAutoPush(callback, pushedCallback) {
  onUsageUpdate = callback;
  onPushed = pushedCallback || null;
  document.addEventListener("iqv:persisted", () => {
    if (!appState.sync || !appState.sync.masterKey || !appState.sync.defaultBinId) return;
    if (appState.toggles.tempMode) return; // temp mode never syncs
    if (debounceHandle) clearTimeout(debounceHandle);
    debounceHandle = setTimeout(doPush, DEBOUNCE_MS);
  });
}

async function doPush() {
  const pushed = await bins.pushAllLocalBins();

  // Usage is reported against the default bin specifically (the one most users will fill up)
  // rather than any override bins, which exist precisely to stay small.
  const defaultBinId = appState.sync.defaultBinId;
  const defaultBinFiles = defaultBinId ? bins.groupLocalFilesByBin().get(defaultBinId) || [] : [];
  const compressed = await gzipToBase64(JSON.stringify({ files: defaultBinFiles }));
  const usage = usageAgainstFreeTierCap(compressed.length);
  if (onUsageUpdate) onUsageUpdate(usage);

  if (pushed && onPushed) onPushed();
}
