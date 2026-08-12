// @ts-check
/**
 * sync/device.js — per-browser/per-instance device identity and IST timestamp formatting, used to
 * attribute pushes across concurrent devices/instances (sync/bins.js's activeDevice/updateTimestamp
 * tracking). The device ID is deliberately stored directly in localStorage rather than through
 * persistence/store.js's synced StorageSchemaV1 envelope: it must stay device-local forever and
 * never be overwritten by a pull or travel inside a pushed bin payload, unlike everything else that
 * module manages.
 */
const DEVICE_ID_KEY = "iqv:deviceId";

function randomSuffix() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID().slice(0, 8);
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 8);
}

/**
 * Best-effort OS name for the device ID's human-readable prefix (e.g. "Windows", "MacOS",
 * "Android", "iOS", "Linux") — cosmetic only, so a coarse userAgent/platform sniff is fine; falls
 * back to "Unknown" rather than throwing on an unrecognized/absent navigator.
 * @returns {string}
 */
function detectOSName() {
  const ua = (typeof navigator !== "undefined" && (navigator.userAgent || navigator.platform)) || "";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/mac os x|macintosh/i.test(ua)) return "MacOS";
  if (/windows/i.test(ua)) return "Windows";
  if (/linux/i.test(ua)) return "Linux";
  return "Unknown";
}

/**
 * @returns {string} This browser/instance's stable device ID, created on first use — an OS-name
 *   prefix plus a random suffix (e.g. "Windows-7f3a9c2b") so the Auto-Pull-on-Login toast can name
 *   which device/instance an update came from without needing a separate lookup table.
 */
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `${detectOSName()}-${randomSuffix()}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * Formats an epoch-ms timestamp as "MMM dd, yyyy HH:mm:ss" in IST (Asia/Kolkata), regardless of the
 * viewer's own timezone — every device/instance should read the same wall-clock time for a given
 * push. Uses hourCycle "h23" (not hour12: false) to sidestep a known Intl quirk where hour12:false
 * can still render midnight as "24" in some engines.
 * @param {number} epochMs
 * @returns {string}
 */
export function formatIST(epochMs) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(epochMs));
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("month")} ${get("day")}, ${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
}
