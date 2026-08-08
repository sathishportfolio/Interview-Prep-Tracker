// @ts-check
/**
 * csv/mainCsv.js — parse/serialize the MAIN file CSV format (feature.md "CSV Upload" / "Export
 * Progress"). Required columns: Subject, Topic, SubTopic, Question, Answer, Done, ReviewLater.
 * Optional: Duplicate, LessImportant, Starred, Order, SubjectOrder, TopicOrder, SubTopicOrder.
 * Empty-group placeholders round-trip as marker rows (blank Question). Duplicate-flagged rows are
 * excluded from export. Zero DOM.
 * @typedef {import('../../types.js').Question} Question
 * @typedef {import('../../types.js').EmptyGroup} EmptyGroup
 */
import { parseCsvObjects, serializeCsvObjects } from "./csvCore.js";
import { newQuestionId } from "../id.js";

export const REQUIRED_COLUMNS = ["Subject", "Topic", "SubTopic", "Question", "Answer", "Done", "ReviewLater"];
export const OPTIONAL_COLUMNS = ["Duplicate", "LessImportant", "Starred", "Order", "SubjectOrder", "TopicOrder", "SubTopicOrder", "SrsDue", "SrsStreak"];
export const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

function toBool(v) {
  return String(v).trim().toLowerCase() === "true";
}
function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {string} text
 * @returns {{ok: true, rawData: Question[], emptyGroups: EmptyGroup[]} | {ok: false, error: string}}
 */
export function parseMainCsv(text) {
  const { headers, records } = parseCsvObjects(text);
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    return { ok: false, error: `Missing required column(s): ${missing.join(", ")}` };
  }

  /** @type {Question[]} */
  const rawData = [];
  /** @type {EmptyGroup[]} */
  const emptyGroups = [];
  let emptyOrderCounter = 0;

  for (const rec of records) {
    const subject = (rec.Subject || "").trim();
    const topic = (rec.Topic || "").trim();
    const subTopic = (rec.SubTopic || "").trim();
    const question = (rec.Question || "").trim();

    if (!subject) continue; // fully blank row, skip

    if (!question) {
      // Empty-group marker row: blank Question means this row records a placeholder group.
      emptyGroups.push({
        subject,
        topic: topic || null,
        subTopic: topic && subTopic ? subTopic : null,
        createdOrder: emptyOrderCounter++,
      });
      continue;
    }

    rawData.push({
      id: newQuestionId(),
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
      order: toNum(rec.Order, 0),
      subjectOrder: toNum(rec.SubjectOrder, 0),
      topicOrder: toNum(rec.TopicOrder, 0),
      subTopicOrder: toNum(rec.SubTopicOrder, 0),
      srsDue: rec.SrsDue ? rec.SrsDue.trim() || null : null,
      srsStreak: toNum(rec.SrsStreak, 0),
    });
  }

  return { ok: true, rawData, emptyGroups };
}

/**
 * Serializes rawData + emptyGroups back to CSV text. Duplicate-flagged questions are excluded.
 * @param {Question[]} rawData
 * @param {EmptyGroup[]} emptyGroups
 * @returns {string}
 */
export function serializeMainCsv(rawData, emptyGroups) {
  const records = [];
  for (const q of rawData) {
    if (q.duplicate) continue;
    records.push({
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
      Order: q.order ?? 0,
      SubjectOrder: q.subjectOrder ?? 0,
      TopicOrder: q.topicOrder ?? 0,
      SubTopicOrder: q.subTopicOrder ?? 0,
      SrsDue: q.srsDue ?? "",
      SrsStreak: q.srsStreak ?? 0,
    });
  }
  for (const eg of emptyGroups) {
    records.push({
      Subject: eg.subject,
      Topic: eg.topic ?? "",
      SubTopic: eg.subTopic ?? "",
      Question: "",
      Answer: "",
      Done: "false",
      ReviewLater: "false",
      Duplicate: "false",
      LessImportant: "false",
      Starred: "false",
      Order: 0,
      SubjectOrder: 0,
      TopicOrder: 0,
      SubTopicOrder: 0,
      SrsDue: "",
      SrsStreak: 0,
    });
  }
  return serializeCsvObjects(ALL_COLUMNS, records);
}
