// @ts-check
/**
 * filename.js — export filename auto-versioning: `<name>_<Mon><DD>_v<NNN>.csv`, incrementing
 * `_v002`, `_v003`... on repeated same-day exports so exports never clobber each other. Zero DOM
 * (caller passes in "now" for testability).
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * @param {Date} date
 * @returns {string} e.g. "Aug07"
 */
export function dateToken(date) {
  const mon = MONTHS[date.getMonth()];
  const day = String(date.getDate()).padStart(2, "0");
  return `${mon}${day}`;
}

/**
 * Strips a trailing `.csv` and any existing `_MonDD_vNNN` suffix from a base file name, so
 * re-exporting an already-versioned file doesn't stack suffixes.
 * @param {string} fileName
 * @returns {string}
 */
export function baseNameOf(fileName) {
  let name = fileName.replace(/\.csv$/i, "");
  name = name.replace(/_[A-Za-z]{3}\d{2}_v\d{3}$/, "");
  return name;
}

/**
 * @param {string} fileName Original/base file name (with or without extension).
 * @param {Date} now
 * @param {{lastExportDate: string|null, lastExportVersion: string|null}} lastExport
 * @returns {{fileName: string, exportDate: string, exportVersion: string}}
 */
export function nextExportFileName(fileName, now, lastExport) {
  const base = baseNameOf(fileName);
  const today = dateToken(now);

  let versionNum = 1;
  if (lastExport.lastExportDate === today && lastExport.lastExportVersion) {
    const m = /v(\d+)/.exec(lastExport.lastExportVersion);
    versionNum = (m ? parseInt(m[1], 10) : 0) + 1;
  }
  const exportVersion = `v${String(versionNum).padStart(3, "0")}`;
  return {
    fileName: `${base}_${today}_${exportVersion}.csv`,
    exportDate: today,
    exportVersion,
  };
}
