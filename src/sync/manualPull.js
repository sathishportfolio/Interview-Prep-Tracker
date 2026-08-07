// @ts-check
/**
 * sync/manualPull.js — Manual Pull button: force an on-demand refresh from the cloud, with a
 * confirmation prompt since it overwrites local data.
 */
import { pullFromBin } from "./jsonbin.js";
import { gunzipFromBase64 } from "./gzip.js";
import { appState } from "../state/appState.js";
import { coerceSchema } from "../persistence/schema.js";
import * as store from "../persistence/store.js";
import { confirmAction, showToast } from "../features/toast.js";

/**
 * @returns {Promise<{ok: boolean, schema?: any}>}
 */
export async function manualPull() {
  if (!appState.sync || !appState.sync.masterKey || !appState.sync.binId) {
    showToast("Set up Cross-Device Sync first.", "error");
    return { ok: false };
  }
  if (!confirmAction("Pull from the cloud now? This will overwrite your local data with the cloud version.")) {
    return { ok: false };
  }
  const result = await pullFromBin({ masterKey: appState.sync.masterKey, binId: appState.sync.binId });
  if (!result.ok || !result.payload) {
    showToast("Pull failed or nothing to pull.", "error");
    return { ok: false };
  }
  try {
    const json = await gunzipFromBase64(result.payload);
    const schema = coerceSchema(JSON.parse(json));
    store.writeSchema(schema);
    appState.sync = { ...appState.sync, lastPullAt: Date.now(), lastKnownRemoteUpdatedAt: result.updatedAt };
    showToast("Pulled latest data from the cloud.", "success");
    return { ok: true, schema };
  } catch {
    showToast("Could not read cloud data.", "error");
    return { ok: false };
  }
}
