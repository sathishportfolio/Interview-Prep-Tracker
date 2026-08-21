// @ts-check
/**
 * sync/gists.js — the sync engine, single shared gist. Every CSV file and the app-level singletons
 * (`globalToggles`/`activeQuestion`/`timer`/device-tracking meta) all live as separate FILES inside
 * one gist (`appState.sync.configGistId`) — not one gist per CSV. This means there's no separate
 * "manifest" pointer list to go stale or point at the wrong place (an earlier per-file-gist design
 * had exactly that bug: a wrong gist id could get wired up as the pointer target and corrupt
 * whatever it actually pointed at). Everything needed to reconstruct local state — every file's own
 * `id`/`fileName`/content — is self-contained in that one file's own JSON blob, discovered simply by
 * enumerating the gist's `files` object on pull.
 *
 * Each CSV file's blob is named after its own `fileName` (sanitized, deduped — see
 * assignGistFilenames) rather than a generic "data.json", so the gist reads legibly on
 * gist.github.com. The one meta blob is named META_FILENAME and its presence is what distinguishes
 * "this is actually the sync gist" from a stray/wrong gist id (see applyRemotePullResult).
 *
 * Version + write lock: the meta blob also carries a monotonically increasing `version` and an
 * `activeDevice` write lock, giving pushes optimistic-concurrency protection against two devices
 * clobbering each other's changes (see pushAllChangedFiles' pre-push validation). This is
 * best-effort, not a true distributed lock — the Gist API has no compare-and-swap primitive, so the
 * fetch-check-then-write in pushAllChangedFiles has an inherent (narrow) race window no matter how
 * many round trips are spent on it. The lock auto-releases as part of every successful push (written
 * back as `activeDevice: null` in the SAME request that bumps the version), rather than requiring a
 * separate acquire/release step or risking a device that goes offline mid-edit locking everyone else
 * out forever. `activeDevice` (the lock) is intentionally a separate field from `lastWriter`/
 * `lastWriteTimestamp` (which device most recently completed a write, for the "Synced at ... from
 * ..." display) — the lock is almost always null, but the display fields should always show the
 * real last writer.
 * @typedef {import('../types.js').FileRecord} FileRecord
 */
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { createGist, pushToGist, pullFromGist, usageAgainstSafeCeiling } from "./github.js";
import { getDeviceId, getDeviceLabel, formatIST } from "./device.js";
import { minifyAllAnswers } from "../data/answerFormat.js";
import { mergeRawData } from "../data/syncMerge.js";
import { pruneEmptyGroups } from "../data/emptyGroups.js";

const META_FILENAME = "_sync-meta.json";

/**
 * Cheap non-cryptographic string hash (djb2) — only used to notice "did this content change since
 * it was last pushed" for duplicate-push protection, never for anything security-sensitive.
 * @param {string} str
 * @returns {string}
 */
function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/** @param {FileRecord} file @returns {string} JSON content this file's gist blob should hold. */
function serializeFileContent(file) {
  const { id, fileName, rawData, emptyGroups, filters, lastExportVersion, lastExportDate, tombstones } = file;
  return JSON.stringify({ id, fileName, rawData, emptyGroups, filters, lastExportVersion, lastExportDate, tombstones: tombstones ?? [] });
}

/**
 * Runs the same answer-HTML normalization fileManager.bootstrapFromStorage applies on every load,
 * BEFORE serializing for push — mutates `file.rawData` in place if it changes anything. Without this,
 * a freshly-loaded CSV (upload/sample) gets pushed with its raw, un-normalized answer HTML, then
 * bootstrapFromStorage normalizes it moments later (on the very next reload/pull-triggered refresh)
 * — the local copy now silently disagrees with what was actually pushed, so the NEXT push thinks
 * there's a real content change (there isn't, just normalization drift) and re-sends + bumps version
 * for nothing. Normalizing here first means the pushed content always already matches what any device
 * would normalize it to anyway, so there's nothing left to drift.
 * @param {FileRecord} file
 * @returns {string}
 */
