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
import { configureRefresh, refreshView, repaint, setAfterRepaintHook } from "./features/refresh.js";
import * as activeQuestionFeature from "./features/activeQuestion.js";
import * as filters from "./features/filters.js";
import * as editMode from "./features/editMode.js";
import * as flattenView from "./features/flattenView.js";
import * as dragDropToggle from "./features/dragDropToggle.js";
import * as autoExpand from "./features/autoExpand.js";
import * as dragDrop from "./features/dragDrop.js";
import * as copyVisible from "./features/copyVisible.js";
import * as undoRedo from "./features/undoRedo.js";
import * as closeAll from "./features/closeAll.js";
import * as floatingToggles from "./features/floatingToggles.js";
import * as timer from "./features/timer.js";
import * as search from "./features/search.js";
import * as bulkSelection from "./features/bulkSelection.js";
import * as tempModeFeature from "./features/tempModeFeature.js";
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

/** Shows the default bin's size against the JSONBin free-tier cap as a single Bootstrap progress bar in the Sync menu. */
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

/** Recomputes the usage badge from local state alone (no network call) — see bins.computeDefaultBinUsage. */
function refreshSyncUsageBadge() {
  if (!syncConfig.isSyncConfigured()) return;
  bins.computeDefaultBinUsage().then(updateSyncUsageBadge);
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
  }
}

/** Shows/hides the small dot on the Sync button that flags unpushed local changes. */
function updateSyncDot(dirty) {
  const dot = $("syncMenuStatusDot");
  if (!dot) return;
  dot.hidden = !dirty;
  dot.title = dirty ? "You have local changes not yet pushed to the cloud" : "";
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

  // First-time-mobile-visitor default: Flatten View ON.
  if (flattenView.isMobile() && !localStorage.getItem("iqv:v1")) {
    appState.toggles.flatGroupView = true;
  }

  // --- Wire render engine ---
  const handlers = buildTreeHandlers();
  initTreeRenderer(/** @type {HTMLElement} */ ($("treeRoot")), handlers);
  initFlatRenderer(/** @type {HTMLElement} */ ($("flatRoot")), handlers);
  initStatsBadges(/** @type {HTMLElement} */ ($("globalStatsBadges")), /** @type {HTMLElement} */ ($("globalActionsGroup")));
  initBreadcrumb(/** @type {HTMLElement} */ ($("headerBreadcrumb")), () => activeQuestionFeature.jumpToActiveQuestion());

  configureRefresh({
    stats: {
      onTotalClick: () => filters.clearFilters(),
      onFilteredClick: () => filters.clearGroupFiltersOnly(),
      onStatusBadgeClick: (status) => filters.toggleStatusFilter(status),
    },
    actions: {
      onToggleFlatten: () => flattenView.toggleFlatten(),
      onToggleDragDrop: () => dragDropToggle.toggleDragDrop(),
      onToggleAutoExpand: () => autoExpand.toggleAutoExpandChildren(),
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

  $("resetAllBtn")?.addEventListener("click", () => {
    if (!confirmAction("Reset ALL data? This deletes every uploaded CSV, progress, and setting from this browser. This cannot be undone.")) return;
    fileManager.resetAllData();
    renderFileSwitcher();
    refreshView();
  });

  $("fileSwitcher")?.addEventListener("change", (e) => {
    const id = /** @type {HTMLSelectElement} */ (e.target).value;
    if (id) fileManager.switchToFile(id);
  });

  $("tempModeToggle")?.addEventListener("change", (e) => {
    const on = /** @type {HTMLInputElement} */ (e.target).checked;
    tempModeFeature.setTempModeOn(on);
    showToast(on ? "Temp/Test Mode ON — nothing will be saved." : "Temp/Test Mode OFF.", "info");
  });

  // --- Root-level Bulk Add/Update/Copy ---
  const rootWrap = $("bulkAddRootWrap");
  if (rootWrap) groupPanels.mountGroupPanels("root", {}, rootWrap);

  // --- Search ---
  search.initSearch(/** @type {HTMLInputElement} */ ($("jumpSearchInput")), /** @type {HTMLElement} */ ($("jumpSearchResults")));

  // --- Edit Mode / Drag-Drop / Close All / Undo / Redo / Floating toggles ---
  $("editModeToggleBtn")?.addEventListener("click", () => editMode.toggleEditMode());
  $("closeAllBtn")?.addEventListener("click", () => closeAll.closeAllAccordions());
  $("undoBtn")?.addEventListener("click", () => undoRedo.undo());
  $("redoBtn")?.addEventListener("click", () => undoRedo.redo());
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

  // --- Initial paint ---
  refreshView();
  filters.syncControlsFromState();
}

function renderFileSwitcher() {
  const select = /** @type {HTMLSelectElement} */ ($("fileSwitcher"));
  // First-time users have nothing to sample-load from yet, so "Load Sample" is the obvious next
  // step; once real data exists it's just clutter next to Upload CSV.
  const loadSampleBtn = $("loadSampleBtn");
  if (loadSampleBtn) loadSampleBtn.hidden = appState.files.length > 0;
  if (!select) return;
  // A switcher only means something once there's something to switch between.
  select.hidden = appState.files.length <= 1;
  select.textContent = "";
  if (appState.files.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "No files loaded";
    opt.value = "";
    select.appendChild(opt);
    return;
  }
  for (const f of appState.files) {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.fileName;
    select.appendChild(opt);
  }
  select.value = appState.activeFileId || "";
}

document.addEventListener("DOMContentLoaded", init);
