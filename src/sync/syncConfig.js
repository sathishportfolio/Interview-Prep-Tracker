// @ts-check
/**
 * sync/syncConfig.js — Cross-Device Sync setup: first-run form for a JSONBin Master Key + Bin ID
 * (with a link to the JSONBin site to help), persisted via persistence/store.js.
 *
 * A prior version used window.open() immediately followed by window.prompt(): opening the new
 * tab steals focus in most browsers, so the prompt() dialog fired on the now-backgrounded
 * original tab — invisible until the user manually switched back, which read as "nothing
 * happened" on click. Using an in-page modal instead avoids native-dialog/tab-focus interaction
 * entirely.
 */
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { showToast } from "../features/toast.js";
import { openModal } from "../features/modal.js";

/** @returns {boolean} true if masterKey + binId are both configured */
export function isSyncConfigured() {
  return !!(appState.sync && appState.sync.masterKey && appState.sync.binId);
}

/** Loads sync config into appState (called at bootstrap). */
export function loadSyncConfig(schemaSync) {
  appState.sync = schemaSync;
}

/** Opens the first-run setup form (Master Key + Bin ID). */
export function runFirstTimeSetup() {
  const wrap = document.createElement("div");

  const helpLink = document.createElement("a");
  helpLink.href = "https://jsonbin.io";
  helpLink.target = "_blank";
  helpLink.rel = "noopener noreferrer";
  helpLink.textContent = "Open JSONBin.io to get a Master Key + create a Bin ↗";
  helpLink.style.display = "block";
  helpLink.style.marginBottom = "0.6rem";

  const keyLabel = document.createElement("label");
  keyLabel.className = "form-label small text-muted";
  keyLabel.textContent = "Master Key";
  const keyInput = document.createElement("input");
  keyInput.type = "text";
  keyInput.className = "form-control form-control-sm";
  keyInput.style.marginBottom = "0.5rem";

  const binLabel = document.createElement("label");
  binLabel.className = "form-label small text-muted";
  binLabel.textContent = "Bin ID";
  const binInput = document.createElement("input");
  binInput.type = "text";
  binInput.className = "form-control form-control-sm";

  wrap.appendChild(helpLink);
  wrap.appendChild(keyLabel);
  wrap.appendChild(keyInput);
  wrap.appendChild(binLabel);
  wrap.appendChild(binInput);

  openModal({
    title: "Set up Cross-Device Sync",
    bodyEl: wrap,
    saveLabel: "Save",
    onSave: () => {
      const masterKey = keyInput.value.trim();
      const binId = binInput.value.trim();
      if (!masterKey || !binId) {
        showToast("Master Key and Bin ID are both required — sync not configured.", "error");
        return;
      }
      appState.sync = { ...appState.sync, masterKey, binId };
      store.writeSync(appState.sync);
      showToast("Sync configured.", "success");
    },
  });
}

export function clearSyncConfig() {
  appState.sync = { masterKey: null, binId: null, lastPushAt: null, lastPullAt: null, lastKnownRemoteUpdatedAt: null };
  store.writeSync(appState.sync);
}
