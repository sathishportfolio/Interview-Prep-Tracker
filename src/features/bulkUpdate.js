// @ts-check
/**
 * features/bulkUpdate.js — Bulk Update (CSV): matches rows against existing questions by
 * Subject+Topic+SubTopic+Question and overwrites answer+flags; unmatched rows are added instead of
 * dropped (data/mutations.js.bulkUpdateRows).
 */
import { parseBulkCsv } from "../data/csv/bulkCsv.js";
import { bulkUpdateRows } from "../data/mutations.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { buildBulkPanel } from "./bulkPanelUI.js";
import * as fileManager from "./fileManager.js";

/**
 * @param {{fixedSubject?: string|null, fixedTopic?: string|null, fixedSubTopic?: string|null}} scope
 * @returns {HTMLElement}
 */
export function createBulkUpdatePanel(scope = {}) {
  return buildBulkPanel({
    label: "Update",
    toggleLabel: "+ Bulk Update (CSV)",
    onSubmit: (text) => {
      if (!fileManager.ensureActiveFileFromPrompt()) return { summaryText: "Cancelled — a file name is required." };
      const parsed = parseBulkCsv(text, scope);
      if (!parsed.ok) return { summaryText: `Error: ${parsed.error}` };
      const result = bulkUpdateRows({ rawData: appState.rawData, emptyGroups: appState.emptyGroups }, parsed.rows);
      applyDataChange({ rawData: result.rawData, emptyGroups: result.emptyGroups });
      const { updated, added, skippedInvalid } = result.summary;
      return {
        summaryText: `Updated ${updated} question(s), added ${added} new. Skipped ${skippedInvalid} invalid row(s).`,
      };
    },
  });
}
