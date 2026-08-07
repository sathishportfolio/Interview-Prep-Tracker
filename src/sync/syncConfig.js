// @ts-check
/**
 * sync/syncConfig.js — Cross-Device Sync setup: mandatory first-run prompt for a JSONBin Master
 * Key + Bin ID (opens the JSONBin site to help), persisted via persistence/store.js.
 */
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { promptAction } from "../features/toast.js";

/** @returns {boolean} true if masterKey + binId are both configured */
export function isSyncConfigured() {
  return !!(appState.sync && appState.sync.masterKey && appState.sync.binId);
}

/** Loads sync config into appState (called at bootstrap). */
export function loadSyncConfig(schemaSync) {
  appState.sync = schemaSync;
}

/** Opens the mandatory first-run setup prompts. Returns true if the user completed setup. */
export function runFirstTimeSetup() {
  window.open("https://jsonbin.io", "_blank");
  const masterKey = promptAction("Enter your JSONBin.io Master Key:");
  if (!masterKey) return false;
  const binId = promptAction("Enter your JSONBin.io Bin ID:");
  if (!binId) return false;
  appState.sync = { ...appState.sync, masterKey, binId };
  store.writeSync(appState.sync);
  return true;
}

export function clearSyncConfig() {
  appState.sync = { masterKey: null, binId: null, lastPushAt: null, lastPullAt: null, lastKnownRemoteUpdatedAt: null };
  store.writeSync(appState.sync);
}
