// @ts-check
/**
 * sync/autoPush.js — safety-net auto-push, not a replacement for the Push button. Local edits are
 * NOT pushed immediately (JSONBin's free tier has tight request-rate/size limits, so pushing per
 * edit was removed — see manualPush.js) but leaving a change sitting unpushed indefinitely risks
 * losing it if the tab closes, so: (1) after DEBOUNCE_MS of no further local changes, auto-push
 * once, and (2) block tab close while a change is known to be unpushed. `appState.sync.enabled`
 * (the Sync menu's Auto-sync toggle) gates this entirely — while off, edits never mark dirty and
 * this backstop never fires, conserving API usage; Manual Push/Pull are unaffected either way.
 *
 * "Dirty" is tracked from the "iqv:persisted" DOM event (persistence/store.js's explicit hook), but
 * that event also fires for writes that a pull/sync action itself makes (applying remote data
 * locally, or a successful push recording its own lastPushAt) — those aren't new local edits needing
 * a push. Callers of any sync action that writes local state (manualPull, syncConfig's bin
 * management) must call markSynced() once they're done, to override the transient dirty flag those
 * writes leave behind. doPush() guards against its own push's writes the same way (via `pushing`) —
 * without that guard, pushBin()'s `store.writeSync` on success would re-mark dirty and re-arm the
 * debounce from inside doPush itself, auto-pushing forever every DEBOUNCE_MS even with no real edits.
 *
 * Besides the 60s debounce, a "visibilitychange" listener fires an immediate push the moment the tab
 * is backgrounded/closed while dirty — the actual "push at end of session" behavior (app.js separately
 * does a one-time silent pull at startup, the "pull at start of session" half): relying on the 60s
 * timer alone means a quick visit-edit-close cycle can close the tab before the debounce ever fires,
 * and beforeunload can't reliably await an async gzip+fetch, so this is the best-effort save point.
 */
import { appState } from "../state/appState.js";
import * as bins from "./bins.js";

const DEBOUNCE_MS = 60000;
let debounceHandle = null;
let dirty = false;
let pushing = false;
let onUsageUpdate = null;
let onPushed = null;
let onDirtyChange = null;

/** @param {boolean} next */
function setDirty(next) {
  if (dirty === next) return;
  dirty = next;
  if (onDirtyChange) onDirtyChange(dirty);
}

/** @returns {boolean} true if a local change hasn't been pushed to the cloud yet */
export function isDirty() {
  return dirty;
}

/**
 * @param {(usage: {percent: number, overCap: boolean}) => void} callback Fires after each auto-push
 *   attempt with the current bin's usage against the free-tier cap.
 * @param {() => void} [pushedCallback] Called after each successful auto-push (e.g. to refresh a
 *   "last synced" label).
 * @param {(dirty: boolean) => void} [dirtyChangeCallback] Called whenever the unsynced-changes flag
 *   flips (e.g. to toggle a status dot in the toolbar).
 */
export function initAutoPush(callback, pushedCallback, dirtyChangeCallback) {
  onUsageUpdate = callback;
  onPushed = pushedCallback || null;
  onDirtyChange = dirtyChangeCallback || null;
  document.addEventListener("iqv:persisted", () => {
    if (pushing) return; // this write is doPush()'s own bookkeeping, not a new local edit
    if (!appState.sync || !appState.sync.masterKey || !appState.sync.currentBinId || !appState.sync.enabled) return;
    if (appState.toggles.tempMode) return; // temp mode never syncs
    setDirty(true);
    if (debounceHandle) clearTimeout(debounceHandle);
    debounceHandle = setTimeout(doPush, DEBOUNCE_MS);
  });
  window.addEventListener("beforeunload", (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });
  // Fires on tab close, tab switch, and app backgrounding alike (unlike beforeunload, which only
  // covers the close/navigate case and can't reliably await this async push anyway) — the earliest
  // reliable signal that the session might be ending, so the safety-net push happens here instead of
  // waiting out the rest of the 60s debounce.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    if (!dirty || pushing) return;
    if (debounceHandle) {
      clearTimeout(debounceHandle);
      debounceHandle = null;
    }
    doPush();
  });
}

/** Clears the dirty flag and any pending auto-push without pushing — call after a sync action (manual push/pull, bin management) already left local state in sync with the cloud. */
export function markSynced() {
  setDirty(false);
  if (debounceHandle) {
    clearTimeout(debounceHandle);
    debounceHandle = null;
  }
}

async function doPush() {
  debounceHandle = null;
  pushing = true;
  const result = await bins.pushCurrentBinIfChanged();
  const pushed = result.ok;
  pushing = false;
  if (pushed) setDirty(false);

  const usage = await bins.computeCurrentBinUsage();
  if (onUsageUpdate) onUsageUpdate(usage);

  if (pushed && onPushed) onPushed();
}
