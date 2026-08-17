// @ts-check
/**
 * sync/manualPush.js — Manual Push button: force an on-demand push right now instead of waiting for
 * autoPush.js's debounce. Uses the same pushAllChangedFiles path autoPush.js uses, so a click here
 * and the automatic push behave identically.
 */
import { appState } from "../state/appState.js";
import { showToast } from "../features/toast.js";
import * as gists from "./gists.js";

/**
 * @returns {Promise<{ok: boolean}>}
 */
export async function manualPush() {
  if (!appState.sync || !appState.sync.githubToken) {
    showToast("Set up Cross-Device Sync first.", "error");
    return { ok: false };
  }
  if (appState.sync.pullOnly) {
    showToast("Pull Only is on — pushing is disabled. Turn it off in the Sync menu to push.", "error");
    return { ok: false };
  }
  const result = await gists.pushAllChangedFiles();
  if (!result.ok) {
    showToast(result.error || "Push failed.", "error");
    return { ok: false };
  }
  showToast(result.skipped ? "Already pushed latest changes." : "Pushed local changes to the cloud.", result.skipped ? "info" : "success");
  return { ok: true };
}
