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
import * as gists from "./sync/gists.js";
import * as store from "./persistence/store.js";
import { STORAGE_KEY } from "./persistence/schema.js";

function $(id) {
  return document.getElementById(id);
}

/**
 * Reflects the cloud data's freshness inside the Sync menu — the compact relative-time label (e.g.
 * "5 min ago") plus the explicit "Synced at [Timestamp] from [activeDevice]" detail line underneath.
 * Called after every push/pull, manual or background (see autoPush.js's onPushed callback and the
 * manualPush/manualPull/session-start-pull handlers below), so both stay current the moment a sync
 * actually happens, not just on next menu open.
 */
function updateSyncStatusLabel() {
  const menuBtn = $("syncMenuBtn");
  const label = $("lastSyncedLabel");
  const detailLabel = $("lastSyncedDetailLabel");
  const text = syncConfig.lastSyncedLabel();
  const title = text === "Never synced" ? text : `Last sync with cloud: ${text}`;
  if (menuBtn) menuBtn.title = title;
  if (label) label.textContent = text;
  if (detailLabel) detailLabel.textContent = syncConfig.lastSyncedDetailLabel();
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
  // A cross-device pull can bring in a themeDark/autoDownloadOn preference set on another device —
  // re-apply both so this device matches immediately, not just after its own next manual toggle.
  // (repaint(), called below via refreshView(), re-syncs the #autoDownloadToggle checkbox itself.)
  theme.applyTheme();
  autoDownload.applyAutoDownloadState();
  // refreshView() first: it recomputes appState.grouped/groupedUnfiltered from the new file's
  // rawData, which filters.syncControlsFromState()'s option lists read from — populating the
  // dropdowns before this recompute would show stale (usually empty) options.
  refreshView();
  filters.syncControlsFromState();
  renderSyncMenuState();
}

/**
 * One-shot check for a pre-Gist-migration schema still carrying JSONBin's `masterKey` field —
 * `coerceSync` (persistence/schema.js) silently drops it on read (there's no meaningful mapping onto
 * a GitHub token/gist id), so this reads the RAW persisted JSON directly, before that coercion, to
 * decide whether to prompt a reconnect. Immediately re-persists the (now-coerced) sync config right
 * after detecting it, so the raw legacy field is gone from storage and this doesn't fire again next
 * load.
 * @returns {boolean}
 */
function detectAndClearLegacyJsonBinConfig() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed?.sync?.masterKey) return false;
  } catch {
    return false;
  }
  store.writeSync(appState.sync);
  return true;
}

