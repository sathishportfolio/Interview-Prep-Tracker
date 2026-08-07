// @ts-check
/**
 * sync/autoPull.js — each time the app starts, silently checks the default bin for newer data and
 * reloads if anything differs. Peeks via bins.pullBinRaw (which also fetches the payload — JSONBin
 * has no lightweight "just the timestamp" endpoint) and only applies it to local state if the
 * bin's updatedAt is actually newer than the last-seen one.
 */
import { appState } from "../state/appState.js";
import * as bins from "./bins.js";

/**
 * @returns {Promise<{changed: boolean}>}
 */
export async function checkAndPullIfNewer() {
  const defaultBinId = appState.sync && appState.sync.defaultBinId;
  if (!appState.sync || !appState.sync.masterKey || !defaultBinId) return { changed: false };

  const remote = await bins.pullBinRaw(defaultBinId);
  if (!remote.ok || !remote.files.length) return { changed: false };

  if (appState.sync.lastKnownRemoteUpdatedAt && remote.updatedAt && remote.updatedAt <= appState.sync.lastKnownRemoteUpdatedAt) {
    return { changed: false };
  }

  bins.applyBinToLocalState(defaultBinId, remote);
  return { changed: true };
}