function serializeNormalizedFileContent(file) {
  const result = minifyAllAnswers(file.rawData);
  if (result.changed) file.rawData = result.rawData;
  return serializeFileContent(file);
}

/**
 * @param {{version: number, activeDevice: string|null}} lock
 * @returns {string}
 */
function serializeMetaContent({ version, activeDevice }) {
  return JSON.stringify({
    schemaVersion: 1,
    version,
    activeDevice,
    lastWriter: getDeviceLabel(),
    lastWriteTimestamp: formatIST(Date.now()),
    globalToggles: appState.toggles,
    activeQuestion: appState.activeQuestion,
    timer: appState.timer,
    globalTags: appState.globalTags,
  });
}

/**
 * "Interview-Prep-Tracker-DD-MM-YYYY-hh-mmam" — the gist's own description, refreshed on every
 * create/push so it reads as a human-friendly "last touched" stamp directly in the gist.github.com
 * listing, without needing to open the gist to see the meta blob's own timestamp.
 * @returns {string}
 */
function syncGistDescription() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(Date.now());
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  const ampm = get("dayPeriod").toLowerCase().replace(/[^a-z]/g, "");
  return `Interview-Prep-Tracker-${get("day")}-${get("month")}-${get("year")}-${get("hour")}-${get("minute")}${ampm}`;
}

/** @param {string} str @returns {number} rough UTF-8 byte size of a string, for the safe-ceiling check. */
function byteLength(str) {
  return new Blob([str]).size;
}

/**
 * Informational only (Gist has no hard per-file cap like JSONBin's bin-size cap) — used by
 * syncConfig.js to flag a file nearing the practical ~1MB/file safe ceiling.
 * @param {FileRecord} file
 * @returns {{percent: number, overCap: boolean}}
 */
export function computeFileUsage(file) {
  return usageAgainstSafeCeiling(byteLength(serializeFileContent(file)));
}

/** @param {string} fileName @returns {string} */
function sanitizeBase(fileName) {
  return (fileName || "file").trim().replace(/[^\w.\- ]+/g, "_") || "file";
}

/**
 * Assigns a stable, unique gist filename to every file that doesn't already have one — mutates
 * `file.gistFileName` in place. Existing assignments are never changed (fileNames are immutable once
 * a file is created, so a name assigned on first push stays correct forever); only newly-loaded files
 * get a name computed here. Two different fileNames can in rare cases sanitize to the same base
 * string (e.g. "My File!" and "My File?") — disambiguated with a " (2)", " (3)", ... suffix so they
 * never silently collide and overwrite each other's blob.
 * @param {FileRecord[]} files
 */
