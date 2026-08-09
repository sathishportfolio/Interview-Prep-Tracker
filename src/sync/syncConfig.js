// @ts-check
/**
 * sync/syncConfig.js — Cross-Device Sync manager: a two-step setup wizard (Master Key, then either
 * create a new named bin or connect an existing one) plus, once configured, a bin manager UI —
 * create/register bins, see which local file lives in which bin, move or copy a file to another
 * bin, and fetch every known bin. All actual reads/writes go through sync/bins.js; this module is
 * presentation only.
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
import * as bins from "./bins.js";

/** @type {(() => void)|null} Called after any action that changes local files/settings (move/copy/fetch/clear). */
let onSyncedDataChanged = null;

/** @param {{onSyncedDataChanged: () => void}} callbacks */
export function initSyncConfig(callbacks) {
  onSyncedDataChanged = callbacks.onSyncedDataChanged;
}

/** @returns {boolean} true if masterKey + currentBinId are both configured */
export function isSyncConfigured() {
  return !!(appState.sync && appState.sync.masterKey && appState.sync.currentBinId);
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
  appState.sync = { masterKey: null, currentBinId: null, knownBins: [], lastPushAt: null, lastPullAt: null, lastKnownRemoteUpdatedAt: null, enabled: false };
  store.writeSync(appState.sync);
}

/** Flips the auto-push backstop on/off without touching Master Key/Bin ID — see sync/autoPush.js. */
export function setEnabled(on) {
  appState.sync = { ...appState.sync, enabled: on };
  store.writeSync(appState.sync);
}

/** Opens the Sync Manager modal (setup form if not yet configured, full bin manager otherwise). */
export function openSyncManager() {
  const wrap = document.createElement("div");
  const modal = openModal({ title: "Cross-Device Sync", bodyEl: wrap });
  renderInto(wrap, modal.close);
}

/**
 * Rebuilds the manager body in place, so actions can re-render without reopening the modal.
 * `closeModal` is only needed for the not-yet-configured (setup wizard) branch — every other call
 * site is already inside the configured bin-manager view re-rendering itself in place.
 * @param {HTMLElement} wrap
 * @param {() => void} [closeModal]
 */
function renderInto(wrap, closeModal) {
  wrap.textContent = "";
  if (!isSyncConfigured()) {
    wrap.appendChild(buildSetupForm(wrap, /** @type {() => void} */ (closeModal)));
    return;
  }
  wrap.appendChild(buildConfiguredView(wrap, closeModal));
}

/**
 * Two-step setup wizard: Master Key first, then a Bin step that defaults to creating a brand-new
 * (named) bin — which becomes the current bin every local file resolves to (see
 * bins.resolveBinId) — or, behind a toggle, connecting an existing Bin ID with a mandatory name,
 * pulling in whatever questions already live there. Either way, a successful connect closes the
 * modal straight back to the app instead of dropping into the full bin management view — that's
 * one click away later via Sync -> Manage cloud sync, not forced on first connect.
 * @param {HTMLElement} wrap
 * @param {() => void} closeModal
 */
