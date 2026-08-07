// @ts-check
/**
 * persistence/tempMode.js — when Temp/Test Mode is ON, redirects store.js writes to an
 * in-memory Map instead of localStorage, so nothing loaded/edited during the session is
 * persisted. Toggling OFF restores the real localStorage backend (does NOT migrate whatever was
 * held in memory back to disk — that's the intended "preview only" behavior per feature.md).
 */
import { setBackend } from "./store.js";

const memoryStore = new Map();

const memoryBackend = {
  getItem: () => memoryStore.get("data") ?? null,
  setItem: (value) => memoryStore.set("data", value),
};

const localStorageBackend = {
  getItem: () => {
    try {
      return window.localStorage.getItem("iqv:v1");
    } catch {
      return null;
    }
  },
  setItem: (value) => {
    try {
      window.localStorage.setItem("iqv:v1", value);
    } catch {
      // ignore
    }
  },
};

/**
 * @param {boolean} on
 */
export function setTempMode(on) {
  setBackend(on ? memoryBackend : localStorageBackend);
}
