// @ts-check
/**
 * sync/manualPull.js — Manual Pull button: force an on-demand refresh of the current bin from the
 * cloud, with a confirmation prompt since it overwrites matching local files.
 */
import { appState } from "../state/appState.js";
import { confirmAction, showToast } from "../features/toast.js";
import * as bins from "./bins.js";

/**
 * @returns {Promise<{ok: boolean}>}
 */
export async function manualPull() {
  if (!appState.sync || !appState.sync.masterKey || !appState.sync.currentBinId) {
    showToast("Set up Cross-Device Sync first.", "error");
    return { ok: false };
  }
  if (!confirmAction("Pull the current bin from the cloud now? Matching local files will be overwritten with the cloud version.")) {
    return { ok: false };
  }
  const result = await bins.pullBinIntoLocalState(appState.sync.currentBinId);
  if (!result.ok) {
    showToast(result.error || "Pull failed or nothing to pull.", "error");
    return { ok: false };
  }
  showToast("Pulled latest data from the cloud.", "success");
  return { ok: true };
}