function buildSetupForm(wrap, closeModal) {
  const section = document.createElement("div");
  let step = "key";
  let masterKeyValue = appState.sync?.masterKey || "";
  let binMode = "existing";

  function render() {
    section.textContent = "";
    section.appendChild(step === "key" ? buildKeyStep() : buildBinStep());
  }

  function buildKeyStep() {
    const box = document.createElement("div");
    const helpLinkWrap = document.createElement("div");
    helpLinkWrap.style.marginBottom = "0.7rem";
    const helpLink = document.createElement("a");
    helpLink.href = "https://jsonbin.io";
    helpLink.target = "_blank";
    helpLink.rel = "noopener noreferrer";
    helpLink.className = "btn btn-sm btn-outline-primary";
    helpLink.textContent = "Open JSONBin.io ↗";
    helpLinkWrap.appendChild(helpLink);

    const keyLabel = mkLabel("Master Key");
    const keyInput = mkInput(masterKeyValue);

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "btn btn-sm btn-primary";
    nextBtn.textContent = "Next";
    nextBtn.addEventListener("click", () => {
      const v = keyInput.value.trim();
      if (!v) {
        showToast("Master Key is required.", "error");
        return;
      }
      masterKeyValue = v;
      step = "bin";
      render();
    });

    box.append(helpLinkWrap, keyLabel, keyInput, nextBtn);
    return box;
  }

  function buildBinStep() {
    const box = document.createElement("div");

    const backLink = document.createElement("a");
    backLink.href = "#";
    backLink.className = "small";
    backLink.style.display = "block";
    backLink.style.marginBottom = "0.6rem";
    backLink.textContent = "← Back";
    backLink.addEventListener("click", (e) => {
      e.preventDefault();
      step = "key";
      render();
    });
    box.appendChild(backLink);

    const toggleModeLink = document.createElement("a");
    toggleModeLink.href = "#";
    toggleModeLink.className = "small";
    toggleModeLink.style.display = "block";
    toggleModeLink.style.marginTop = "0.5rem";

    if (binMode === "create") {
      const nameLabel = mkLabel("Bin Name");
      const nameInput = mkInput("");

      const createBtn = document.createElement("button");
      createBtn.type = "button";
      createBtn.className = "btn btn-sm btn-primary";
      createBtn.textContent = "Create Bin";
      createBtn.addEventListener("click", async () => {
        const name = nameInput.value.trim();
        if (!name) {
          showToast("Bin Name is required.", "error");
          return;
        }
        createBtn.disabled = true;
        appState.sync = { ...appState.sync, masterKey: masterKeyValue };
        const result = await bins.createNewBin(name);
        createBtn.disabled = false;
        if (!result.ok || !result.binId) {
          showToast(result.error || "Could not create bin.", "error");
          return;
        }
        // Sync stays OFF (paused) until the user explicitly flips the Auto-sync toggle themselves —
        // connecting credentials/a bin is not itself consent to start auto-pushing on every edit.
        appState.sync = { ...appState.sync, masterKey: masterKeyValue, currentBinId: result.binId };
        store.writeSync(appState.sync);
        // First-sync file creation: a brand-new setup with nothing loaded yet gets an empty file
        // named to match the bin, ready for bulk-add/CSV, instead of leaving the user with a
        // configured bin but no local file to actually sync (see fileManager.createEmptyFile).
        if (appState.files.length === 0) fileManager.createEmptyFile(name);
        showToast("Sync configured.", "success");
        if (onSyncedDataChanged) onSyncedDataChanged();
        closeModal();
      });

      toggleModeLink.textContent = "Already have a bin? Add existing bin";
      toggleModeLink.addEventListener("click", (e) => {
        e.preventDefault();
        binMode = "existing";
        render();
      });

      box.append(nameLabel, nameInput, createBtn, toggleModeLink);
    } else {
      const idLabel = mkLabel("Existing Bin ID");
      const idInput = mkInput("");
      const nameLabel = mkLabel("Existing Bin Name / Alias");
      const nameInput = mkInput("");

      const connectBtn = document.createElement("button");
      connectBtn.type = "button";
      connectBtn.className = "btn btn-sm btn-primary";
      connectBtn.textContent = "Connect";
      connectBtn.addEventListener("click", async () => {
        const id = idInput.value.trim();
        const name = nameInput.value.trim();
        if (!id || !name) {
          showToast("Existing Bin ID and Existing Bin Name / Alias are both required.", "error");
          return;
        }
        connectBtn.disabled = true;
        connectBtn.textContent = "Connecting…";
        // Sync stays OFF (paused) until the user explicitly flips the Auto-sync toggle themselves.
        appState.sync = { ...appState.sync, masterKey: masterKeyValue, currentBinId: id };
        store.writeSync(appState.sync);
        bins.registerKnownBin(id, name);
        // Load whatever's already in this bin (a returning user reconnecting, or a bin shared from
        // another device) right away — a fresh/empty bin just no-ops here (no files to apply).
        const pullResult = await bins.pullBinIntoLocalState(id);
        connectBtn.disabled = false;
        connectBtn.textContent = "Connect";
        if (!pullResult.ok) {
          showToast(`Connected, but couldn't load existing data: ${pullResult.error || "unknown error"}`, "error");
        } else {
          showToast("Sync configured.", "success");
        }
        if (onSyncedDataChanged) onSyncedDataChanged();
        closeModal();
      });

      toggleModeLink.textContent = "Create a new bin instead";
      toggleModeLink.addEventListener("click", (e) => {
        e.preventDefault();
        binMode = "create";
        render();
      });

      box.append(idLabel, idInput, nameLabel, nameInput, connectBtn, toggleModeLink);
    }
    return box;
  }

  render();
  return section;
}

