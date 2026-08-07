// @ts-check
/**
 * features/copyVisible.js — Copy Visible Questions (Global): the primary Copy button in the
 * stats/actions row, same five formats, scoped to whatever is currently visible under active
 * filters across the whole tree (data/copyBuilders.js.buildVisibleCopyText).
 */
import { appState } from "../state/appState.js";
import { buildVisibleCopyText } from "../data/copyBuilders.js";
import { showToast } from "./toast.js";

/**
 * @param {"plain"|"structureWithAnswer"|"structureOnly"|"hierarchy"|"hierarchyOnly"} format
 */
export async function copyVisible(format) {
  const text = buildVisibleCopyText(appState.grouped, format);
  if (!text) {
    showToast("Nothing visible to copy.", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast("Visible questions copied.", "success");
  } catch {
    showToast("Could not copy.", "error");
  }
}
