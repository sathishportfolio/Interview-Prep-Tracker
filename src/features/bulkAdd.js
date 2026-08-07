// @ts-check
/**
 * features/bulkAdd.js — Bulk Add (CSV): "+ Bulk Add (CSV)" panel at root/Subject/Topic/SubTopic.
 * Thin: data/csv/bulkCsv.js parses, data/mutations.js.bulkAddRows applies, refresh repaints.
 */
import { parseBulkCsv } from "../data/csv/bulkCsv.js";
import { bulkAddRows } from "../data/mutations.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { buildBulkPanel } from "./bulkPanelUI.js";

/**
 * @param {{fixedSubject?: string|null, fixedTopic?: string|null, fixedSubTopic?: string|null}} scope
 * @returns {HTMLElement}
 */
export function createBulkAddPanel(scope = {}) {
  return buildBulkPanel({
    label: "Add",
    toggleLabel: "+ Bulk Add (CSV)",
    onSubmit: (text) => {
      const parsed = parseBulkCsv(text, scope);
      if (!parsed.ok) return { summaryText: `Error: ${parsed.error}` };
      const result = bulkAddRows({ rawData: appState.rawData, emptyGroups: appState.emptyGroups }, parsed.rows);
      applyDataChange({ rawData: result.rawData, emptyGroups: result.emptyGroups });
      const { added, skippedDuplicate, skippedInvalid } = result.summary;
      return {
        summaryText: `Added ${added} question(s). Skipped ${skippedDuplicate} duplicate(s), ${skippedInvalid} invalid row(s).`,
      };
    },
  });
}
