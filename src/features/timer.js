// @ts-check
/**
 * features/timer.js — Study Timer: global stopwatch (Start/Pause/Reset). Elapsed time persists
 * across reloads while running (persistence/store.js.writeTimer on every start/pause/tick-save).
 */
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";

let intervalHandle = null;
let displayEl = null;

/** @param {HTMLElement} el */
export function initTimerDisplay(el) {
  displayEl = el;
  if (appState.timer.running) {
    startTicking();
  }
  render();
}

function currentElapsedMs() {
  if (appState.timer.running && appState.timer.startedAt) {
    return appState.timer.elapsedMs + (Date.now() - appState.timer.startedAt);
  }
  return appState.timer.elapsedMs;
}

function render() {
  if (!displayEl) return;
  const ms = currentElapsedMs();
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  displayEl.textContent = `${h}:${m}:${s}`;
}

function startTicking() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = setInterval(render, 1000);
}

export function startTimer() {
  if (appState.timer.running) return;
  appState.timer = { running: true, elapsedMs: appState.timer.elapsedMs, startedAt: Date.now() };
  store.writeTimer(appState.timer);
  startTicking();
  render();
}

export function pauseTimer() {
  if (!appState.timer.running) return;
  appState.timer = { running: false, elapsedMs: currentElapsedMs(), startedAt: null };
  store.writeTimer(appState.timer);
  if (intervalHandle) clearInterval(intervalHandle);
  render();
}

export function resetTimer() {
  appState.timer = { running: false, elapsedMs: 0, startedAt: null };
  store.writeTimer(appState.timer);
  if (intervalHandle) clearInterval(intervalHandle);
  render();
}
