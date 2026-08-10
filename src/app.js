// @ts-check
/**
 * app.js — entry point. Bootstraps state, wires the render engine's handlers, and connects every
 * static DOM control in index.html to its feature module. Deliberately short/thin: all logic lives
 * in data/*, render/*, features/*, sync/*.
 */
import { appState } from "./state/appState.js";
import * as fileManager from "./features/fileManager.js";
import { initTreeRenderer } from "./render/treeRenderer.js";
import { initFlatRenderer } from "./render/flatRenderer.js";
import { initStatsBadges } from "./render/statsBadges.js";
import { initBreadcrumb } from "./render/breadcrumb.js";
import { buildTreeHandlers } from "./features/treeHandlers.js";
import { configureRefresh, refreshView, repaint, setAfterRepaintHook, applyDataChange } from "./features/refresh.js";
import { resetProgress } from "./data/mutations.js";
import * as activeQuestionFeature from "./features/activeQuestion.js";
import * as filters from "./features/filters.js";
import * as editMode from "./features/editMode.js";
import * as flattenView from "./features/flattenView.js";
import * as theme from "./features/theme.js";
import * as dragDropToggle from "./features/dragDropToggle.js";
import * as autoExpand from "./features/autoExpand.js";
import * as dragDrop from "./features/dragDrop.js";
import * as copyVisible from "./features/copyVisible.js";
import * as duplicateFinder from "./features/duplicateFinder.js";
import * as undoRedo from "./features/undoRedo.js";
import * as closeAll from "./features/closeAll.js";
import * as floatingToggles from "./features/floatingToggles.js";
import * as timer from "./features/timer.js";
import * as search from "./features/search.js";
import * as reviewShortcuts from "./features/reviewShortcuts.js";
import { openShortcutsHelp } from "./features/keyboardShortcutsHelp.js";
import * as bulkSelection from "./features/bulkSelection.js";
import * as tempModeFeature from "./features/tempModeFeature.js";
import * as autoDownload from "./features/autoDownload.js";
import * as groupPanels from "./features/groupPanels.js";
import { showToast, confirmAction } from "./features/toast.js";
import * as syncConfig from "./sync/syncConfig.js";
import * as manualPull from "./sync/manualPull.js";
import * as manualPush from "./sync/manualPush.js";
import * as autoPush from "./sync/autoPush.js";
import * as bins from "./sync/bins.js";

function $(id) {
  return document.getElementById(id);
}

/** Reflects the cloud data's freshness inside the Sync menu, e.g. "5 min ago". */
function updateSyncStatusLabel() {
  const menuBtn = $("syncMenuBtn");
  const label = $("lastSyncedLabel");
  const text = syncConfig.lastSyncedLabel();
  const title = text === "Never synced" ? text : `Last sync with cloud: ${text}`;
  if (menuBtn) menuBtn.title = title;
  if (label) label.textContent = text;
}

/** Shows the current bin's size against the JSONBin free-tier cap as a single Bootstrap progress bar in the Sync menu. */
function updateSyncUsageBadge(usage) {
  const fill = $("syncUsageFill");
  if (!usage || !fill) return;
  const percent = Math.min(usage.percent, 100);
  fill.style.width = `${percent}%`;
  fill.textContent = `${usage.percent}%`;
  fill.closest(".progress")?.setAttribute("aria-valuenow", String(usage.percent));
  fill.classList.toggle("bg-success", !usage.overCap);
  fill.classList.toggle("bg-danger", usage.overCap);

  // Mirrored onto the collapsed Sync button itself so nearing/over the free-tier cap is visible
  // without having to open the dropdown first.
  const badge = $("syncMenuUsageBadge");
  if (badge) {
    badge.hidden = false;
    badge.textContent = `${usage.percent}%`;
    badge.title = usage.overCap ? "Cloud storage usage is near/at the free-tier limit" : "Cloud storage usage";
    badge.classList.toggle("usage-over", usage.overCap);
    badge.classList.toggle("usage-warn", !usage.overCap && usage.percent >= 70);
  }
}

