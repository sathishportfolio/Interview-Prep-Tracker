// @ts-check
/**
 * sync/manualPull.js — Manual Pull button: force an on-demand refresh from the cloud, with a
 * confirmation prompt since it overwrites matching local files. Pull stays manual-only even though
 * push is now automatic (see autoPush.js) — auto-pulling over unsaved local edits is a conflict risk
 * not worth taking on.
 */
import { appState } from "../state/appState.js";
import { confirmAction, showToast } from "../features/toast.js";
import * as gists from "./gists.js";

/**
 * @returns {Promise<{ok: boolean}>}
 */
export async function manualPull() {
  if (!appState.sync || !appState.sync.githubToken || !appState.sync.configGistId) {
    showToast("Set up Cross-Device Sync first.", "error");
    return { ok: false };
  }
  if (!confirmAction("Pull the latest data from the cloud now? Matching local files will be overwritten with the cloud version.")) {
    return { ok: false };
  }
  const result = await gists.pullAllFiles();
  if (!result.ok) {
    showToast(result.error || "Pull failed.", "error");
    return { ok: false };
  }
  if (result.failures && result.failures.length > 0) {
    showToast(`Pulled with ${result.failures.length} file(s) failing — see console for details.`, "error");
  } else {
    showToast("Pulled latest data from the cloud.", "success");
  }
  return { ok: true };
}
