// @ts-check
/**
 * sync/manualPush.js — Manual Push button: force an on-demand push of every locally-loaded file's
 * bin(s) to the cloud. The app deliberately does not push automatically on every edit (JSONBin's
 * free tier has tight request-rate and bin-size limits) — local edits stay local until the user
 * explicitly pushes, mirroring manualPull.js on the read side.
 */
import { appState } from "../state/appState.js";
import { confirmAction, showToast } from "../features/toast.js";
import * as bins from "./bins.js";

/**
 * @returns {Promise<{ok: boolean, usage?: {percent: number, overCap: boolean}}>}
 */
export async function manualPush() {
  if (!appState.sync || !appState.sync.masterKey || !appState.sync.defaultBinId) {
    showToast("Set up Cross-Device Sync first.", "error");
    return { ok: false };
  }
  if (!confirmAction("Push local changes to the cloud now?")) {
    return { ok: false };
  }
  const pushed = await bins.pushAllLocalBins();
  if (!pushed) {
    showToast("Push failed or nothing to push.", "error");
    return { ok: false };
  }

  const usage = await bins.computeDefaultBinUsage();

  showToast("Pushed local changes to the cloud.", "success");
  return { ok: true, usage };
}