/** Recomputes the usage badge from local state alone (no network call) — see bins.computeCurrentBinUsage. */
function refreshSyncUsageBadge() {
  if (!syncConfig.isSyncConfigured()) return;
  bins.computeCurrentBinUsage().then(updateSyncUsageBadge);
}

/** Toggles the setup-prompt vs. connected views inside the Sync menu panel to match current config. */
function renderSyncMenuState() {
  const configured = syncConfig.isSyncConfigured();
  const setupPrompt = $("syncMenuSetupPrompt");
  const connected = $("syncMenuConnected");
  if (setupPrompt) setupPrompt.hidden = configured;
  if (connected) connected.hidden = !configured;
  if (configured) {
    updateSyncStatusLabel();
    refreshSyncUsageBadge();
    updateSyncStatusIndicator();
    const toggle = /** @type {HTMLInputElement|null} */ ($("syncEnabledToggle"));
    if (toggle) toggle.checked = !!appState.sync.enabled;
  }
}

/** Shows/hides the small dot on the Sync button that flags unpushed local changes. */
function updateSyncDot(dirty) {
  const dot = $("syncMenuStatusDot");
  if (!dot) return;
  dot.hidden = !dirty;
  dot.title = dirty ? "You have local changes not yet pushed to the cloud" : "";
}

/** Reflects on/paused state on the collapsed Sync button, distinct from the dirty dot and usage badge. */
function updateSyncStatusIndicator() {
  const indicator = $("syncMenuStatusIndicator");
  if (!indicator) return;
  const configured = syncConfig.isSyncConfigured();
  indicator.hidden = !configured;
  if (!configured) return;
  const on = !!appState.sync.enabled;
  indicator.classList.toggle("sync-indicator-on", on);
  indicator.classList.toggle("sync-indicator-paused", !on);
  indicator.title = on ? "Cloud sync is ON" : "Cloud sync is OFF (paused) — Push/Pull still available";
}

/** Every dropdown menu's close() registered via initDropdownMenu, so opening one can close the rest. */
const openDropdownClosers = [];

/**
 * Wires a small "Button -> dropdown panel" pattern: click the button to toggle the panel, click
 * anywhere else (or Escape) to close it, clicks inside the panel don't bubble out and close it.
 * Opening one dropdown closes every other one registered this way (each button's own click handler
 * stops propagation so it can toggle itself without the document listener re-closing it immediately
 * — which also means, without this, opening one dropdown would never close a different one already
 * open, since that other dropdown's document click-listener never sees a stopped-propagation click).
 * Shared by the Sync menu and the Export menu so both behave identically.
 * @param {string} btnId
 * @param {string} panelId
 * @param {() => void} [onOpen] Called right before the panel becomes visible (e.g. to refresh its contents).
 */
function initDropdownMenu(btnId, panelId, onOpen) {
  const btn = $(btnId);
  const panel = $(panelId);
  if (!btn || !panel) return { close: () => {} };

  const close = () => {
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  };
  const toggle = () => {
    const opening = panel.hidden;
    for (const closeOther of openDropdownClosers) closeOther();
    if (opening && onOpen) onOpen();
    panel.hidden = !opening;
    btn.setAttribute("aria-expanded", String(opening));
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });
  panel.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  openDropdownClosers.push(close);
  return { close };
}

/** Shared refresh after anything that changes appState.files/filters from outside the normal edit flow (file switch, load, or a sync pull/move/copy/fetch). */
function refreshAfterExternalDataChange() {
  renderFileSwitcher();
  // A cross-device pull can bring in a themeDark preference set on another device — re-apply it so
  // this device's display matches immediately, not just after its own next manual toggle.
  theme.applyTheme();
  // refreshView() first: it recomputes appState.grouped/groupedUnfiltered from the new file's
  // rawData, which filters.syncControlsFromState()'s option lists read from — populating the
  // dropdowns before this recompute would show stale (usually empty) options.
  refreshView();
  filters.syncControlsFromState();
  renderSyncMenuState();
}

