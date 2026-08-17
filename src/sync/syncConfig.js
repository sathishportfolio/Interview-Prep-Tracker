// @ts-check
/**
 * sync/syncConfig.js — Cross-Device Sync manager: a two-step setup wizard (GitHub token, then either
 * connect an existing sync gist or create a new one) plus, once configured, a per-file status list
 * (Download, Delete). "Connect existing" is the default step-2 mode, not "create new" — most people
 * setting this up on a second device already have a sync gist from the first one; creating a fresh
 * gist is one click away behind a link, not the other way around. There's no "move/copy file to
 * another location" concept here — every file always syncs to the same single shared gist
 * (SyncConfig.configGistId), so there's nowhere else to move it to. All actual reads/writes go
 * through sync/gists.js; this module is presentation only.
 *
 * A prior version used window.open() immediately followed by window.prompt(): opening the new tab
 * steals focus in most browsers, so the prompt() dialog fired on the now-backgrounded original tab
 * — invisible until the user manually switched back, which read as "nothing happened" on click.
 * Using an in-page modal instead avoids native-dialog/tab-focus interaction entirely.
 */
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { showToast, confirmAction } from "../features/toast.js";
import { openModal } from "../features/modal.js";
import * as fileManager from "../features/fileManager.js";
import * as gists from "./gists.js";

/** @type {(() => void)|null} Called after any action that changes local files/settings (create/connect/pull/delete/clear). */
let onSyncedDataChanged = null;

/** @param {{onSyncedDataChanged: () => void}} callbacks */
export function initSyncConfig(callbacks) {
  onSyncedDataChanged = callbacks.onSyncedDataChanged;
}

/** @returns {boolean} true if githubToken + configGistId are both configured */
export function isSyncConfigured() {
  return !!(appState.sync && appState.sync.githubToken && appState.sync.configGistId);
}

/**
 * Human-readable "last synced" label for the Manual Pull button, e.g. "5 min ago" — reflects when
 * the app-config gist's content itself was last updated (`lastKnownRemoteUpdatedAt`), not merely
 * when this device last talked to it: a push sets it to now (this device just wrote that value), a
 * pull sets it to the gist's own `updated_at` (which may be older, or newer if another device pushed
 * first) — so after pulling in a change from another device, the label reports when that change
 * actually landed, not when this device happened to fetch it.
 * @returns {string}
 */
