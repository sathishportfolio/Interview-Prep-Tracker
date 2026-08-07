// @ts-check
/**
 * sync/syncConfig.js — Cross-Device Sync manager: setup form (Master Key + default Bin ID) plus,
 * once configured, a bin manager UI — create bins, see which local file lives in which bin, move
 * or copy a file to another bin, and fetch every known bin. All actual reads/writes go through
 * sync/bins.js; this module is presentation only.
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
import * as bins from "./bins.js";

/** @type {(() => void)|null} Called after any action that changes local files/settings (move/copy/fetch/clear). */
let onSyncedDataChanged = null;

/** @param {{onSyncedDataChanged: () => void}} callbacks */
export function initSyncConfig(callbacks) {
  onSyncedDataChanged = callbacks.onSyncedDataChanged;
}

/** @returns {boolean} true if masterKey + defaultBinId are both configured */
export function isSyncConfigured() {
  return !!(appState.sync && appState.sync.masterKey && appState.sync.defaultBinId);
}

/**
 * Human-readable "last synced" label for the Manual Pull button, e.g. "Aug 7, 2026". Takes the
 * more recent of the last push/pull timestamps (both session-scoped bookkeeping, not persisted —
 * see autoPush.js) so it reflects sync activity from either direction, across any bin.
 * @returns {string}
 */
