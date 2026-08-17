// @ts-check
/**
 * csv/bulkCsv.js — Bulk Add/Update/Copy CSV format (feature.md). Comma-separated, header row
 * required (resolved ambiguity: chosen over README-AI's tab-separated/header-less description).
 * Columns: Subject, Topic, SubTopic, Question, Answer[, Done, ReviewLater, Duplicate,
 * LessImportant, Starred, Failed]. Rows may leave Subject/Topic/SubTopic blank to inherit the
 * previous row's value, or the panel's own fixed scope. Zero DOM.
 * @typedef {import('../../types.js').Question} Question
 */
import { parseCsvObjects, serializeCsvObjects } from "./csvCore.js";

export const BULK_REQUIRED_COLUMNS = ["Subject", "Topic", "SubTopic", "Question", "Answer"];
export const BULK_STATUS_COLUMNS = ["Done", "ReviewLater", "Duplicate", "LessImportant", "Starred", "Failed"];
export const BULK_ALL_COLUMNS = [...BULK_REQUIRED_COLUMNS, ...BULK_STATUS_COLUMNS];

function toBool(v) {
  return String(v ?? "").trim().toLowerCase() === "true";
}

/**
 * @typedef {Object} BulkRow
 * @property {string} subject
 * @property {string} topic
 * @property {string} subTopic
 * @property {string} question
 * @property {string} answer
 * @property {boolean} done
 * @property {boolean} reviewLater
 * @property {boolean} duplicate
 * @property {boolean} lessImportant
 * @property {boolean} starred
 * @property {boolean} failed
 * @property {number} rowIndex 1-based row index in the pasted block (for result reporting)
 */

/**
 * Parses bulk CSV text, applying blank-cell inheritance from the previous row and an optional
 * fixed scope (Subject/Topic pinned by the panel the user opened it from).
 * @param {string} text
 * @param {{fixedSubject?: string|null, fixedTopic?: string|null, fixedSubTopic?: string|null}} [scope]
 * @returns {{ok: true, rows: BulkRow[]} | {ok: false, error: string}}
 */
export function parseBulkCsv(text, scope = {}) {
  const { headers, records } = parseCsvObjects(text);
  if (headers.length === 0) return { ok: false, error: "No header row found." };
  const missing = BULK_REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    return { ok: false, error: `Missing required column(s): ${missing.join(", ")}` };
  }

  let prevSubject = scope.fixedSubject || "";
  let prevTopic = scope.fixedTopic || "";
  let prevSubTopic = scope.fixedSubTopic || "";

  /** @type {BulkRow[]} */
  const rows = [];
  records.forEach((rec, idx) => {
    const subjectRaw = (rec.Subject || "").trim();
    const topicRaw = (rec.Topic || "").trim();
    const subTopicRaw = (rec.SubTopic || "").trim();
    const question = (rec.Question || "").trim();

    const subject = scope.fixedSubject != null && scope.fixedSubject !== "" ? scope.fixedSubject : subjectRaw || prevSubject;
    const topic = scope.fixedTopic != null && scope.fixedTopic !== "" ? scope.fixedTopic : topicRaw || prevTopic;
    const subTopic = scope.fixedSubTopic != null && scope.fixedSubTopic !== "" ? scope.fixedSubTopic : subTopicRaw || prevSubTopic;

    prevSubject = subject;
    prevTopic = topic;
    prevSubTopic = subTopic;

    rows.push({
      subject,
      topic,
      subTopic,
      question,
      answer: rec.Answer || "",
      done: toBool(rec.Done),
      reviewLater: toBool(rec.ReviewLater),
      duplicate: toBool(rec.Duplicate),
      lessImportant: toBool(rec.LessImportant),
      starred: toBool(rec.Starred),
      failed: toBool(rec.Failed),
      rowIndex: idx + 1,
    });
  });

  return { ok: true, rows };
}

/**
 * Serializes questions to the Bulk CSV format (used by Bulk Copy).
 * @param {Question[]} questions
 * @returns {string}
 */
export function serializeBulkCsv(questions) {
  const records = questions.map((q) => ({
    Subject: q.subject,
    Topic: q.topic,
    SubTopic: q.subTopic,
    Question: q.question,
    Answer: q.answer,
    Done: q.done ? "true" : "false",
    ReviewLater: q.reviewLater ? "true" : "false",
    Duplicate: q.duplicate ? "true" : "false",
    LessImportant: q.lessImportant ? "true" : "false",
    Starred: q.starred ? "true" : "false",
    Failed: q.failed ? "true" : "false",
  }));
  return serializeCsvObjects(BULK_ALL_COLUMNS, records);
}

/**
 * A sample starter row for the "Copy/insert sample row" link. Subject/Topic/SubTopic default to
 * literal placeholder text, but callers (bulkPanelUI.js) pass through the panel's own fixed scope —
 * or, for a root-level panel with no fixed scope, whichever Subject/Topic/SubTopic is currently
 * expanded in the accordion — so the sample reflects where the user's actually adding to instead of
 * always requiring a find-and-replace before pasting.
 * @param {{subject?: string, topic?: string, subTopic?: string}} [scope]
 * @returns {string}
 */
export function sampleBulkRow(scope = {}) {
  const record = {
    Subject: scope.subject || "Subject",
    Topic: scope.topic || "Topic",
    SubTopic: scope.subTopic || "SubTopic",
    Question: "Sample question text",
    Answer: "Sample answer",
    Done: "false",
    ReviewLater: "false",
    Duplicate: "false",
    LessImportant: "false",
    Starred: "false",
    Failed: "false",
  };
  return serializeCsvObjects(BULK_ALL_COLUMNS, [record]);
}
