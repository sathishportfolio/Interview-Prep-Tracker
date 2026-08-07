// @ts-check
/**
 * features/bulkCopy.js — Bulk Copy (CSV): exports the current scope (whole filtered set at root,
 * or one Subject/Topic/SubTopic) as CSV text to the clipboard, in the same format Bulk Add/Update
 * expect (data/csv/bulkCsv.js.serializeBulkCsv).
 */
import { serializeBulkCsv } from "../data/csv/bulkCsv.js";
import { appState } from "../state/appState.js";
import { showToast } from "./toast.js";

/**
 * @param {{subject?: string, topic?: string, subTopic?: string}} [scope] Omit for root (whole
 *   filtered set).
 */
export async function bulkCopyScope(scope) {
  let questions = collectFiltered(appState.grouped);
  if (scope) {
    questions = questions.filter(
      (q) =>
        q.subject === scope.subject &&
        (scope.topic == null || q.topic === scope.topic) &&
        (scope.subTopic == null || q.subTopic === scope.subTopic)
    );
  }
  const csv = serializeBulkCsv(questions);
  if (!csv) {
    showToast("Nothing to copy.", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(csv);
    showToast(`Copied ${questions.length} question(s) as CSV.`, "success");
  } catch {
    showToast("Could not copy.", "error");
  }
}

function collectFiltered(tree) {
  const out = [];
  for (const s of tree.subjects) for (const t of s.topics) for (const st of t.subTopics) out.push(...st.questions);
  return out;
}