/**
 * @param {HTMLElement} wrap
 * @param {() => void} [closeModal] Only used by the "Set as current bin" action (see buildBinsTable)
 *   — switching bins is a natural stopping point, so the modal closes back to the app afterward
 *   instead of leaving the manager open on now-stale bin/file rows.
 */
function buildConfiguredView(wrap, closeModal) {
  const section = document.createElement("div");

  // --- 1. Manage Bins: edit/set-current/delete the bins this device already knows about. ---
  section.appendChild(sectionHeading("Manage Bins"));
  section.appendChild(buildBinsTable(wrap, closeModal));

  section.appendChild(sectionDivider());

  // --- 2. Manage Files: move/copy an individual local file to a different known bin. ---
  section.appendChild(sectionHeading("Manage Files"));
  const availableBins = bins.listBins();
  for (const file of appState.files) {
    section.appendChild(buildFileRow(wrap, file, availableBins));
  }

  section.appendChild(sectionDivider());

  // --- 3. Register / Add a Bin: connect a bin this device doesn't know about yet, or mint a new
  // one. Kept last since it's the least-frequent action once a device is already set up — everyday
  // use is managing bins/files above, not adding more bins. Registering an EXISTING bin is shown by
  // default (the more common path); "+ New Bin" is tucked behind a show/hide toggle. ---
  section.appendChild(sectionHeading("Register / Add a Bin"));

  const registerBinRow = document.createElement("div");
  registerBinRow.className = "sync-inline-row";
  registerBinRow.style.marginTop = "0.3rem";
  const registerIdInput = document.createElement("input");
  registerIdInput.type = "text";
  registerIdInput.className = "form-control form-control-sm";
  registerIdInput.placeholder = "Existing Bin ID";
  const registerLabelInput = document.createElement("input");
  registerLabelInput.type = "text";
  registerLabelInput.className = "form-control form-control-sm";
  registerLabelInput.placeholder = "Name";
  const registerBtn = document.createElement("button");
  registerBtn.type = "button";
  registerBtn.className = "btn btn-sm btn-outline-primary";
  registerBtn.textContent = "Add";
  registerBtn.addEventListener("click", () => {
    const id = registerIdInput.value.trim();
    const name = registerLabelInput.value.trim();
    if (!id || !name) {
      showToast("Bin ID and Name are both required.", "error");
      return;
    }
    bins.registerKnownBin(id, name);
    renderInto(wrap);
  });
  registerBinRow.append(registerIdInput, registerLabelInput, registerBtn);
  section.appendChild(registerBinRow);

  const newBinRow = document.createElement("div");
  newBinRow.className = "sync-inline-row";
  newBinRow.style.marginTop = "0.3rem";
  newBinRow.hidden = true;
  const newBinLabelInput = document.createElement("input");
  newBinLabelInput.type = "text";
  newBinLabelInput.className = "form-control form-control-sm";
  newBinLabelInput.placeholder = "New bin name";
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

  const toggleNewBinLink = document.createElement("a");
  toggleNewBinLink.href = "#";
  toggleNewBinLink.className = "small";
  toggleNewBinLink.style.display = "block";
  toggleNewBinLink.style.marginTop = "0.3rem";
  toggleNewBinLink.textContent = "+ New Bin instead";
  toggleNewBinLink.addEventListener("click", (e) => {
    e.preventDefault();
    newBinRow.hidden = !newBinRow.hidden;
    toggleNewBinLink.textContent = newBinRow.hidden ? "+ New Bin instead" : "− Hide";
  });
  section.appendChild(toggleNewBinLink);
  section.appendChild(newBinRow);

  section.appendChild(sectionDivider());

  // --- Danger zone ---
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "btn btn-sm btn-outline-danger";
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
 * @param {Array<{id: string, label: string, isCurrent: boolean}>} availableBins
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
    opt.textContent = `${b.label}${b.isCurrent ? " (current)" : ""}`;
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
  deleteBtn.title = "Delete this file from its bin and from this device — cannot be undone";
  deleteBtn.addEventListener("click", async () => {
    if (!confirmAction(`Delete "${file.fileName}"? This removes it from the cloud bin AND from this device's local storage. This cannot be undone.`)) return;
    deleteBtn.disabled = true;
    const result = await bins.removeFileFromBin(file.id);
    if (!result.ok) {
      deleteBtn.disabled = false;
      showToast(result.error || "Could not remove the file from its bin.", "error");
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

/**
 * Bin ID + Name + Description + which local files currently resolve to it (comma-separated, like a
 * CSV list), plus per-row Edit (rename/re-describe the local label — see buildBinEditRow) and
 * Delete (forget it locally, never touches the bin's actual data on JSONBin — see
 * bins.deleteKnownBin) — one row per known bin (see bins.listBins). Also the reference table for
 * which file lives where, refreshed automatically whenever the current bin is switched (see the
 * "Set as current bin" handler below, which fetches every known bin at that point).
 * @param {HTMLElement} wrap
 * @param {() => void} [closeModal]
 */
function buildBinsTable(wrap, closeModal) {
  const filesByBin = bins.groupLocalFilesByBin();

  const table = document.createElement("table");
  table.className = "sync-bin-table";
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Name</th><th>Bin ID</th><th>Description</th><th>Files</th><th></th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const b of bins.listBins()) {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    nameCell.textContent = b.label;
    if (b.isCurrent) {
      const badge = document.createElement("span");
      badge.className = "badge text-bg-secondary";
      badge.textContent = "current";
      badge.style.marginLeft = "0.4rem";
      nameCell.appendChild(badge);
    }

    const idCell = document.createElement("td");
    const code = document.createElement("code");
    code.textContent = b.id;
    idCell.appendChild(code);

    const descCell = document.createElement("td");
    descCell.className = "sync-bin-description";
    descCell.textContent = b.description || "—";
    descCell.title = b.description || "";

    const filesCell = document.createElement("td");
    filesCell.textContent = (filesByBin.get(b.id) || []).map((f) => f.fileName).join(", ") || "—";

    const actionsCell = document.createElement("td");
    actionsCell.className = "sync-bin-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-sm btn-light";
    editBtn.title = "Edit this bin's name/description";
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
    editBtn.addEventListener("click", () => {
      const existingEditRow = row.nextElementSibling;
      if (existingEditRow && existingEditRow.classList.contains("sync-bin-edit-row")) {
        existingEditRow.remove();
        return;
      }
      row.after(buildBinEditRow(wrap, b, row));
    });
    actionsCell.appendChild(editBtn);

    if (!b.isCurrent) {
      const setCurrentBtn = document.createElement("button");
      setCurrentBtn.type = "button";
      setCurrentBtn.className = "btn btn-sm btn-light";
      setCurrentBtn.title = "Set as current bin (pulls its files into this device now)";
      setCurrentBtn.innerHTML = '<i class="fa-solid fa-star"></i>';
      setCurrentBtn.addEventListener("click", async () => {
        if (!confirmAction(`Set "${b.label}" as the current bin? This pulls its files into this device now (matching local files are overwritten with the cloud version), and it becomes where the File Switcher/Push/Pull all point from now on.`)) return;
        setCurrentBtn.disabled = true;
        const result = await bins.setCurrentBin(b.id);
        if (!result.ok) {
          setCurrentBtn.disabled = false;
          showToast(result.error || "Could not switch the current bin.", "error");
          return;
        }
        // Fetching every known bin (not just the new current one) here — rather than requiring a
        // separate manual "Fetch All Bins" step — keeps the Manage Files section's move/copy picker
        // populated with every bin's files right after a switch, which is when it's most useful.
        await bins.fetchAllBins();
        setCurrentBtn.disabled = false;
        showToast(`"${b.label}" is now the current bin.`, "success");
        if (onSyncedDataChanged) onSyncedDataChanged();
        // Switching bins is a natural stopping point — close the manager back to the app instead of
        // leaving it open on now-stale bin/file rows (see buildConfiguredView's closeModal doc).
        if (closeModal) closeModal();
        else renderInto(wrap);
      });
      actionsCell.appendChild(setCurrentBtn);
    }

    // Deleting is allowed for every bin, including the current one — bins.deleteKnownBin promotes
    // another known bin to current (or clears currentBinId back to unconfigured if none remain).
    const otherBinsExist = bins.listBins().length > 1;
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-sm btn-light";
    deleteBtn.title = b.isCurrent
      ? "Delete this bin (does not delete its data on JSONBin) — another bin becomes current"
      : "Remove this bin from this device (does not delete its data on JSONBin)";
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash icon-duplicate"></i>';
    deleteBtn.addEventListener("click", () => {
      const confirmMsg = b.isCurrent
        ? `Delete the current bin "${b.label}"? Its data on JSONBin is untouched. ${otherBinsExist ? "Another known bin will become current — Pull afterward to fetch its latest data." : "Cross-Device Sync will need a bin chosen again (your Master Key stays saved)."}`
        : `Remove bin "${b.label}" from this device? Its data on JSONBin is untouched — any local file assigned to it falls back to the current bin.`;
      if (!confirmAction(confirmMsg)) return;
      bins.deleteKnownBin(b.id);
      if (onSyncedDataChanged) onSyncedDataChanged();
      renderInto(wrap);
    });
    actionsCell.appendChild(deleteBtn);

    row.append(nameCell, idCell, descCell, filesCell, actionsCell);
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  return table;
}

/**
 * The inline edit row that opens directly under a bin's row when its Edit button is clicked — a
 * Name field (pre-filled, basically never actually edited since it was just set on create/register)
 * and an optional Description field, both in one seamless step instead of two separate prompts.
 * Collapses back into a single click via the same Edit button (see buildBinsTable); Save re-renders
 * the whole manager view, Cancel/Escape-equivalent just removes this row again with no side effects.
 * @param {HTMLElement} wrap
 * @param {{id: string, label: string, description: string}} b
 * @param {HTMLTableRowElement} afterRow
 * @returns {HTMLTableRowElement}
 */
function buildBinEditRow(wrap, b, afterRow) {
  const editRow = document.createElement("tr");
  editRow.className = "sync-bin-edit-row";
  const cell = document.createElement("td");
  cell.colSpan = 5;

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "form-control form-control-sm";
  nameInput.placeholder = "Name";
  nameInput.value = b.label;

  const descInput = document.createElement("textarea");
  descInput.className = "form-control form-control-sm";
  descInput.placeholder = "Description (optional)";
  descInput.rows = 1;
  descInput.value = b.description || "";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn btn-sm btn-primary";
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", () => {
    const name = nameInput.value.trim() || b.label;
    bins.renameKnownBin(b.id, name, descInput.value);
    renderInto(wrap);
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn btn-sm btn-light";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => editRow.remove());

  const form = document.createElement("div");
  form.className = "sync-bin-edit-form";
  form.append(nameInput, descInput, saveBtn, cancelBtn);
  cell.appendChild(form);
  editRow.appendChild(cell);
  return editRow;
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
 * Bold section label for buildConfiguredView's three top-level areas (Manage Bins / Manage Files /
 * Register or Add a Bin) so each is easy to tell apart at a glance — paired with sectionDivider()
 * between areas.
 * @param {string} text
 */
function sectionHeading(text) {
  const heading = document.createElement("div");
  heading.style.fontWeight = "600";
  heading.style.marginBottom = "0.3rem";
  heading.textContent = text;
  return heading;
}

/** Visual separator between buildConfiguredView's Manage Bins / Manage Files / Register-Add-Bin areas. */
function sectionDivider() {
  const hr = document.createElement("hr");
  hr.className = "sync-section-divider";
  return hr;
}
