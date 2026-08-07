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
import * as autoPush from "./sync/autoPush.js";
import * as autoPull from "./sync/autoPull.js";
import * as manualPull from "./sync/manualPull.js";

function $(id) {
  return document.getElementById(id);
}

/** Reflects the last push/pull time next to the Manual Pull button's icon, e.g. "Aug 7, 2026". */
function updateManualPullBtnTitle() {
  const btn = $("manualPullBtn");
  const label = $("lastSyncedLabel");
  const text = syncConfig.lastSyncedLabel();
  if (btn) btn.title = `Pull from cloud — Last synced: ${text}`;
  if (label) label.textContent = text;
}

/** Shared refresh after anything that changes appState.files/filters from outside the normal edit flow (file switch, load, or a sync pull/move/copy/fetch). */
function refreshAfterExternalDataChange() {
  renderFileSwitcher();
  // refreshView() first: it recomputes appState.grouped/groupedUnfiltered from the new file's
  // rawData, which filters.syncControlsFromState()'s option lists read from — populating the
  // dropdowns before this recompute would show stale (usually empty) options.
  refreshView();
  filters.syncControlsFromState();
  updateManualPullBtnTitle();
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

  $("downloadProgressBtn")?.addEventListener("click", () => fileManager.downloadProgressCsv());
  $("copyProgressCsvBtn")?.addEventListener("click", () => fileManager.copyProgressCsvToClipboard());

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
  $("bulkDeleteSelectedBtn")?.addEventListener("click", () => {
    if (appState.selectedGroupKeys.size > 0) bulkSelection.bulkDeleteSelectedGroups();
  });
  $("bulkClearSelectedBtn")?.addEventListener("click", () => bulkSelection.clearAllSelections());
  $("bulkMoveSelectedBtn")?.addEventListener("click", async () => {
    if (appState.selectedQuestionIds.size === 0) return;
    const { openMoveForm } = await import("./features/moveForm.js");
    openMoveForm([...appState.selectedQuestionIds]);
  });

  // --- Timer ---
  timer.initTimerDisplay(/** @type {HTMLElement} */ ($("timerDisplay")));
  $("timerStartBtn")?.addEventListener("click", () => timer.startTimer());
  $("timerPauseBtn")?.addEventListener("click", () => timer.pauseTimer());
  $("timerResetBtn")?.addEventListener("click", () => timer.resetTimer());

  // --- Sync ---
  syncConfig.initSyncConfig({
    onSyncedDataChanged: () => {
      fileManager.bootstrapFromStorage();
      refreshAfterExternalDataChange();
    },
  });
  $("syncSettingsBtn")?.addEventListener("click", () => syncConfig.openSyncManager());
  updateManualPullBtnTitle();
  $("manualPullBtn")?.addEventListener("click", async () => {
    const result = await manualPull.manualPull();
    if (result.ok) {
      fileManager.bootstrapFromStorage();
      refreshAfterExternalDataChange();
    }
  });
  autoPush.initAutoPush(
    (usage) => {
      const badge = $("syncUsageBadge");
      if (!badge) return;
      badge.hidden = false;
      badge.textContent = `${usage.percent}%`;
      badge.classList.toggle("badge-green", !usage.overCap);
      badge.classList.toggle("badge-red", usage.overCap);
    },
    () => updateManualPullBtnTitle()
  );
  if (syncConfig.isSyncConfigured()) {
    autoPull.checkAndPullIfNewer().then((result) => {
      if (result.changed) {
        fileManager.bootstrapFromStorage();
        refreshAfterExternalDataChange();
        showToast("Synced newer data from the cloud.", "info");
      }
    });
  }

  // --- Initial paint ---
  refreshView();
  filters.syncControlsFromState();
}

function renderFileSwitcher() {
  const select = /** @type {HTMLSelectElement} */ ($("fileSwitcher"));
  if (!select) return;
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
