// @ts-check
/**
 * csvCore.js — minimal, dependency-free RFC4180-ish CSV parse/serialize (comma- or tab-delimited,
 * auto-detected per input; double-quote escaping, embedded commas/quotes/newlines supported).
 * Zero DOM. Used by both mainCsv.js and bulkCsv.js so the whole data layer stays independent of
 * any CDN library, and is runnable/testable directly under `node --test`.
 */

/**
 * Sniffs whether pasted text is tab- or comma-delimited by comparing counts on its first line.
 * Excel/Sheets "copy cells → paste" produces tab-separated text with no header quoting, which the
 * comma-only parser used to misread as a single column, so every downstream required-column check
 * failed with "Missing required column(s)". Tabs win ties since a comma is far more likely to
 * appear inside a pasted answer/question cell than a literal tab is.
 * @param {string} text
 * @returns {"," | "\t"}
 */
function detectDelimiter(text) {
  const firstLine = text.split(/\r\n|\n/, 1)[0] || "";
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return tabs >= commas && tabs > 0 ? "\t" : ",";
}

/**
 * @param {string} text
 * @param {"," | "\t"} [delimiter] defaults to auto-detecting comma vs. tab from the first line
 * @returns {string[][]} rows of raw string cells (first row is the header row, if present)
 */
export function parseCsvRows(text, delimiter = detectDelimiter(text)) {
  // Excel/Sheets "copy cells → paste" (tab-delimited) never escapes quote characters inside a
  // cell — a literal " in a question/answer is pasted as-is, not doubled or field-wrapped. Only
  // real comma-delimited CSV (our own export format) uses RFC4180 quoting, so honoring quotes for
  // tab-delimited input made a plain " in pasted text (e.g. `the "protected" modifier`) desync
  // field boundaries and silently corrupt/drop cells.
  const honorQuotes = delimiter === ",";
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
    if (honorQuotes && ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
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