function assignGistFilenames(files) {
  const used = new Set(files.map((f) => f.gistFileName).filter(Boolean));
  for (const file of files) {
    if (file.gistFileName) continue;
    const base = sanitizeBase(file.fileName);
    let candidate = `${base}.json`;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${base} (${n}).json`;
      n++;
    }
    file.gistFileName = candidate;
    used.add(candidate);
  }
}

/**
 * Parses the meta blob out of a pulled gist payload — read-safety guard: wrapped in try/catch, never
 * throws, returns null on ANY formatting problem (missing file, malformed JSON, non-object) so every
 * caller can fall back to "treat as unreadable" instead of crashing or applying garbage state.
 * @param {{files: Record<string, {content: string}>}} result
 * @returns {any|null}
 */
function parseMeta(result) {
  const raw = result.files[META_FILENAME]?.content;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Applies an already-fetched gist payload (from pullFromGist) to local state. Validates the meta
 * blob is present/parseable FIRST (see parseMeta) — a genuine sync gist is ALWAYS created with
 * META_FILENAME (see createNewSyncGist/pushAllChangedFiles), so its absence/corruption means this
 * gist id isn't actually the sync gist, or its last write was somehow malformed — either way,
 * lastSyncedLabel/lastRemoteActiveDevice/knownVersion are only ever updated below AFTER this parse
 * succeeds, never from a failed/partial read.
 *
 * Per-question merge (not whole-file replace): for a file already known locally (has a
 * gistFileName), the remote blob's rawData/tombstones are merged against this device's own
 * pre-pull copy via data/syncMerge.js's mergeRawData — per question id, whichever side has the
 * newer updatedAt (or, for a delete, the newer deletedAt tombstone) wins. This is what lets two
 * devices edit DIFFERENT questions in the same file without syncing in between and have both edits
 * survive, instead of one device's whole-file push silently clobbering the other's. emptyGroups/
 * filters/export metadata stay a plain remote-replaces-local value (no smarter merge attempted
 * there) — emptyGroups is pruned against the MERGED rawData afterward so a placeholder doesn't
 * linger next to a question the merge just brought back.
 * Exported (in addition to being used internally by pullAllFiles/pullIfRemoteNewer) so tests can
 * exercise the merge logic directly against a fabricated gist payload without mocking fetch — see
 * gists.test.js's headline regression test for the per-question merge this function implements.
 * @param {{files: Record<string, {content: string}>, updatedAt: number|null}} result
 * @returns {{ok: boolean, error?: string, failures?: Array<{fileName: string, error: string}>}}
 */
export function applyRemotePullResult(result) {
  const meta = parseMeta(result);
  if (!meta) return { ok: false, error: `This gist has no readable "${META_FILENAME}" file — it isn't the sync gist (maybe the wrong gist id was pasted, or its last write was corrupted?).` };

  // Pre-pull local snapshot, keyed by id — used ONLY to merge against a file that already has a
  // gistFileName below (the byId accumulator itself is pre-seeded with never-pushed files only, so
  // it can't be used for that lookup: see the seeding comment right after this).
  const localById = new Map(appState.files.map((f) => [f.id, f]));

  // Seed ONLY with files that have never been pushed (gistFileName null) — there's nothing remote to
  // reconcile those against, so they survive untouched. Every file that HAS a gistFileName must come
  // from what's actually still present in the remote gist below: if another device deleted it, its
  // blob is simply absent from result.files, and it must NOT survive the pull. Seeding from the full
  // local file list (the previous approach) meant a remote delete could never propagate — a locally
  // known file just stayed forever regardless of whether the gist still had it.
  const byId = new Map(appState.files.filter((f) => !f.gistFileName).map((f) => [f.id, f]));
  /** @type {Array<{fileName: string, error: string}>} */
  const failures = [];
  for (const [filename, f] of Object.entries(result.files)) {
    if (filename === META_FILENAME) continue;
    try {
      const content = JSON.parse(f.content);
      const remoteTombstones = Array.isArray(content.tombstones) ? content.tombstones : [];
      const localFile = localById.get(content.id);

      let mergedRawData = content.rawData;
      let mergedTombstones = remoteTombstones;
      if (localFile) {
        const merged = mergeRawData(
          { rawData: localFile.rawData, tombstones: localFile.tombstones ?? [] },
          { rawData: content.rawData, tombstones: remoteTombstones }
        );
        mergedRawData = merged.rawData;
        mergedTombstones = merged.tombstones;
      }
      const mergedContent = {
        ...content,
        rawData: mergedRawData,
        tombstones: mergedTombstones,
        emptyGroups: pruneEmptyGroups(content.emptyGroups, mergedRawData),
      };
      byId.set(content.id, {
        ...mergedContent,
        gistFileName: filename,
        lastPushedHash: hashString(serializeFileContent(/** @type {FileRecord} */ (mergedContent))),
      });
    } catch (e) {
      // Read-safety fallback: a genuinely unreadable blob shouldn't be treated as "deleted" — keep
      // whatever local copy already existed for this exact blob (if any) rather than losing it.
      const existingLocal = appState.files.find((lf) => lf.gistFileName === filename);
      if (existingLocal) byId.set(existingLocal.id, existingLocal);
      failures.push({ fileName: filename, error: "Could not parse this file's content." });
      console.error(`Cross-Device Sync: failed to parse "${filename}" from the sync gist: ${e}`);
    }
  }
  appState.files = [...byId.values()];

  if (meta.globalToggles) appState.toggles = meta.globalToggles;
  if (meta.activeQuestion !== undefined) appState.activeQuestion = meta.activeQuestion;
  if (meta.timer) appState.timer = meta.timer;
  if (Array.isArray(meta.globalTags)) appState.globalTags = meta.globalTags;

  // Only reached once the meta parse above succeeded — lastSyncedLabel/activeDevice/version state
  // never gets updated from a failed or partial read (see this function's doc comment).
  appState.sync = {
    ...appState.sync,
    lastPullAt: Date.now(),
    lastKnownRemoteUpdatedAt: result.updatedAt,
    knownVersion: typeof meta.version === "number" ? meta.version : appState.sync.knownVersion,
    lastRemoteActiveDevice: meta.lastWriter ?? appState.sync.lastRemoteActiveDevice,
    lastRemoteUpdateTimestamp: meta.lastWriteTimestamp ?? appState.sync.lastRemoteUpdateTimestamp,
  };
  store.writeFiles(appState.files);
  store.writeGlobalToggles(appState.toggles);
  store.writeActiveQuestion(appState.activeQuestion);
  store.writeTimer(appState.timer);
  store.writeGlobalTags(appState.globalTags);
  store.writeSync(appState.sync);
  return { ok: true, failures: failures.length > 0 ? failures : undefined };
}

/**
 * Pushes every locally-changed file (new content or never-pushed) and the meta blob to the shared
 * sync gist as SEPARATE, CONCURRENT PATCH requests (one per changed file, plus one for meta) —
 * only after pre-push validation against a FRESH fetch of the remote meta:
 *   - Blocked if the remote's real `version` is ahead of this device's last-known version (someone
 *     else pushed since this device last pulled) — abort, tell the user to pull first.
 *   - Blocked if the remote's `activeDevice` write lock is currently held by a DIFFERENT device
 *     (a push from that device is in flight right now) — abort, tell the user to retry shortly.
 * A successful meta push bumps `version` by 1 and writes `activeDevice: null` in the same request —
 * acquire, write, and release all happen as one atomic-from-our-perspective operation, so there's no
 * separate "holding" state that could leak if a device goes offline mid-edit.
 *
 * Firing one PATCH per changed file (instead of bundling everything into one combined PATCH) lets a
 * push with many changed files land faster — GitHub's Gist PATCH only touches files explicitly
 * named in ITS OWN payload, so disjoint concurrent PATCHes to the same gist never clobber each
 * other's file content. The tradeoff is partial-success: one file's PATCH can fail while others (and
 * meta) succeed. Each file's `lastPushedHash` is only advanced for files whose OWN PATCH succeeded,
 * so a failed one is simply retried on the next push; `knownVersion`/`lastMetaPushedHash` are only
 * advanced if the META push specifically succeeded. Callers get a per-item breakdown
 * (`succeededFiles`/`failedFiles`/`metaOk`) to report partial failures precisely instead of one
 * blanket error.
 *
 * Duplicate Push Protection: if nothing local actually changed (no file/meta diff), returns
 * `skipped: true` WITHOUT any network call at all — the remote validation fetch only happens once
 * there's something worth sending.
 * @returns {Promise<{ok: boolean, error?: string, skipped?: boolean, blocked?: "behind"|"locked", succeededFiles?: string[], failedFiles?: Array<{fileName: string, error: string}>, metaOk?: boolean}>}
 */
export async function pushAllChangedFiles() {
  const token = appState.sync.githubToken;
  const configGistId = appState.sync.configGistId;
  if (!token || !configGistId) return { ok: false, error: "Cross-Device Sync isn't configured." };

  assignGistFilenames(appState.files);

  /** @type {Array<{file: FileRecord, content: string}>} */
  const changedFiles = [];
  for (const file of appState.files) {
    const content = serializeNormalizedFileContent(file);
    const hash = hashString(content);
    if (file.lastPushedHash === hash) continue;
    changedFiles.push({ file, content });
  }
  const anyFileChanged = changedFiles.length > 0;

  // Cheap local-only check first: don't fetch remote for full validation if there's no actual data
  // to push. Still sends a lightweight description-only PATCH (no files, no version bump, no
  // validation needed since it touches nothing version-tracked) so the gist's "last touched" stamp
  // refreshes on every push attempt, not just ones carrying real content changes.
  const localTogglesChanged = hashString(JSON.stringify({ t: appState.toggles, a: appState.activeQuestion, ti: appState.timer, g: appState.globalTags })) !== appState.sync.lastMetaPushedHash;
  if (!anyFileChanged && !localTogglesChanged) {
    await pushToGist({ token, gistId: configGistId, files: {}, description: syncGistDescription() });
    return { ok: true, skipped: true };
  }

  // Pre-Push Validation: fetch the remote meta fresh (not the possibly-stale local cache) right
  // before writing, so the version/lock check reflects reality at push time.
  const remoteResult = await pullFromGist({ token, gistId: configGistId });
  if (!remoteResult.ok) return { ok: false, error: remoteResult.error };
  const remoteMeta = parseMeta(remoteResult);
  if (!remoteMeta) return { ok: false, error: `This gist has no readable "${META_FILENAME}" file — it isn't the sync gist.` };

  const remoteVersion = typeof remoteMeta.version === "number" ? remoteMeta.version : 0;
  const localVersion = appState.sync.knownVersion ?? 0;
  if (remoteVersion > localVersion) {
    return { ok: false, blocked: "behind", error: `Your local data is behind the latest synced version (remote is v${remoteVersion}, you have v${localVersion}) — pull before pushing.` };
  }
  if (remoteMeta.activeDevice && remoteMeta.activeDevice !== getDeviceId()) {
    return { ok: false, blocked: "locked", error: `Another device (${remoteMeta.activeDevice}) is currently syncing — try again shortly.` };
  }

  const newVersion = remoteVersion + 1;
  const metaContent = serializeMetaContent({ version: newVersion, activeDevice: null });
  const description = syncGistDescription();

  const filePushResults = await Promise.all(
    changedFiles.map(async ({ file, content }) => ({
      file,
      content,
      result: await pushToGist({ token, gistId: configGistId, files: { [/** @type {string} */ (file.gistFileName)]: { content } }, description }),
    }))
  );
  const metaResult = await pushToGist({ token, gistId: configGistId, files: { [META_FILENAME]: { content: metaContent } }, description });

  /** @type {string[]} */
  const succeededFiles = [];
  /** @type {Array<{fileName: string, error: string}>} */
  const failedFiles = [];
  for (const { file, content, result } of filePushResults) {
    if (result.ok) {
      file.lastPushedHash = hashString(content);
      succeededFiles.push(file.fileName);
    } else {
      failedFiles.push({ fileName: file.fileName, error: result.error || "Push failed." });
    }
  }
  if (anyFileChanged) store.writeFiles(appState.files);

  const metaOk = metaResult.ok;
  if (metaOk) {
    appState.sync = {
      ...appState.sync,
      lastPushAt: Date.now(),
      lastKnownRemoteUpdatedAt: Date.now(),
      knownVersion: newVersion,
      lastMetaPushedHash: hashString(JSON.stringify({ t: appState.toggles, a: appState.activeQuestion, ti: appState.timer, g: appState.globalTags })),
      lastRemoteActiveDevice: getDeviceLabel(),
      lastRemoteUpdateTimestamp: formatIST(Date.now()),
    };
    store.writeSync(appState.sync);
  }

  const ok = metaOk && failedFiles.length === 0;
  return {
    ok,
    skipped: false,
    succeededFiles,
    failedFiles,
    metaOk,
    error: ok ? undefined : failedFiles[0]?.error || metaResult.error || "Push failed.",
  };
}

/**
 * Pulls the whole sync gist and applies it to local state unconditionally.
 * @returns {Promise<{ok: boolean, error?: string, failures?: Array<{fileName: string, error: string}>}>}
 */
export async function pullAllFiles() {
  const token = appState.sync.githubToken;
  const configGistId = appState.sync.configGistId;
  if (!token || !configGistId) return { ok: false, error: "Cross-Device Sync isn't configured." };
  const result = await pullFromGist({ token, gistId: configGistId });
  if (!result.ok) return { ok: false, error: result.error };
  return applyRemotePullResult(result);
}

/**
 * True if any previously-synced file (has a `gistFileName`) has local content that no longer
 * matches its `lastPushedHash` — i.e. an edit made here hasn't made it into a successful push yet.
 * Files that have NEVER been pushed (`gistFileName` null) are excluded: applyRemotePullResult leaves
 * those untouched regardless (see its own doc comment), so they're never at risk from a pull.
 * Used to guard the silent session-start pull (app.js) against discarding local edits — see that
 * call site's comment for why this check exists independent of the Auto-sync/Pull Only toggles: a
 * pull silently REPLACES a synced file's content with whatever's in the gist (per
 * applyRemotePullResult), so an unpushed edit sitting here is exactly the case that must block it,
 * regardless of why it hasn't been pushed yet (debounce still pending, Pull Only blocking all
 * pushes, Auto-sync paused, or the last push simply failed).
 * @returns {boolean}
 */
export function hasUnpushedLocalChanges() {
  return appState.files.some((f) => f.gistFileName && hashString(serializeFileContent(f)) !== f.lastPushedHash);
}

/**
 * Fetches the sync gist and applies it ONLY if its `updated_at` is newer than what this device last
 * knew — used by the silent session-start pull (app.js), which shouldn't clobber local state with a
 * fetch that turns out to be no newer than what's already here. Costs the same single request as
 * pullAllFiles either way (there's no cheaper "metadata only" endpoint for a gist's contents), so
 * this simply decides whether to apply what was already fetched.
 * @returns {Promise<{ok: boolean, applied: boolean, error?: string, failures?: Array<{fileName: string, error: string}>, activeDevice?: string, updateTimestamp?: string}>}
 */
export async function pullIfRemoteNewer() {
  const token = appState.sync.githubToken;
  const configGistId = appState.sync.configGistId;
  if (!token || !configGistId) return { ok: false, applied: false };
  const result = await pullFromGist({ token, gistId: configGistId });
  if (!result.ok) return { ok: false, applied: false, error: result.error };

  const isNewer = result.updatedAt != null && (!appState.sync.lastKnownRemoteUpdatedAt || result.updatedAt > appState.sync.lastKnownRemoteUpdatedAt);
  if (!isNewer) return { ok: true, applied: false };

  const meta = parseMeta(result);
  const applied = applyRemotePullResult(result);
  return { ok: applied.ok, applied: applied.ok, error: applied.error, failures: applied.failures, activeDevice: meta?.lastWriter, updateTimestamp: meta?.lastWriteTimestamp };
}

/**
 * Deletes a file's blob from the shared sync gist (one PATCH, setting its filename to `null` per the
 * Gist API's delete-a-file convention) and removes it from this device's local storage's own record.
 * Also bumps the meta blob's `version`/`lastWriter` in the SAME PATCH — a delete is a real state
 * change other devices need to notice via the version/updated_at tracking just like a content push,
 * otherwise a device that only ever deletes files (never edits content) would never advance the
 * version counter. No-ops successfully if sync isn't configured or the file was never pushed, since
 * there's nothing remote to clean up in that case. Not subject to the lock-check pre-push validation
 * that pushAllChangedFiles uses — a delete is a deliberate, infrequent, user-confirmed action rather
 * than a background auto-push, so it goes straight through.
 * @param {string} fileId
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function deleteFileFromGist(fileId) {
  const token = appState.sync.githubToken;
  const configGistId = appState.sync.configGistId;
  if (!token || !configGistId) return { ok: true };
  const file = appState.files.find((f) => f.id === fileId);
  if (!file || !file.gistFileName) return { ok: true };

  const remoteResult = await pullFromGist({ token, gistId: configGistId });
  const remoteMeta = remoteResult.ok ? parseMeta(remoteResult) : null;
  const remoteVersion = remoteMeta && typeof remoteMeta.version === "number" ? remoteMeta.version : appState.sync.knownVersion ?? 0;
  const newVersion = remoteVersion + 1;

  const result = await pushToGist({
    token,
    gistId: configGistId,
    files: { [file.gistFileName]: null, [META_FILENAME]: { content: serializeMetaContent({ version: newVersion, activeDevice: null }) } },
    description: syncGistDescription(),
  });
  if (!result.ok) return result;

  appState.sync = { ...appState.sync, knownVersion: newVersion, lastRemoteActiveDevice: getDeviceLabel(), lastRemoteUpdateTimestamp: formatIST(Date.now()) };
  store.writeSync(appState.sync);
  return { ok: true };
}

/**
 * Creates a brand-new sync gist holding the meta blob (version 1, unlocked) plus every currently-
 * loaded local file, and connects to it — the setup wizard's "Create new" path. Unlike the old
 * per-file-gist design, this pushes everything already loaded locally right away instead of leaving
 * files stranded until the next auto-push.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function createNewSyncGist() {
  const token = appState.sync.githubToken;
  if (!token) return { ok: false, error: "No GitHub token configured." };

  assignGistFilenames(appState.files);
  const metaContent = serializeMetaContent({ version: 1, activeDevice: null });
  /** @type {Record<string, {content: string}>} */
  const files = { [META_FILENAME]: { content: metaContent } };
  for (const file of appState.files) {
    files[/** @type {string} */ (file.gistFileName)] = { content: serializeNormalizedFileContent(file) };
  }

  const result = await createGist({ token, files, description: syncGistDescription() });
  if (!result.ok) return { ok: false, error: result.error };

  for (const file of appState.files) file.lastPushedHash = hashString(serializeFileContent(file));
  appState.sync = {
    ...appState.sync,
    configGistId: result.gistId,
    knownVersion: 1,
    lastMetaPushedHash: hashString(JSON.stringify({ t: appState.toggles, a: appState.activeQuestion, ti: appState.timer, g: appState.globalTags })),
    lastRemoteActiveDevice: getDeviceLabel(),
    lastRemoteUpdateTimestamp: formatIST(Date.now()),
  };
  store.writeFiles(appState.files);
  store.writeSync(appState.sync);
  return { ok: true };
}

/**
 * Connects to an existing sync gist id and immediately pulls whatever it already holds — the setup
 * wizard's "Connect existing" path. Validates the id by actually pulling from it BEFORE persisting it
 * as configGistId: if it turns out not to be a real sync gist (see applyRemotePullResult's meta-blob
 * check), the in-memory value is rolled back and nothing is written to storage — otherwise a wrong id
 * would get wired up as the auto-push target and corrupt whatever gist it actually points at.
 * @param {string} configGistId
 * @returns {Promise<{ok: boolean, error?: string, failures?: Array<{fileName: string, error: string}>}>}
 */
export async function connectExistingSyncGist(configGistId) {
  const previousConfigGistId = appState.sync.configGistId;
  appState.sync = { ...appState.sync, configGistId };
  const result = await pullAllFiles();
  if (!result.ok) {
    appState.sync = { ...appState.sync, configGistId: previousConfigGistId };
    return result;
  }
  return result;
}
