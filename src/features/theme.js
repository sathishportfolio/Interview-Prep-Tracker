// @ts-check
/**
 * features/theme.js — Dark/Light theme toggle. A persisted global toggle like dragDropOn/
 * flatGroupView (see appState.toggles), not a separate localStorage key, so it round-trips through
 * cloud sync the same way those do. Enforcement is pure CSS via `documentElement[data-theme]` —
 * see css/style.css's `:root` vs `:root[data-theme="dark"]` variable blocks.
 */
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { repaint } from "./refresh.js";

/** Applies appState.toggles.themeDark to the document — call once at boot, before first repaint. */
export function applyTheme() {
  const dark = appState.toggles.themeDark;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  // Bootstrap 5.3+'s own color mode — every Bootstrap-class button/input/select/badge in
  // index.html reads its colors from this, so it dark-themes them for free instead of us having
  // to override Bootstrap's hardcoded light defaults one component at a time.
  document.documentElement.setAttribute("data-bs-theme", dark ? "dark" : "light");
  const btn = document.getElementById("themeToggleBtn");
  if (btn) {
    btn.title = dark ? "Switch to Light Theme" : "Switch to Dark Theme";
    btn.innerHTML = `<i class="fa-solid ${dark ? "fa-sun" : "fa-moon"}"></i>`;
  }
}

export function toggleTheme() {
  appState.toggles = { ...appState.toggles, themeDark: !appState.toggles.themeDark };
  store.writeGlobalToggles(appState.toggles);
  applyTheme();
  repaint();
}