function init() {
  // --- Bootstrap state from storage ---
  fileManager.bootstrapFromStorage();
  tempModeFeature.initTempModeFromStorage(); // re-enters Temp/Test Mode if it was still on at last close
  theme.applyTheme(); // before first paint, so there's no light-theme flash for returning dark-theme users

  // First-time-mobile-visitor default: Flatten View ON.
  if (flattenView.isMobile() && !localStorage.getItem("iqv:v1")) {
    appState.toggles.flatGroupView = true;
  }

  // --- Wire render engine ---
  const handlers = buildTreeHandlers();
  initTreeRenderer(/** @type {HTMLElement} */ ($("treeRoot")), handlers);
  initFlatRenderer(/** @type {HTMLElement} */ ($("flatRoot")), handlers);
  initStatsBadges(
    /** @type {HTMLElement} */ ($("globalStatsBadges")),
    /** @type {HTMLElement} */ ($("globalActionsGroup")),
    /** @type {HTMLElement} */ ($("statsProgressBar"))
  );
  initBreadcrumb(/** @type {HTMLElement} */ ($("headerBreadcrumb")), () => activeQuestionFeature.jumpToActiveQuestion());

  configureRefresh({
    stats: {
      onTotalClick: () => filters.clearFilters(),
      onFilteredClick: () => filters.clearGroupFiltersOnly(),
      onStatusBadgeClick: (status) => filters.toggleStatusFilter(status),
    },
    actions: {
      onToggleEditMode: () => editMode.toggleEditMode(),
      onToggleFlatten: () => flattenView.toggleFlatten(),
      onToggleDragDrop: () => dragDropToggle.toggleDragDrop(),
      onToggleAutoExpand: () => autoExpand.toggleAutoExpandChildren(),
      onFindDuplicates: () => duplicateFinder.openDuplicateFinder(),
      onCopyVisible: (format) => copyVisible.copyVisible(format),
    },
    breadcrumb: () => activeQuestionFeature.computeBreadcrumbData(),
  });

  setAfterRepaintHook(() => dragDrop.refreshSortables());

  undoRedo.initUndoRedo();

  // --- Filters ---
  filters.initFilters({
    subjectMount: /** @type {HTMLElement} */ ($("subjectFilterMount")),
    topicMount: /** @type {HTMLElement} */ ($("topicFilterMount")),
    subTopicMount: /** @type {HTMLElement} */ ($("subTopicFilterMount")),
    statusMount: /** @type {HTMLElement} */ ($("statusFilterMount")),
  });
  $("clearFiltersBtn")?.addEventListener("click", () => filters.clearFilters());
  $("filterCardToggle")?.addEventListener("click", () => {
    $("filterCardBody")?.classList.toggle("open");
  });

  // --- File Manager ---
  fileManager.initFileManager({
    onFilesChanged: () => refreshAfterExternalDataChange(),
  });
  renderFileSwitcher();

  $("csvFileInput")?.addEventListener("change", async (e) => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    const file = input.files && input.files[0];
    if (!file) return;
    const text = await file.text();
    const result = fileManager.loadCsvAsNewFile(file.name.replace(/\.csv$/i, ""), text);
    if (!result.ok) showToast(result.error || "Failed to load CSV.", "error");
    else showToast(`Loaded ${file.name}`, "success");
    input.value = "";
  });

  $("loadSampleBtn")?.addEventListener("click", () => {
    const result = fileManager.loadSampleData();
    if (!result.ok) showToast(result.error || "Failed to load CSV.", "error");
  });

  // Single "Export" menu: click to choose Download or Copy, instead of two separate toolbar buttons.
  const exportMenu = initDropdownMenu("exportMenuBtn", "exportMenuPanel");
  $("downloadProgressBtn")?.addEventListener("click", () => {
    exportMenu.close();
    fileManager.downloadProgressCsv();
  });
  $("copyProgressCsvBtn")?.addEventListener("click", () => {
    exportMenu.close();
    fileManager.copyProgressCsvToClipboard();
  });

  $("resetProgressBtn")?.addEventListener("click", () => {
    if (!confirmAction("Reset progress for every question in this file? This clears Done, Review Later, spaced-repetition scheduling (Due), and the Active Question flag — Starred/LessImportant/Duplicate flags and the question structure itself are untouched. This cannot be undone here, but Undo will still work.")) return;
    activeQuestionFeature.clearActiveQuestion();
    applyDataChange({ rawData: resetProgress(appState.rawData), emptyGroups: appState.emptyGroups });
    showToast("Progress reset for all questions.", "success");
  });

  $("resetAllBtn")?.addEventListener("click", () => {
    if (!confirmAction("Reset ALL data? This deletes every uploaded CSV, progress, setting, and Cross-Device Sync connection (Master Key/Bin IDs) from this browser. This cannot be undone.")) return;
    fileManager.resetAllData();
    // A full reload (rather than re-running the refresh pipeline in place) guarantees every bit of
    // in-memory state boots fresh from the now-empty persisted schema, instead of relying on every
    // feature module's own state to have been hand-reset correctly.
    window.location.reload();
  });

  $("fileSwitcher")?.addEventListener("change", (e) => {
    const id = /** @type {HTMLSelectElement} */ (e.target).value;
    if (id) fileManager.switchToFile(id);
  });

  // Soft delete: local-only, never touches any cloud bin — full local+remote removal lives in the
  // Cross-Device Sync manager's "Manage Files" section instead (sync/syncConfig.js's buildFileRow).
  $("deleteCurrentFileBtn")?.addEventListener("click", () => {
    const file = appState.files.find((f) => f.id === appState.activeFileId);
    if (!file) return;
    if (!confirmAction(`Remove "${file.fileName}" from this device only? This does NOT delete it from any cloud bin — to remove it everywhere, use Sync → Manage cloud sync → Manage Files. This cannot be undone on this device.`)) return;
    fileManager.deleteFile(file.id);
    showToast(`Removed "${file.fileName}" from this device.`, "info");
  });

  const tempModeToggleEl = /** @type {HTMLInputElement|null} */ ($("tempModeToggle"));
  if (tempModeToggleEl) tempModeToggleEl.checked = appState.toggles.tempMode;
  tempModeToggleEl?.addEventListener("change", (e) => {
    const on = /** @type {HTMLInputElement} */ (e.target).checked;
    tempModeFeature.setTempModeOn(on);
    showToast(on ? "Temp/Test Mode ON — nothing will be saved." : "Temp/Test Mode OFF.", "info");
  });

  const autoDownloadToggleEl = /** @type {HTMLInputElement|null} */ ($("autoDownloadToggle"));
  if (autoDownloadToggleEl) autoDownloadToggleEl.checked = autoDownload.isAutoDownloadOn();
  autoDownloadToggleEl?.addEventListener("change", (e) => {
    const on = /** @type {HTMLInputElement} */ (e.target).checked;
    autoDownload.toggleAutoDownload(on);
    showToast(on ? "Auto Download ON — downloading a CSV backup of the current file every minute." : "Auto Download OFF.", "info");
  });

  // --- Root-level Bulk Add/Update/Copy ---
  const rootWrap = $("bulkAddRootWrap");
  if (rootWrap) groupPanels.mountGroupPanels("root", {}, rootWrap);

  // --- Search ---
  search.initSearch(/** @type {HTMLInputElement} */ ($("jumpSearchInput")), /** @type {HTMLElement} */ ($("jumpSearchResults")));

  // --- Review keyboard shortcuts (Up/Down navigate, d = Done, r = Review Later) ---
  reviewShortcuts.initReviewShortcuts();

  // --- Theme / Edit Mode / Drag-Drop / Close All / Undo / Redo / Floating toggles ---
  $("themeToggleBtn")?.addEventListener("click", () => theme.toggleTheme());
  $("editModeToggleBtn")?.addEventListener("click", () => editMode.toggleEditMode());
  $("closeAllBtn")?.addEventListener("click", () => closeAll.closeAllAccordions());
  $("undoBtn")?.addEventListener("click", () => undoRedo.undo());
  $("redoBtn")?.addEventListener("click", () => undoRedo.redo());
  $("keyboardShortcutsBtn")?.addEventListener("click", () => openShortcutsHelp());
  floatingToggles.initFloatingToggles();

  // --- Bulk selection bar ---
  $("bulkSelectAllBtn")?.addEventListener("click", () => bulkSelection.toggleSelectAllInActiveGroups());
  $("bulkDeleteSelectedBtn")?.addEventListener("click", () => bulkSelection.bulkDeleteSelected());
  $("bulkClearSelectedBtn")?.addEventListener("click", () => bulkSelection.clearAllSelections());
  $("bulkMoveSelectedBtn")?.addEventListener("click", async () => {
    const selection = bulkSelection.getSelection();
    if (selection.groups.length === 0 && selection.questionIds.length === 0) return;
    const { openMoveForm } = await import("./features/moveForm.js");
    openMoveForm(selection);
  });

  // --- Timer ---
  timer.initTimerDisplay(/** @type {HTMLElement} */ ($("timerDisplay")));
  $("timerStartBtn")?.addEventListener("click", () => timer.startTimer());
  $("timerPauseBtn")?.addEventListener("click", () => timer.pauseTimer());
  $("timerResetBtn")?.addEventListener("click", () => timer.resetTimer());

  // --- Sync ---
  syncConfig.initSyncConfig({
    onSyncedDataChanged: () => {
      autoPush.markSynced(); // bin management (move/copy/fetch/clear) already left local state in sync
      fileManager.bootstrapFromStorage();
      refreshAfterExternalDataChange();
    },
  });
  // Single "Sync" menu is the one entry point for sync — status, Push, Pull, storage usage, and a
  // link into the full Sync Manager modal, instead of separate always-visible toolbar icons.
  const syncMenu = initDropdownMenu("syncMenuBtn", "syncMenuPanel", renderSyncMenuState);
  $("syncMenuSetupBtn")?.addEventListener("click", () => {
    syncMenu.close();
    syncConfig.openSyncManager();
  });
  $("syncSettingsBtn")?.addEventListener("click", () => {
    syncMenu.close();
    syncConfig.openSyncManager();
  });
  renderSyncMenuState();
  // Keeps the relative-time label ("5 min ago" -> "1 hr ago") advancing even with no new sync activity.
  setInterval(updateSyncStatusLabel, 30000);
  // No push-per-edit or pull-on-load (JSONBin's free tier has tight request-rate/size limits) — the
  // Push/Pull buttons are the primary sync path. autoPush.js only backstops edits left unpushed for
  // a full minute, and blocks tab close while something is still unpushed.
  autoPush.initAutoPush(
    (usage) => updateSyncUsageBadge(usage),
    () => updateSyncStatusLabel(),
    (dirty) => updateSyncDot(dirty)
  );
  $("manualPullBtn")?.addEventListener("click", async () => {
    const result = await manualPull.manualPull();
    if (result.ok) {
      autoPush.markSynced();
      fileManager.bootstrapFromStorage();
      refreshAfterExternalDataChange();
    }
  });
  $("manualPushBtn")?.addEventListener("click", async () => {
    const result = await manualPush.manualPush();
    updateSyncUsageBadge(result.usage);
    if (result.ok) {
      autoPush.markSynced();
      updateSyncStatusLabel();
    }
  });
  // Auto-sync toggle: pauses/resumes the 60s auto-push backstop only (see sync/autoPush.js) — Manual
  // Push/Pull above are unaffected either way, so a paused user can still sync on demand.
  $("syncEnabledToggle")?.addEventListener("change", (e) => {
    const on = /** @type {HTMLInputElement} */ (e.target).checked;
    syncConfig.setEnabled(on);
    updateSyncStatusIndicator();
    showToast(on ? "Cloud sync resumed." : "Cloud sync paused — Push/Pull still work.", "info");
  });
  updateSyncStatusIndicator();

  // --- Initial paint ---
  refreshView();
  filters.syncControlsFromState();

  // A persisted Active Question should be immediately visible on load/refresh, not just after the
  // user manually clicks the breadcrumb flag link — same reveal jumpToActiveQuestion already does
  // for that click, just triggered once up front instead. Both scroll+flash the question's header
  // (opening only its ancestor Subject/Topic/SubTopic to give it a visible position) WITHOUT ever
  // auto-expanding the question's own answer body. Skipped while Edit Mode is on: that's when
  // someone is mid-editing/reorganizing data, and an unrequested jump+scroll would yank them away
  // from whatever they were about to work on.
  if (appState.activeQuestion && !appState.toggles.editModeOn) {
    activeQuestionFeature.jumpToActiveQuestion();
  }
}

