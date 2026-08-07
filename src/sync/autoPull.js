// @ts-check
/**
 * sync/autoPull.js — each time the app starts, silently checks the cloud for newer data and
 * reloads if anything differs.
 */
import { pullFromBin } from "./jsonbin.js";
import { gunzipFromBase64 } from "./gzip.js";
import { appState } from "../state/appState.js";
import { coerceSchema } from "../persistence/schema.js";
import * as store from "../persistence/store.js";

/**
 * @returns {Promise<{changed: boolean, schema?: any}>}
 */
export async function checkAndPullIfNewer() {
  if (!appState.sync || !appState.sync.masterKey || !appState.sync.binId) return { changed: false };
  const result = await pullFromBin({ masterKey: appState.sync.masterKey, binId: appState.sync.binId });
  if (!result.ok) return { changed: false };
  if (!result.payload) return { changed: false };

  if (appState.sync.lastKnownRemoteUpdatedAt && result.updatedAt && result.updatedAt <= appState.sync.lastKnownRemoteUpdatedAt) {
    return { changed: false };
  }

  try {
    const json = await gunzipFromBase64(result.payload);
    const schema = coerceSchema(JSON.parse(json));
    store.writeSchema(schema);
    appState.sync = { ...appState.sync, lastPullAt: Date.now(), lastKnownRemoteUpdatedAt: result.updatedAt };
    return { changed: true, schema };
  } catch {
    return { changed: false };
  }
}
