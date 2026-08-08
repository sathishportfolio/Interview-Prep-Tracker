// @ts-check
/**
 * features/statusFlags.js — Status Flags (Done/ReviewLater/Duplicate/LessImportant/Starred). Thin:
 * calls data/mutations.js.toggleStatusFlag then the shared refresh pipeline. Marking Done also
 * advances the question's spaced-repetition schedule (and unmarking it, or marking Review Later,
 * resets it back to "due soon") — see data/mutations.js scheduleReview.
 */
import { toggleStatusFlag, scheduleReview } from "../data/mutations.js";
import { applyDataChange } from "./refresh.js";
import { appState } from "../state/appState.js";
import { flashHighlight } from "../render/highlight.js";
import { findQuestionHeaderEl } from "../render/treeRenderer.js";
import { setActiveQuestionQuiet } from "./activeQuestion.js";

/**
 * @param {string} questionId
 * @param {"done"|"reviewLater"|"duplicate"|"lessImportant"|"starred"} flag
 */
export function toggleStatus(questionId, flag) {
  const prev = appState.rawData.find((q) => q.id === questionId);
  let rawData = toggleStatusFlag(appState.rawData, questionId, flag);
  if (prev && flag === "done") {
    rawData = scheduleReview(rawData, questionId, prev.done ? "reset" : "advance");
  } else if (prev && flag === "reviewLater" && !prev.reviewLater) {
    rawData = scheduleReview(rawData, questionId, "reset");
  }
  // Starring while an Active Question is already set moves the resume pointer to the question just
  // BEFORE this one in its SubTopic — see setActiveQuestionQuiet's doc comment: on reload this
  // scrolls back to right before the starred question, giving context leading into it rather than
  // landing on the (already-seen) starred question itself. Only when there IS a previous Active
  // Question, so starring never introduces one for users who don't use that feature at all.
  if (prev && !prev.starred && flag === "starred" && appState.activeQuestion) {
    const previousSibling = findPreviousSibling(appState.rawData, prev);
    if (previousSibling) setActiveQuestionQuiet(previousSibling.id);
  }
  applyDataChange({ rawData, emptyGroups: appState.emptyGroups });
  // Toggling starred/lessImportant can move the question within its tier — flash it so the user
  // can find where it landed after the (keyed, so cheap) re-render.
  const el = findQuestionHeaderEl(questionId);
  if (el) flashHighlight(el);
}

/**
 * The sibling immediately before `q` within its own SubTopic, by persisted order — null if `q` is
 * already first.
 * @param {import('../types.js').Question[]} rawData
 * @param {import('../types.js').Question} q
 * @returns {import('../types.js').Question|null}
 */
function findPreviousSibling(rawData, q) {
  const siblings = rawData
    .filter((x) => x.subject === q.subject && x.topic === q.topic && x.subTopic === q.subTopic)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const idx = siblings.findIndex((x) => x.id === q.id);
  return idx > 0 ? siblings[idx - 1] : null;
}
