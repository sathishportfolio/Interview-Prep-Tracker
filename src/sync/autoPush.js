// @ts-check
/**
 * sync/autoPush.js — the primary push path. Gist's request/size limits are generous enough
 * (unlike JSONBin's free tier, which is why this used to be a manual-first 60s backstop) that local
 * edits now push automatically: a short debounce after the last "iqv:persisted" event coalesces
 * rapid successive edits into one push instead of firing per keystroke. `appState.sync.enabled`
 * (the Sync menu's Auto-sync toggle) gates the actual push attempts (the debounced push and the
 * visibilitychange safety-net push never fire while off, conserving API usage) but NOT the dirty
 * flag itself — the status dot still tracks "does the cloud have my latest changes?" even while
 * paused, so the user always has an honest signal regardless of the toggle. Manual Push/Pull are
 * unaffected either way.
 *
 * "Dirty" is tracked from the "iqv:persisted" DOM event (persistence/store.js's explicit hook), but
 * that event also fires for writes that a pull/sync action itself makes (applying remote data
 * locally, or a successful push recording its own lastPushAt) — those aren't new local edits needing
 * a push. Callers of any sync action that writes local state (manualPull, syncConfig's setup wizard)
 * must call markSynced() once they're done, to override the transient dirty flag those writes leave
 * behind. doPush() guards against its own push's writes the same way (via `pushing`) — without that
 * guard, pushAllChangedFiles()'s `store.writeSync` on success would re-mark dirty and re-arm the
 * debounce from inside doPush itself, auto-pushing forever every DEBOUNCE_MS even with no real edits.
 *
 * Besides the debounce, a "visibilitychange" listener fires an immediate push the moment the tab is
 * backgrounded/closed while dirty — the actual "push at end of session" behavior (app.js separately
 * does a one-time silent pull at startup, the "pull at start of session" half): relying on the
 * debounce timer alone means a quick visit-edit-close cycle can close the tab before it ever fires,
 * and beforeunload can't reliably await an async fetch, so this is the best-effort save point.
 */
import { appState } from "../state/appState.js";
import * as gists from "./gists.js";

const DEBOUNCE_MS = 3000;
let debounceHandle = null;
let dirty = false;
let pushing = false;
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
 * @param {() => void} [pushedCallback] Called after each successful auto-push (e.g. to refresh a
 *   "last synced" label).
 * @param {(dirty: boolean) => void} [dirtyChangeCallback] Called whenever the unsynced-changes flag
 *   flips (e.g. to toggle a status dot in the toolbar).
 */
export function initAutoPush(pushedCallback, dirtyChangeCallback) {
  onPushed = pushedCallback || null;
  onDirtyChange = dirtyChangeCallback || null;
  document.addEventListener("iqv:persisted", () => {
    if (pushing) return; // this write is doPush()'s own bookkeeping, not a new local edit
    if (!appState.sync || !appState.sync.githubToken || !appState.sync.configGistId) return;
    if (appState.toggles.tempMode) return; // temp mode never syncs
    // Dirty tracking (the status dot) reflects reality regardless of Auto-sync being paused, so the
    // user can always tell whether the cloud is behind — only the actual debounced push is gated by
    // sync.enabled, to conserve API usage while paused.
    setDirty(true);
    if (!appState.sync.enabled) return;
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
  // waiting out the rest of the debounce.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    if (!dirty || pushing) return;
    if (!appState.sync.enabled) return; // paused: dirty dot stays lit, but no push happens behind the user's back
    if (debounceHandle) {
      clearTimeout(debounceHandle);
      debounceHandle = null;
    }
    doPush();
  });
}

/** Clears the dirty flag and any pending auto-push without pushing — call after a sync action (manual push/pull, sync setup) already left local state in sync with the cloud. */
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
  const result = await gists.pushAllChangedFiles();
  pushing = false;
  if (result.ok) {
    setDirty(false);
    if (onPushed) onPushed();
  } else if (result.blocked) {
    // Silent by design (see this module's doc comment) — the dirty dot stays lit as the only
    // user-facing signal; the next edit re-arms the debounce and tries again. Logged for
    // debuggability without interrupting the user on every blocked background attempt.
    console.warn(`Cross-Device Sync: auto-push blocked (${result.blocked}): ${result.error}`);
  }
}