export function lastSyncedLabel() {
  const ts = appState.sync?.lastKnownRemoteUpdatedAt || 0;
  if (!ts) return "Never synced";
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months !== 1 ? "s" : ""} ago`;
}

/**
 * "Synced at [Timestamp] from [activeDevice]" — the explicit, human-readable form (as opposed to
 * lastSyncedLabel's compact relative time) shown in the Sync menu detail row and in the page-load
 * toast (see app.js). `lastRemoteActiveDevice`/`lastRemoteUpdateTimestamp` are set by BOTH directions
 * of sync (see sync/gists.js's pushAllChangedFiles and applyRemotePullResult) — a push records this
 * device as the last to sync, a pull records whichever device the gist says last wrote it.
 * @returns {string}
 */
export function lastSyncedDetailLabel() {
  const timestamp = appState.sync?.lastRemoteUpdateTimestamp;
  const device = appState.sync?.lastRemoteActiveDevice;
  if (!timestamp || !device) return "Never synced";
  return `Synced at ${timestamp} from ${device}`;
}

/** Loads sync config into appState (called at bootstrap). */
export function loadSyncConfig(schemaSync) {
  appState.sync = schemaSync;
}

export function clearSyncConfig() {
  appState.sync = { githubToken: null, configGistId: null, lastPushAt: null, lastPullAt: null, lastKnownRemoteUpdatedAt: null, knownVersion: 0, lastMetaPushedHash: null, lastRemoteActiveDevice: null, lastRemoteUpdateTimestamp: null, enabled: true };
  store.writeSync(appState.sync);
}

/** Flips auto-push on/off without touching the token/gist id — see sync/autoPush.js. */
export function setEnabled(on) {
  appState.sync = { ...appState.sync, enabled: on };
  store.writeSync(appState.sync);
}

/** Opens the Sync Manager modal (setup form if not yet configured, per-file status view otherwise). */
export function openSyncManager() {
  const wrap = document.createElement("div");
  const modal = openModal({ title: "Cross-Device Sync", bodyEl: wrap });
  renderInto(wrap, modal.close);
}

/**
 * Rebuilds the manager body in place, so actions can re-render without reopening the modal.
 * `closeModal` is only needed for the not-yet-configured (setup wizard) branch.
 * @param {HTMLElement} wrap
 * @param {() => void} [closeModal]
 */
function renderInto(wrap, closeModal) {
  wrap.textContent = "";
  if (!isSyncConfigured()) {
    wrap.appendChild(buildSetupForm(wrap, /** @type {() => void} */ (closeModal)));
    return;
  }
  wrap.appendChild(buildConfiguredView(wrap));
}

/**
 * Two-step setup wizard: GitHub token first, then a gist step that defaults to connecting an
 * existing sync gist id — pulling in whatever files already live there — or, behind a toggle,
 * creating a brand-new one. Either way, a successful connect closes the modal straight back to the app.
 * @param {HTMLElement} wrap
 * @param {() => void} closeModal
 */
function buildSetupForm(wrap, closeModal) {
  const section = document.createElement("div");
  let step = "token";
  let tokenValue = appState.sync?.githubToken || "";
  let gistMode = "existing";

  function render() {
    section.textContent = "";
    section.appendChild(step === "token" ? buildTokenStep() : buildGistStep());
  }

  function buildTokenStep() {
    const box = document.createElement("div");
    const helpLinkWrap = document.createElement("div");
    helpLinkWrap.style.marginBottom = "0.7rem";
    const helpLink = document.createElement("a");
    helpLink.href = "https://github.com/settings/tokens?type=beta";
    helpLink.target = "_blank";
    helpLink.rel = "noopener noreferrer";
    helpLink.className = "btn btn-sm btn-outline-primary";
    helpLink.textContent = "Create a GitHub token ↗";
    helpLinkWrap.appendChild(helpLink);

    const helpText = document.createElement("p");
    helpText.className = "small text-muted";
    helpText.textContent = "A fine-grained personal access token with only the \"Gist\" permission (read and write) is enough — it never touches your repos.";

    const keyLabel = mkLabel("GitHub Token");
    const keyInput = mkInput(tokenValue);

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "btn btn-sm btn-primary";
    nextBtn.textContent = "Next";
    nextBtn.addEventListener("click", () => {
      const v = keyInput.value.trim();
      if (!v) {
        showToast("GitHub Token is required.", "error");
        return;
      }
      tokenValue = v;
      step = "gist";
      render();
    });

    box.append(helpLinkWrap, helpText, keyLabel, keyInput, nextBtn);
    return box;
  }

  function buildGistStep() {
    const box = document.createElement("div");

    const backLink = document.createElement("a");
    backLink.href = "#";
    backLink.className = "small";
    backLink.style.display = "block";
    backLink.style.marginBottom = "0.6rem";
    backLink.textContent = "← Back";
    backLink.addEventListener("click", (e) => {
      e.preventDefault();
      step = "token";
      render();
    });
    box.appendChild(backLink);

    const toggleModeLink = document.createElement("a");
    toggleModeLink.href = "#";
    toggleModeLink.className = "small";
    toggleModeLink.style.display = "block";
    toggleModeLink.style.marginTop = "0.5rem";

    if (gistMode === "existing") {
      const idLabel = mkLabel("Existing Sync Gist ID");
      const idInput = mkInput("");

      const connectBtn = document.createElement("button");
      connectBtn.type = "button";
      connectBtn.className = "btn btn-sm btn-primary";
      connectBtn.textContent = "Connect";
      connectBtn.addEventListener("click", async () => {
        const id = idInput.value.trim();
        if (!id) {
          showToast("Existing Sync Gist ID is required.", "error");
          return;
        }
        connectBtn.disabled = true;
        connectBtn.textContent = "Connecting…";
        appState.sync = { ...appState.sync, githubToken: tokenValue };
        // Load whatever's already there (a returning user reconnecting, or a config shared from
        // another device) right away — a fresh/empty gist just no-ops here (no files to apply).
        const pullResult = await gists.connectExistingSyncGist(id);
        connectBtn.disabled = false;
        connectBtn.textContent = "Connect";
        if (!pullResult.ok) {
          showToast(`Connected, but couldn't load existing data: ${pullResult.error || "unknown error"}`, "error");
        } else if (pullResult.failures && pullResult.failures.length > 0) {
          showToast(`Connected, but ${pullResult.failures.length} file(s) failed to load — see console for details.`, "error");
        } else {
          showToast("Sync configured.", "success");
        }
        if (onSyncedDataChanged) onSyncedDataChanged();
        closeModal();
      });

      toggleModeLink.textContent = "Don't have one yet? Create a new sync gist";
      toggleModeLink.addEventListener("click", (e) => {
        e.preventDefault();
        gistMode = "create";
        render();
      });

      box.append(idLabel, idInput, connectBtn, toggleModeLink);
    } else {
      const desc = document.createElement("p");
      desc.className = "small text-muted";
      desc.textContent = "Creates a new private gist to hold your synced files and settings together. Any CSV files already loaded here get pushed into it right away.";

      const createBtn = document.createElement("button");
      createBtn.type = "button";
      createBtn.className = "btn btn-sm btn-primary";
      createBtn.textContent = "Create Sync Gist";
      createBtn.addEventListener("click", async () => {
        createBtn.disabled = true;
        appState.sync = { ...appState.sync, githubToken: tokenValue };
        const result = await gists.createNewSyncGist();
        createBtn.disabled = false;
        if (!result.ok) {
          showToast(result.error || "Could not create sync gist.", "error");
          return;
        }
        showToast("Sync configured.", "success");
        if (onSyncedDataChanged) onSyncedDataChanged();
        closeModal();
      });

      toggleModeLink.textContent = "Already have a sync gist? Connect existing";
      toggleModeLink.addEventListener("click", (e) => {
        e.preventDefault();
        gistMode = "existing";
        render();
      });

      box.append(desc, createBtn, toggleModeLink);
    }
    return box;
  }

  render();
  return section;
}

