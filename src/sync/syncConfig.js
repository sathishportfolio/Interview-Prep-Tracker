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
 * Human-readable "last synced" label for the Manual Pull button, e.g. "5 min ago" — reflects when
 * the jsonbin's content itself was last updated (`lastKnownRemoteUpdatedAt`), not merely when this
 * device last talked to it: a push sets it to now (this device just wrote that value to the bin), a
 * pull sets it to the bin's own `updatedAt` (which may be older, or newer if another device pushed
 * first) — so after pulling in a change from another device, the label reports when that change
 * actually landed in the bin, not when this device happened to fetch it.
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

  const intro = document.createElement("p");
  intro.className = "small text-muted";
  intro.style.marginBottom = "0.6rem";
  intro.textContent =
    "Sync stores your data in a free, private online database (JSONBin.io) so you can pick up your progress on any device. Nobody else can see it without your Master Key.";
  section.appendChild(intro);

  const stepsBox = document.createElement("div");
  stepsBox.className = "sync-setup-steps";
  const step1 = document.createElement("div");
  step1.innerHTML = "<strong>1.</strong> Create a free JSONBin.io account, then copy your Master Key and a Bin ID from its dashboard.";
  const helpLink = document.createElement("a");
  helpLink.href = "https://jsonbin.io";
  helpLink.target = "_blank";
  helpLink.rel = "noopener noreferrer";
  helpLink.className = "btn btn-sm btn-outline-primary";
  helpLink.style.margin = "0.4rem 0 0.8rem";
  helpLink.textContent = "Open JSONBin.io ↗";
  const step2 = document.createElement("div");
  step2.innerHTML = "<strong>2.</strong> Paste them below to connect this device.";
  step2.style.marginBottom = "0.5rem";
  stepsBox.append(step1, helpLink, step2);
  section.appendChild(stepsBox);

  const keyLabel = mkLabel("Master Key");
  const keyInput = mkInput(appState.sync?.masterKey || "");
  const keyHelp = mkHelpText("Your private password for JSONBin.io — keep it secret, use the same one on every device you sync.");

  const binLabel = mkLabel("Default Bin ID");
  const binInput = mkInput(appState.sync?.defaultBinId || "");
  const binHelp = mkHelpText("Where your data lives, like a folder. Create a new one on JSONBin.io, or paste an existing Bin ID here to load its data.");

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn btn-sm btn-primary";
  saveBtn.textContent = "Connect";
  saveBtn.style.marginTop = "0.3rem";
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

  section.append(keyLabel, keyInput, keyHelp, binLabel, binInput, binHelp, saveBtn);
  return section;
}

/** @param {HTMLElement} wrap */
function buildConfiguredView(wrap) {
  const section = document.createElement("div");

  const summary = document.createElement("div");
  summary.className = "small text-muted";
  summary.style.marginBottom = "0.8rem";
  summary.innerHTML = `Connected. Your data is stored in bin <code>${appState.sync.defaultBinId}</code> — use the same Master Key and Bin ID on another device to see the same data there.`;
  section.appendChild(summary);

  // --- Known bins + create new ---
  const binsHeading = document.createElement("div");
  binsHeading.style.fontWeight = "600";
  binsHeading.style.marginBottom = "0.15rem";
  binsHeading.textContent = "Bins (storage folders)";
  section.appendChild(binsHeading);

  const binsBlurb = mkHelpText("Most people only need the default bin below. Add another one only if you want to split some questions into separate storage.");
  binsBlurb.style.marginTop = "0";
  section.appendChild(binsBlurb);

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
  const newBinHelp = mkHelpText("Creates a new, empty bin you can move or copy files into below.");
  newBinHelp.style.marginTop = "0.2rem";
  section.appendChild(newBinHelp);

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
  const registerHelp = mkHelpText("Already have a Bin ID from another device or a teammate? Add it here to manage it too.");
  registerHelp.style.marginTop = "0.2rem";
  section.appendChild(registerHelp);

  const fetchAllBtn = document.createElement("button");
  fetchAllBtn.type = "button";
  fetchAllBtn.className = "btn btn-sm btn-outline-secondary";
  fetchAllBtn.style.marginTop = "0.4rem";
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
  const fetchAllHelp = mkHelpText("Pulls the latest data from every bin listed above into this device.");
  fetchAllHelp.style.marginTop = "0.2rem";
  section.appendChild(fetchAllHelp);

  // --- Per-file bin assignment ---
  const filesHeading = document.createElement("div");
  filesHeading.style.fontWeight = "600";
  filesHeading.style.margin = "0.8rem 0 0.15rem";
  filesHeading.textContent = "Files";
  section.appendChild(filesHeading);

  if (appState.files.length > 1 || bins.listBins().length > 1) {
    const filesBlurb = mkHelpText("Move sends a file to a different bin. Copy duplicates it into another bin too, keeping the original where it is.");
    filesBlurb.style.marginTop = "0";
    section.appendChild(filesBlurb);
  }

  const availableBins = bins.listBins();
  for (const file of appState.files) {
    section.appendChild(buildFileRow(wrap, file, availableBins));
  }

  // --- Danger zone ---
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "btn btn-sm btn-outline-danger";
  clearBtn.style.marginTop = "0.8rem";
  clearBtn.textContent = "Disconnect this device";
  clearBtn.addEventListener("click", () => {
    if (!confirmAction("Disconnect this device from cloud sync? Your Master Key and Bin ID will be forgotten here only — your data in the cloud is untouched, and you can reconnect any time with the same Master Key and Bin ID.")) return;
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

/** @param {string} text Plain-language explanation shown under a field, e.g. what a Bin ID is for. */
function mkHelpText(text) {
  const help = document.createElement("div");
  help.className = "form-text";
  help.style.marginTop = "-0.3rem";
  help.style.marginBottom = "0.6rem";
  help.textContent = text;
  return help;
}
