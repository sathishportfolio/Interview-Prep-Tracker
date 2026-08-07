// @ts-check
/**
 * sync/gzip.js — gzip compression via the browser's native CompressionStream/DecompressionStream,
 * base64-encoded for JSON transport to JSONBin (which stores JSON text). Kept separate from
 * jsonbin.js so the compression concern is independently testable/swappable.
 */

/**
 * @param {string} text
 * @returns {Promise<string>} base64-encoded gzip bytes
 */
export async function gzipToBase64(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  return bufferToBase64(buf);
}

/**
 * @param {string} base64
 * @returns {Promise<string>}
 */
export async function gunzipFromBase64(base64) {
  const buf = base64ToBuffer(base64);
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

/** @param {ArrayBuffer} buf */
function bufferToBase64(buf) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** @param {string} base64 */
function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