export function lastSyncedLabel() {
  const ts = Math.max(appState.sync?.lastPushAt || 0, appState.sync?.lastPullAt || 0);
  if (!ts) return "Never synced";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Loads sync config into appState (called at bootstrap). */
export function loadSyncConfig(schemaSync) {
  appState.sync = schemaSync;
}

export function clearSyncConfig() {
  appState.sync = { masterKey: null, defaultBinId: null, knownBins: [], lastPushAt: null, lastPullAt: null, lastKnownRemoteUpdatedAt: null };
  store.writeSync(appState.sync);
}

/** Opens the Sync Manager modal (setup form if not yet configured, full bin manager otherwise). */
export function openSyncManager() {
  const wrap = document.createElement("div");
  openModal({ title: "Cross-Device Sync", bodyEl: wrap });
  renderInto(wrap);
}

/** @param {HTMLElement} wrap Rebuilds the manager body in place, so actions can re-render without reopening the modal. */
function renderInto(wrap) {
  wrap.textContent = "";
  if (!isSyncConfigured()) {
    wrap.appendChild(buildSetupForm(wrap));
    return;
  }
  wrap.appendChild(buildConfiguredView(wrap));
}

/** @param {HTMLElement} wrap */
function buildSetupForm(wrap) {
  const section = document.createElement("div");

  const helpLink = document.createElement("a");
  helpLink.href = "https://jsonbin.io";
  helpLink.target = "_blank";
  helpLink.rel = "noopener noreferrer";
  helpLink.textContent = "Open JSONBin.io to get a Master Key + create a Bin ↗";
  helpLink.style.display = "block";
  helpLink.style.marginBottom = "0.6rem";

  const keyLabel = mkLabel("Master Key");
  const keyInput = mkInput(appState.sync?.masterKey || "");

  const binLabel = mkLabel("Default Bin ID");
  const binInput = mkInput(appState.sync?.defaultBinId || "");

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn btn-sm btn-primary";
  saveBtn.textContent = "Save";
  saveBtn.style.marginTop = "0.5rem";
  saveBtn.addEventListener("click", () => {
    const masterKey = keyInput.value.trim();
    const defaultBinId = binInput.value.trim();
    if (!masterKey || !defaultBinId) {
      showToast("Master Key and Default Bin ID are both required.", "error");
      return;
    }
    appState.sync = { ...appState.sync, masterKey, defaultBinId };
    store.writeSync(appState.sync);
    showToast("Sync configured.", "success");
    if (onSyncedDataChanged) onSyncedDataChanged();
    renderInto(wrap);
  });

  section.append(helpLink, keyLabel, keyInput, binLabel, binInput, saveBtn);
  return section;
}

/** @param {HTMLElement} wrap */
function buildConfiguredView(wrap) {
  const section = document.createElement("div");

  const summary = document.createElement("div");
  summary.className = "small text-muted";
  summary.style.marginBottom = "0.6rem";
  summary.textContent = `Default bin: ${appState.sync.defaultBinId}`;
  section.appendChild(summary);

  // --- Known bins + create new ---
  const binsHeading = document.createElement("div");
  binsHeading.style.fontWeight = "600";
  binsHeading.style.marginBottom = "0.3rem";
  binsHeading.textContent = "Bins";
  section.appendChild(binsHeading);

  const binList = document.createElement("div");
  binList.className = "sync-bin-list";
  for (const b of bins.listBins()) {
    const row = document.createElement("div");
    row.className = "sync-bin-row";
    row.textContent = `${b.label}${b.isDefault ? " (default)" : ""} — ${b.id}`;
    binList.appendChild(row);
  }
  section.appendChild(binList);

  const newBinRow = document.createElement("div");
  newBinRow.className = "sync-inline-row";
  const newBinLabelInput = document.createElement("input");
  newBinLabelInput.type = "text";
  newBinLabelInput.className = "form-control form-control-sm";
  newBinLabelInput.placeholder = "New bin label (e.g. \"Archive\")";
  const newBinBtn = document.createElement("button");
  newBinBtn.type = "button";
  newBinBtn.className = "btn btn-sm btn-outline-primary";
  newBinBtn.textContent = "+ New Bin";
  newBinBtn.addEventListener("click", async () => {
    newBinBtn.disabled = true;
    const result = await bins.createNewBin(newBinLabelInput.value.trim() || "Untitled bin");
    newBinBtn.disabled = false;
    if (!result.ok) {
      showToast(result.error || "Could not create bin.", "error");
      return;
    }
    showToast(`Created bin ${result.binId}.`, "success");
    renderInto(wrap);
  });
  newBinRow.append(newBinLabelInput, newBinBtn);
  section.appendChild(newBinRow);

  const registerBinRow = document.createElement("div");
  registerBinRow.className = "sync-inline-row";
  registerBinRow.style.marginTop = "0.3rem";
  const registerIdInput = document.createElement("input");
  registerIdInput.type = "text";
  registerIdInput.className = "form-control form-control-sm";
  registerIdInput.placeholder = "Existing Bin ID to manage here";
  const registerBtn = document.createElement("button");
  registerBtn.type = "button";
  registerBtn.className = "btn btn-sm btn-outline-primary";
  registerBtn.textContent = "+ Register Bin";
  registerBtn.title = "Add a Bin ID you already have (e.g. from another device) to this manager";
  registerBtn.addEventListener("click", () => {
    const id = registerIdInput.value.trim();
    if (!id) return;
    bins.registerKnownBin(id, id);
    renderInto(wrap);
  });
  registerBinRow.append(registerIdInput, registerBtn);
  section.appendChild(registerBinRow);

  const fetchAllBtn = document.createElement("button");
  fetchAllBtn.type = "button";
  fetchAllBtn.className = "btn btn-sm btn-outline-secondary";
  fetchAllBtn.style.marginTop = "0.5rem";
  fetchAllBtn.textContent = "Fetch All Bins";
  fetchAllBtn.title = "Pull every known bin and merge its files into this device";
  fetchAllBtn.addEventListener("click", async () => {
    fetchAllBtn.disabled = true;
    const result = await bins.fetchAllBins();
    fetchAllBtn.disabled = false;
    showToast(result.ok ? "Fetched all bins." : result.error || "Fetch failed.", result.ok ? "success" : "error");
    if (onSyncedDataChanged) onSyncedDataChanged();
    renderInto(wrap);
  });
  section.appendChild(fetchAllBtn);

  // --- Per-file bin assignment ---
  const filesHeading = document.createElement("div");
  filesHeading.style.fontWeight = "600";
  filesHeading.style.margin = "0.8rem 0 0.3rem";
  filesHeading.textContent = "Files";
  section.appendChild(filesHeading);

  const availableBins = bins.listBins();
  for (const file of appState.files) {
    section.appendChild(buildFileRow(wrap, file, availableBins));
  }

  // --- Danger zone ---
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "btn btn-sm btn-outline-danger";
  clearBtn.style.marginTop = "0.8rem";
  clearBtn.textContent = "Clear sync configuration";
  clearBtn.addEventListener("click", () => {
    if (!confirmAction("Clear sync configuration? Bin IDs and the Master Key will be forgotten on this device (the bins themselves are untouched).")) return;
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
 * @param {Array<{id: string, label: string, isDefault: boolean}>} availableBins
 */
function buildFileRow(wrap, file, availableBins) {
  const row = document.createElement("div");
  row.className = "sync-file-row";

  const name = document.createElement("span");
  name.className = "sync-file-name";
  name.textContent = file.fileName;
  row.appendChild(name);

  const select = document.createElement("select");
  select.className = "form-select form-select-sm";
  const currentBin = bins.resolveBinId(file);
  for (const b of availableBins) {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = `${b.label}${b.isDefault ? " (default)" : ""}`;
    opt.selected = b.id === currentBin;
    select.appendChild(opt);
  }
  row.appendChild(select);

  const moveBtn = document.createElement("button");
  moveBtn.type = "button";
  moveBtn.className = "btn btn-sm btn-outline-primary";
  moveBtn.textContent = "Move";
  moveBtn.title = "Move this file to the selected bin (removed from its current bin)";
  moveBtn.addEventListener("click", async () => {
    if (select.value === currentBin) return;
    moveBtn.disabled = true;
    const result = await bins.moveFileToBin(file.id, select.value);
    moveBtn.disabled = false;
    showToast(result.ok ? `Moved "${file.fileName}".` : result.error || "Move failed.", result.ok ? "success" : "error");
    if (onSyncedDataChanged) onSyncedDataChanged();
    renderInto(wrap);
  });
  row.appendChild(moveBtn);

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "btn btn-sm btn-outline-secondary";
  copyBtn.textContent = "Copy";
  copyBtn.title = "Copy a snapshot of this file into the selected bin (stays in its current bin too)";
  copyBtn.addEventListener("click", async () => {
    if (select.value === currentBin) {
      showToast("Already in that bin.", "info");
      return;
    }
    copyBtn.disabled = true;
    const result = await bins.copyFileToBin(file.id, select.value);
    copyBtn.disabled = false;
    showToast(result.ok ? `Copied "${file.fileName}".` : result.error || "Copy failed.", result.ok ? "success" : "error");
  });
  row.appendChild(copyBtn);

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
