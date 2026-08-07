// @ts-check
/**
 * csvCore.js — minimal, dependency-free RFC4180-ish CSV parse/serialize (comma-separated,
 * double-quote escaping, embedded commas/quotes/newlines supported). Zero DOM. Used by both
 * mainCsv.js and bulkCsv.js so the whole data layer stays independent of any CDN library, and is
 * runnable/testable directly under `node --test`.
 */

/**
 * @param {string} text
 * @returns {string[][]} rows of raw string cells (first row is the header row, if present)
 */
export function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  function pushField() {
    row.push(field);
    field = "";
  }
  function pushRow() {
    pushField();
    rows.push(row);
    row = [];
  }

  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // final field/row (if the text didn't end with a newline)
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }
  // drop trailing fully-empty rows (trailing blank lines)
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c === "")) {
    rows.pop();
  }
  return rows;
}

/**
 * Parses CSV text with a header row into an array of plain objects keyed by header name.
 * @param {string} text
 * @returns {{headers: string[], records: Record<string, string>[]}}
 */
export function parseCsvObjects(text) {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((row) => {
    /** @type {Record<string, string>} */
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] ?? "";
    });
    return obj;
  });
  return { headers, records };
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeCsvField(value) {
  const str = value == null ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * @param {string[]} headers
 * @param {Array<Record<string, any>>} records
 * @returns {string}
 */
export function serializeCsvObjects(headers, records) {
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const rec of records) {
    lines.push(headers.map((h) => escapeCsvField(rec[h])).join(","));
  }
  return lines.join("\r\n");
}