function init() {
  // --- Bootstrap state from storage ---
  fileManager.bootstrapFromStorage();
  if (detectAndClearLegacyJsonBinConfig()) {
    showToast("Cross-Device Sync moved from JSONBin to GitHub Gist — reconnect via Sync → Set Up Cloud Sync.", "info");
  }
  tempModeFeature.initTempModeFromStorage(); // re-enters Temp/Test Mode if it was still on at last close
  theme.applyTheme(); // before first paint, so there's no light-theme flash for returning dark-theme users
  autoDownload.applyAutoDownloadState(); // resumes the auto-download timer if it was still on

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
    if (!confirmAction("Reset ALL data? This deletes every uploaded CSV, progress, setting, and Cross-Device Sync connection (GitHub token/gist IDs) from this browser. This cannot be undone.")) return;
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

  const tempModeToggleEl = /** @type {HTMLInputElement|null} */ ($("tempModeToggle"));
  if (tempModeToggleEl) tempModeToggleEl.checked = appState.toggles.tempMode;
  tempModeToggleEl?.addEventListener("change", (e) => {
    const on = /** @type {HTMLInputElement} */ (e.target).checked;
    tempModeFeature.setTempModeOn(on);
    showToast(on ? "Temp/Test Mode ON — nothing will be saved." : "Temp/Test Mode OFF.", "info");
  });

  const autoDownloadToggleEl = /** @type {HTMLInputElement|null} */ ($("autoDownloadToggle"));
  if (autoDownloadToggleEl) autoDownloadToggleEl.checked = !!appState.toggles.autoDownloadOn;
  autoDownloadToggleEl?.addEventListener("change", (e) => {
    const on = /** @type {HTMLInputElement} */ (e.target).checked;
    autoDownload.setAutoDownloadOn(on);
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
  closeAll.initCloseAllShortcut();
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
      autoPush.markSynced(); // setup wizard actions (create/connect/pull/clear) already left local state in sync
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
  // Explicit page-load/refresh message: state what's already known locally about the last sync,
  // independent of whether the session-start pull below finds anything newer — that pull only fires
  // its own toast when it actually applies a fresher update, so this is what tells the user "here's
  // where things stood" on every load, even when nothing new comes in this session.
  if (syncConfig.isSyncConfigured()) {
    const lastSyncDetail = syncConfig.lastSyncedDetailLabel();
    if (lastSyncDetail !== "Never synced") showToast(lastSyncDetail, "info");
  }
  // Push happens automatically a few seconds after each edit (Gist's limits are generous enough to
  // afford this, unlike JSONBin's free tier) — the Push button below just forces it immediately
  // instead of waiting out the debounce. See the silent startup pull below for the read-side backstop.
  autoPush.initAutoPush(
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
    if (result.ok) {
      autoPush.markSynced();
      updateSyncStatusLabel();
    }
  });
  // Auto-sync toggle: pauses/resumes the automatic push-on-edit only (see sync/autoPush.js) — Manual
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

  // --- Session-start pull ---
  // A silent, one-time pull right after the local paint above, not gated behind the manual Pull
  // button's confirm dialog: at this point in the session nothing local has changed yet, so there's
  // nothing of this device's to lose by taking the cloud's version — but pulling mid-session (once
  // edits exist) would risk clobbering unpushed local work with stale cloud data, which is exactly
  // why pull otherwise stays manual-only. Paired with autoPush's push-on-backgrounded/close (see
  // sync/autoPush.js) as the "push at end of session" half.
  //
  // Auto-Pull on Login: only actually applies the pull if the sync gist's real `updated_at` is newer
  // than what this device last knew (appState.sync.lastKnownRemoteUpdatedAt) — that's already stamped
  // fresh by this SAME device's own successful pushes (see sync/gists.js's pushAllChangedFiles), so a
  // newer remote timestamp here reliably means some OTHER device/instance pushed since this one was
  // last open. When that's the case, surface which device and when (activeDevice/updateTimestamp, see
  // sync/device.js) before pulling. gists.pullIfRemoteNewer() does the whole check-then-maybe-apply in
  // one request — there's no cheaper "metadata only" endpoint to peek with first.
  //
  // Deliberately NOT gated behind appState.sync.enabled (the Auto-sync/push toggle) — pausing
  // auto-push shouldn't also silence "check for the latest data on load," since pulling never writes
  // anything remote. A paused device should still open showing whatever's newest.
  if (syncConfig.isSyncConfigured() && !appState.toggles.tempMode) {
    gists.pullIfRemoteNewer().then((result) => {
      if (!result.ok) {
        showToast(`Session-start pull failed: ${result.error || "unknown error"}`, "error");
        return;
      }
      if (!result.applied) return;
      if (result.activeDevice && result.updateTimestamp) {
        showToast(`Found update from last active session from ${result.activeDevice} on ${result.updateTimestamp} - Pulled`, "info");
      }
      if (result.failures && result.failures.length > 0) {
        showToast(`Pulled with ${result.failures.length} file(s) failing — see console for details.`, "error");
      }
      autoPush.markSynced(); // this pull's own writes aren't a new local edit needing a push
      fileManager.bootstrapFromStorage();
      refreshAfterExternalDataChange();
      updateSyncStatusLabel();
    });
  }
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