/**
 * Everything syncs through exactly one "current" bin at a time (see sync/bins.js's module doc
 * comment) — so the File Switcher only ever lists files that resolve to it (bins.resolveBinId),
 * never files parked in some other bin the user isn't currently working from. Switching bins (via
 * the Cross-Device Sync modal's "Set as current bin") pulls that bin's files in and this then shows
 * them; files elsewhere aren't lost, just out of view until you switch back.
 */
function updateDeleteFileBtn() {
  const deleteBtn = $("deleteCurrentFileBtn");
  if (deleteBtn) deleteBtn.hidden = appState.activeFileId === null;
}

function renderFileSwitcher() {
  const select = /** @type {HTMLSelectElement} */ ($("fileSwitcher"));
  // First-time users have nothing to sample-load from yet, so "Load Sample" is the obvious next
  // step; once real data exists it's just clutter next to Upload CSV.
  const loadSampleBtn = $("loadSampleBtn");
  if (loadSampleBtn) loadSampleBtn.hidden = appState.files.length > 0;
  // Visible whenever there's an active file, independent of the switcher select itself (which hides
  // once there's only one file to switch between — deleting the sole file is still valid).
  updateDeleteFileBtn();
  if (!select) return;

  const currentBinId = appState.sync.currentBinId;
  const filesHere = appState.files.filter((f) => bins.resolveBinId(f) === currentBinId);

  // The active file can end up outside the current bin right after switching bins (nothing else
  // auto-corrects appState.activeFileId) — snap to one of this bin's own files instead of leaving
  // the tree showing data for a file the switcher itself no longer lists. switchToFile's own
  // onFilesChanged re-runs this function with the corrected state, so just bail out here.
  if (filesHere.length > 0 && !filesHere.some((f) => f.id === appState.activeFileId)) {
    fileManager.switchToFile(filesHere[0].id);
    return;
  }

  // A switcher only means something once there's something to switch between.
  select.hidden = filesHere.length <= 1;
  select.textContent = "";
  if (filesHere.length === 0) {
    // The active file (if any) belongs to some OTHER bin now — clear the working copy so the tree
    // falls back to the "no data" state instead of continuing to show that file's stale content
    // (appState.rawData is never touched by the bin switch itself, only appState.files).
    if (appState.activeFileId !== null) {
      fileManager.clearActiveFile();
      refreshView();
    }
    updateDeleteFileBtn();
    const opt = document.createElement("option");
    opt.textContent = appState.files.length === 0 ? "No files loaded" : "No files in this bin";
    opt.value = "";
    select.appendChild(opt);
    return;
  }
  for (const f of filesHere) {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.fileName;
    select.appendChild(opt);
  }
  select.value = appState.activeFileId || "";
}

document.addEventListener("DOMContentLoaded", init);