/** @param {HTMLElement} wrap */
function buildConfiguredView(wrap) {
  const section = document.createElement("div");

  section.appendChild(sectionHeading("Files"));
  for (const file of appState.files) {
    section.appendChild(buildFileRow(wrap, file));
  }

  section.appendChild(sectionDivider());

  const configRow = document.createElement("p");
  configRow.className = "small text-muted";
  const gistLink = document.createElement("a");
  gistLink.href = `https://gist.github.com/${appState.sync.configGistId}`;
  gistLink.target = "_blank";
  gistLink.rel = "noopener noreferrer";
  gistLink.textContent = "View sync gist ↗";
  configRow.append("Sync gist: ", gistLink, ` (${appState.sync.configGistId})`);
  section.appendChild(configRow);

  section.appendChild(sectionDivider());

  // --- Danger zone ---
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "btn btn-sm btn-outline-danger";
  clearBtn.textContent = "Disconnect this device";
  clearBtn.addEventListener("click", () => {
    if (!confirmAction("Disconnect this device from cloud sync? Your GitHub token and gist connection will be forgotten here only — your data in the cloud is untouched, and you can reconnect any time with the same token and sync gist ID.")) return;
    clearSyncConfig();
    if (onSyncedDataChanged) onSyncedDataChanged();
    renderInto(wrap);
  });
  section.appendChild(clearBtn);

  return section;
}

/**
 * @param {HTMLElement} wrap
 * @param {import('../types.js').FileRecord} file
 */
function buildFileRow(wrap, file) {
  const row = document.createElement("div");
  row.className = "sync-file-row";

  const name = document.createElement("span");
  name.className = "sync-file-name";
  name.textContent = file.fileName;
  row.appendChild(name);

  const status = document.createElement("span");
  status.className = "sync-file-status small text-muted";
  if (file.lastPushedHash) {
    status.textContent = "Synced";
    const usage = gists.computeFileUsage(file);
    if (usage.overCap) {
      const warn = document.createElement("span");
      warn.className = "sync-file-usage-warn";
      warn.title = "This file's data is near GitHub Gist's practical per-file size ceiling.";
      warn.textContent = " ⚠ large";
      status.appendChild(warn);
    }
  } else {
    status.textContent = "Not yet synced";
  }
  row.appendChild(status);

  const downloadBtn = document.createElement("button");
  downloadBtn.type = "button";
  downloadBtn.className = "btn btn-sm btn-outline-secondary";
  downloadBtn.textContent = "Download";
  downloadBtn.title = "Download this file as CSV";
  downloadBtn.addEventListener("click", () => fileManager.downloadFile(file.id));
  row.appendChild(downloadBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn-sm btn-outline-danger";
  deleteBtn.textContent = "Delete";
  deleteBtn.title = "Delete this file's data from the sync gist and remove it from this device — cannot be undone";
  deleteBtn.addEventListener("click", async () => {
    if (!confirmAction(`Delete "${file.fileName}"? This removes it from the sync gist AND from this device's local storage. This cannot be undone.`)) return;
    deleteBtn.disabled = true;
    const result = await gists.deleteFileFromGist(file.id);
    if (!result.ok) {
      deleteBtn.disabled = false;
      showToast(result.error || "Could not remove the file from the sync gist.", "error");
      return;
    }
    fileManager.deleteFile(file.id);
    showToast(`Deleted "${file.fileName}".`, "success");
    if (onSyncedDataChanged) onSyncedDataChanged();
    renderInto(wrap);
  });
  row.appendChild(deleteBtn);

  return row;
}

/** @param {string} text */
function mkLabel(text) {
  const label = document.createElement("label");
  label.className = "form-label small text-muted";
  label.textContent = text;
  return label;
}

/** @param {string} value */
function mkInput(value) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "form-control form-control-sm";
  input.style.marginBottom = "0.5rem";
  input.value = value;
  return input;
}

/**
 * Bold section label for buildConfiguredView's areas, paired with sectionDivider() between them.
 * @param {string} text
 */
function sectionHeading(text) {
  const heading = document.createElement("div");
  heading.style.fontWeight = "600";
  heading.style.marginBottom = "0.3rem";
  heading.textContent = text;
  return heading;
}

/** Visual separator between buildConfiguredView's sections. */
function sectionDivider() {
  const hr = document.createElement("hr");
  hr.className = "sync-section-divider";
  return hr;
}
