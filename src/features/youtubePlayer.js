// @ts-check
/**
 * features/youtubePlayer.js — the embedded YouTube player modal opened by clicking a YouTube link
 * chip (render/nodeViews/questionView.js's wireLinkAnchorClick, gated on data/linkIcons.js's
 * isYouTubeUrl). Loads the YouTube IFrame Player API lazily and once per session (see
 * loadYouTubeApi, cached in apiReadyPromise) and layers a timestamp-bookmark capture/edit list
 * underneath the player, backed by features/youtubeBookmarks.js. Bookmarks ride inside the
 * question's own `links` array (see types.js's QuestionLink.bookmarks), so they persist/sync
 * exactly like the rest of a question's data — nothing extra to wire for that.
 *
 * Sequential auto-play (runSequentialTick): whenever the player is actively PLAYING and its current
 * time falls inside a ranged bookmark (start <= t < end — a single-point bookmark with no `end`
 * never participates), once time crosses that bookmark's `end` playback jumps straight to the NEXT
 * ranged bookmark's start rather than continuing through the untagged gap between them. This applies
 * however playback got there — the initial auto-seek to the first bookmark on load, a manual "Jump
 * to this timestamp" click, or the user scrubbing the YouTube seek bar by hand into the middle of a
 * range — so "starts mid-bookmark, plays to its end, continues to the next" and "plays the whole
 * bookmark list in sequence from the start" fall out of the exact same tick-polled check. Reaching
 * the LAST ranged bookmark's end (no next one queued) pauses the player there instead of rolling on
 * into the rest of the (untagged) video. The
 * separate Global Autoplay toggle (appState.toggles.youtubeAutoplayOn) only controls whether the
 * player starts PLAYING on its own when the modal opens — the starting position itself (first
 * bookmark, or the URL's own ?t= hint) is unconditional either way.
 *
 * Bookmark row edits are explicit-save, not autosave-on-blur (see Manual Row Save): typing in a
 * row's timestamp/label inputs only stays in the DOM until its own Save (checkmark) button — or
 * Enter in either field — is clicked, at which point both fields commit together in one
 * updateBookmark call.
 *
 * Group Playback (features/youtubeGroupPlayer.js's openGroupPlayback is the only caller that passes
 * `options.playlist`): a YouTube-style playlist panel renders below the bookmark list — every video
 * in the currently filtered group, current one highlighted and tagged with WHERE it's attached
 * (Subject/Topic/SubTopic/Question — see buildPlaylistPanel), each with a thumbnail + fetched title,
 * a "Jump" button (features/activeQuestion.js's revealQuestion/revealGroup) that closes this modal
 * and reveals that spot in the tree, and a pencil button to rename the link's own label in place.
 *
 * Advancing between playlist entries (switchToEntry) — on a manual playlist-row click, on natural
 * video end (YT.PlayerState.ENDED), or when runSequentialTick finishes the last ranged bookmark with
 * no next bookmark queued — reuses the SAME modal/iframe/YT.Player instance via loadVideoById rather
 * than closing this modal and opening a new one: destroying and recreating the iframe on every track
 * would silently drop the user out of native/CSS fullscreen mid-playlist (the fullscreen element
 * itself would be gone), which defeats the point of a continuous "next track" experience. Only
 * clicking a playlist row's own Jump button (an explicit "leave playback, go look at this question/
 * group instead" action) still closes the modal.
 *
 * A playlist entry attached at the Subject/Topic/SubTopic level (not to any one question) carries a
 * null `questionId` — bookmarks are a per-QUESTION-link concept only (features/youtubeBookmarks.js's
 * CRUD looks a question up by id), so the bookmark-editing controls (Add/manual-entry/raw-text/Copy)
 * are hidden for those entries; the video still plays, still honors Smart Video Start via the URL's
 * own `?t=` hint, just without bookmark support.
 */
import { openModal } from "./modal.js";
import * as bookmarks from "./youtubeBookmarks.js";
import { appState } from "../state/appState.js";
import * as store from "../persistence/store.js";
import { revealQuestion, revealGroup } from "./activeQuestion.js";
import { renameLinkPrompt } from "./questionLinks.js";
import { renameGroupLinkPrompt } from "./groupLinks.js";
import { getGroupLinks } from "../data/groupLinks.js";
import { fetchYouTubeTitle } from "./youtubeOEmbed.js";
import {
  extractYouTubeVideoId,
  extractStartSeconds,
  youtubeThumbnailUrl,
  formatTimestamp,
  parseBookmarkRangeInput,
  parseBookmarkLines,
  formatBookmarkRange,
  formatBookmarkLines,
  defaultBookmarkLabel,
} from "../data/youtubeTime.js";
import { showToast, confirmAction } from "./toast.js";

/** @typedef {import('./youtubeGroupPlayer.js').PlaylistEntry} PlaylistEntry */

/** @type {Record<PlaylistEntry["level"], {label: string, icon: string}>} */
const LEVEL_META = {
  subject: { label: "Subject", icon: "fa-solid fa-layer-group" },
  topic: { label: "Topic", icon: "fa-solid fa-folder" },
  subTopic: { label: "SubTopic", icon: "fa-solid fa-folder-tree" },
  question: { label: "Question", icon: "fa-solid fa-circle-question" },
};

/** @type {Promise<any>|null} cached across opens so the API <script> is only ever injected once. */
let apiReadyPromise = null;

/** @returns {Promise<any>} resolves with the global `YT` namespace once the IFrame API is ready. */
function loadYouTubeApi() {
  if (apiReadyPromise) return apiReadyPromise;
  const win = /** @type {any} */ (window);
  apiReadyPromise = new Promise((resolve) => {
    if (win.YT && win.YT.Player) {
      resolve(win.YT);
      return;
    }
    // YouTube's IFrame API calls this exact global function name once it's loaded — chain onto
    // whatever (if anything) was already registered there rather than clobbering it.
    const previous = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => {
      if (typeof previous === "function") previous();
      resolve(win.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiReadyPromise;
}

let mountCounter = 0;

/**
 * Opens the embedded-player modal for `link` (must be a YouTube URL — callers gate on
 * data/linkIcons.js's isYouTubeUrl before wiring the click that reaches here).
 * @param {string|null} questionId Null for a Subject/Topic/SubTopic-level link (Group Playback only
 *   — a plain question link-chip click always passes its own question's id).
 * @param {{id: string, url: string, label: string}} link
 * @param {{playlist?: PlaylistEntry[], index?: number, forceAutoplay?: boolean}} [options]
 *   `playlist`/`index` (both or neither) — see Group Playback in the module doc above. Absent for a
 *   single-video open from a question's own link chip. `forceAutoplay` starts THIS video playing
 *   immediately regardless of the Global Autoplay toggle — set for a Group Playback open, since the
 *   user already asked to start playing; a plain single-video open still follows the toggle.
 */
export function openYouTubePlayer(questionId, link, options = {}) {
  const { playlist, index = 0, forceAutoplay = false } = options;
  const initialVideoId = extractYouTubeVideoId(link.url);
  if (!initialVideoId) {
    showToast("Couldn't recognize this as a YouTube video URL.", "error");
    return;
  }

  /** @type {any} */
  let player = null;
  /** @type {ReturnType<typeof setInterval>|null} */
  let tickTimer = null;
  let isPlaying = false;
  /** Raw-text bulk editor toggle (Text Area Toggle) — reset on every track switch. */
  let rawTextMode = false;
  /** @type {import('../types.js').LinkBookmark[]} Ranged (has an `end`) bookmarks only, sorted by
   *  start — recomputed on every renderList() call, read by runSequentialTick. */
  let rangedBookmarks = [];
  /** Index into rangedBookmarks the player is currently "inside" for sequential auto-play purposes,
   *  or -1 when outside every ranged bookmark. Recomputed every tick, not just after a jump, so
   *  manually scrubbing into a range is picked up within one tick interval. */
  let activeBookmarkIndex = -1;

  // Current-track state — mutated in place by switchToEntry as Group Playback advances, rather than
  // closing/reopening this whole modal (see module doc above for why: reusing the same iframe keeps
  // native/CSS fullscreen alive across tracks). A single-video (non-playlist) open never changes these.
  let curQuestionId = questionId;
  let curLink = link;
  let curIndex = index;
  let curVideoId = initialVideoId;
  const bookmarksSupported = () => curQuestionId != null;
  let lastAdvanceAt = 0;

  const wrap = document.createElement("div");
  wrap.className = `youtube-player-modal${playlist && playlist.length > 0 ? " has-playlist" : ""}`;

  const embedWrap = document.createElement("div");
  embedWrap.className = "youtube-player-embed-wrap";
  const mountId = `yt-player-mount-${++mountCounter}`;
  const mountEl = document.createElement("div");
  mountEl.id = mountId;
  embedWrap.appendChild(mountEl);
  wrap.appendChild(embedWrap);

  const controls = document.createElement("div");
  controls.className = "youtube-player-controls";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-sm btn-outline-primary";
  addBtn.title = "Add Bookmark at Current Time";
  addBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
  addBtn.disabled = true;

  const rawToggleBtn = document.createElement("button");
  rawToggleBtn.type = "button";
  rawToggleBtn.className = "btn btn-sm btn-outline-secondary";
  rawToggleBtn.title = "Toggle raw text editor (bulk add/edit bookmarks)";
  rawToggleBtn.innerHTML = '<i class="fa-solid fa-align-left"></i>';

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "btn btn-sm btn-outline-secondary";
  copyBtn.title = "Copy all bookmarks as raw text";
  copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i>';
  copyBtn.addEventListener("click", async () => {
    // Reads fresh off appState (not `rangedBookmarks`/whatever the list last rendered) so Copy
    // always reflects the full current bookmark set — single-point ones included — in ANY mode
    // (row list or raw-text editor), independent of rawTextMode.
    const freshLink = bookmarks.getLink(curQuestionId, curLink.id);
    const list = [...(freshLink?.bookmarks ?? [])].sort((a, b) => a.start - b.start);
    try {
      await navigator.clipboard.writeText(formatBookmarkLines(list));
      showToast("Bookmarks copied as raw text.", "success");
    } catch {
      showToast("Could not copy.", "error");
    }
  });

  // Global Autoplay Sync — appState.toggles.youtubeAutoplayOn, persisted/synced like every other
  // global toggle (see persistence/schema.js). Only affects whether THIS player instance is handed
  // playerVars.autoplay: 1 at creation time below; toggling it mid-session doesn't retroactively
  // start an already-loaded video.
  const autoplayToggleBtn = document.createElement("button");
  autoplayToggleBtn.type = "button";
  autoplayToggleBtn.className = "btn btn-sm btn-outline-secondary";
  const syncAutoplayToggle = () => {
    const on = !!appState.toggles.youtubeAutoplayOn;
    autoplayToggleBtn.classList.toggle("active", on);
    autoplayToggleBtn.setAttribute("aria-pressed", String(on));
    autoplayToggleBtn.title = `Autoplay: ${on ? "on" : "off"} — begin playback automatically on open (synced across devices)`;
  };
  autoplayToggleBtn.innerHTML = '<i class="fa-solid fa-bolt"></i>';
  syncAutoplayToggle();
  autoplayToggleBtn.addEventListener("click", () => {
    appState.toggles = { ...appState.toggles, youtubeAutoplayOn: !appState.toggles.youtubeAutoplayOn };
    store.writeGlobalToggles(appState.toggles);
    syncAutoplayToggle();
  });

  const currentTimeEl = document.createElement("span");
  currentTimeEl.className = "youtube-player-current-time";
  currentTimeEl.textContent = "00:00";

  controls.append(addBtn, rawToggleBtn, copyBtn, autoplayToggleBtn, currentTimeEl);
  wrap.appendChild(controls);

  // Manual Bookmark Entry — a bookmark that isn't "wherever the player happens to be right now",
  // e.g. adding a timestamp read off a comment or another source without scrubbing the video there.
  const manualRow = document.createElement("div");
  manualRow.className = "yt-bookmark-manual-row";
  const manualTimeInput = document.createElement("input");
  manualTimeInput.type = "text";
  manualTimeInput.className = "form-control form-control-sm yt-bookmark-time-input";
  manualTimeInput.style.width = "13.5em";
  manualTimeInput.placeholder = "mm:ss or mm:ss-mm:ss";
  manualTimeInput.title = "Timestamp or range to bookmark, e.g. \"1:10\" or \"1:10-2:00\"";
  const manualLabelInput = document.createElement("input");
  manualLabelInput.type = "text";
  manualLabelInput.className = "form-control form-control-sm yt-bookmark-label-input";
  manualLabelInput.placeholder = "Label (optional)";
  const manualAddBtn = document.createElement("button");
  manualAddBtn.type = "button";
  manualAddBtn.className = "btn btn-sm btn-outline-secondary";
  manualAddBtn.title = "Add this timestamp as a bookmark";
  manualAddBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
  const submitManualBookmark = () => {
    const parsed = parseBookmarkRangeInput(manualTimeInput.value);
    if (!parsed) {
      showToast("Couldn't read that timestamp — use mm:ss or mm:ss-mm:ss.", "error");
      return;
    }
    bookmarks.addBookmark(curQuestionId, curLink.id, { start: parsed.start, end: parsed.end, label: manualLabelInput.value.trim() });
    manualTimeInput.value = "";
    manualLabelInput.value = "";
    renderList();
  };
  manualAddBtn.addEventListener("click", submitManualBookmark);
  for (const input of [manualTimeInput, manualLabelInput]) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitManualBookmark();
      }
    });
  }
  manualRow.append(manualTimeInput, manualLabelInput, manualAddBtn);
  wrap.appendChild(manualRow);

  const listMount = document.createElement("div");
  listMount.className = "youtube-bookmark-list";
  wrap.appendChild(listMount);

  const playlistPanelMount = document.createElement("div");
  if (playlist && playlist.length > 0) wrap.appendChild(playlistPanelMount);

  const modalHandle = openModal({
    title: playlist && playlist.length > 0 ? "YouTube — Group Playback" : link.label || "YouTube",
    bodyEl: wrap,
    // A watch/bookmark session is easy to lose to an accidental outside click while the video is
    // playing — Escape and the X button still close it, only a stray backdrop click doesn't.
    closeOnBackdropClick: false,
    onClose: () => {
      if (tickTimer) clearInterval(tickTimer);
      if (player && typeof player.destroy === "function") player.destroy();
    },
  });

  /** Refreshes which controls apply to the current track — called on open and after every switch. */
  function syncBookmarkControlsVisibility() {
    const supported = bookmarksSupported();
    addBtn.hidden = !supported;
    rawToggleBtn.hidden = !supported;
    copyBtn.hidden = !supported;
    manualRow.hidden = !supported;
  }

  /**
   * Moves playback to `playlist[newIndex]` IN PLACE — same modal, same iframe/YT.Player instance
   * (loadVideoById swaps the video without recreating the element), so fullscreen (native or CSS)
   * survives the switch. A no-op if there's no such entry, or if called again within the same beat
   * (ENDED and runSequentialTick's own "last bookmark, next queued" branch can both fire close
   * together right at a video's natural end).
   * @param {number} newIndex
   */
  function switchToEntry(newIndex) {
    if (!playlist) return;
    const entry = playlist[newIndex];
    if (!entry) return;
    const now = Date.now();
    if (now - lastAdvanceAt < 600) return;
    lastAdvanceAt = now;

    const newVideoId = extractYouTubeVideoId(entry.link.url);
    if (!newVideoId) {
      showToast("Couldn't recognize this playlist entry's URL as YouTube — skipping.", "error");
      switchToEntry(newIndex + 1);
      return;
    }

    curIndex = newIndex;
    curQuestionId = entry.questionId;
    curLink = entry.link;
    curVideoId = newVideoId;
    rawTextMode = false;
    syncBookmarkControlsVisibility();

    const initialRanged = (bookmarksSupported() ? bookmarks.getLink(curQuestionId, curLink.id)?.bookmarks ?? [] : [])
      .filter((b) => b.end != null)
      .sort((a, b) => a.start - b.start);
    const startSeconds = initialRanged.length > 0 ? initialRanged[0].start : extractStartSeconds(curLink.url);

    if (player && typeof player.loadVideoById === "function") {
      player.loadVideoById({ videoId: newVideoId, startSeconds });
    }

    renderList();
    renderPlaylistPanel();
  }

  /** Advances to the next playlist entry, if any — see switchToEntry. */
  function advanceToNextInPlaylist() {
    if (!playlist) return;
    if (!playlist[curIndex + 1]) return;
    switchToEntry(curIndex + 1);
  }

  /**
   * Group Playback's playlist panel — one row per video in `playlist`, current one highlighted and
   * tagged with WHERE it's attached (level badge + full Subject/Topic/SubTopic[/Question]
   * breadcrumb, so a Subject-level video is never mistaken for a specific question's). Each row shows
   * a thumbnail (data/youtubeTime.js's youtubeThumbnailUrl — instant, no fetch) + the video's real
   * title (fetched async via features/youtubeOEmbed.js, falling back to the link's own label while
   * loading/on failure), plus three actions: play this entry (switchToEntry, in place), rename its
   * link label, and jump to wherever it's attached (closes the modal — see module doc above).
   * Rebuilt from scratch on every call (cheap: a handful of DOM nodes) rather than patched, so the
   * currently-playing row's highlight/disabled state always matches curIndex exactly.
   */
  function renderPlaylistPanel() {
    if (!playlist || playlist.length === 0) return;
    playlistPanelMount.textContent = "";
    playlistPanelMount.className = "youtube-playlist-panel";

    const heading = document.createElement("div");
    heading.className = "youtube-playlist-heading";
    heading.textContent = `Playlist (${curIndex + 1} of ${playlist.length})`;
    playlistPanelMount.appendChild(heading);

    const items = document.createElement("div");
    items.className = "youtube-playlist-items";

    /** Reads the CURRENT label for `entry` fresh off appState (rather than the possibly-stale
     *  closure copy captured when the playlist was built) — used right after a rename. */
    const currentLabel = (entry) =>
      (entry.level === "question"
        ? appState.rawData.find((q) => q.id === entry.questionId)?.links?.find((l) => l.id === entry.link.id)?.label
        : getGroupLinks(appState.groupLinks, entry.subject, entry.topic, entry.subTopic).find((l) => l.id === entry.link.id)?.label) ??
      entry.link.label;

    playlist.forEach((entry, i) => {
      const item = document.createElement("div");
      item.className = `youtube-playlist-item${i === curIndex ? " is-current" : ""}`;

      const videoId = extractYouTubeVideoId(entry.link.url);
      const thumb = document.createElement("img");
      thumb.className = "youtube-playlist-thumb";
      thumb.alt = "";
      thumb.loading = "lazy";
      if (videoId) thumb.src = youtubeThumbnailUrl(videoId);
      item.appendChild(thumb);

      const textCol = document.createElement("div");
      textCol.className = "youtube-playlist-item-text";

      const titleEl = document.createElement("div");
      titleEl.className = "youtube-playlist-item-title";
      titleEl.textContent = entry.link.label || entry.question || entry.breadcrumb;
      textCol.appendChild(titleEl);
      if (videoId) {
        fetchYouTubeTitle(videoId).then((fetchedTitle) => {
          if (fetchedTitle) titleEl.textContent = fetchedTitle;
        });
      }

      const badge = document.createElement("span");
      badge.className = `youtube-playlist-level-badge youtube-playlist-level-${entry.level}`;
      badge.innerHTML = `<i class="${LEVEL_META[entry.level].icon}"></i> ${LEVEL_META[entry.level].label}`;
      textCol.appendChild(badge);

      const breadcrumbEl = document.createElement("div");
      breadcrumbEl.className = "youtube-playlist-item-breadcrumb";
      breadcrumbEl.textContent = entry.breadcrumb;
      textCol.appendChild(breadcrumbEl);

      const labelEl = document.createElement("div");
      labelEl.className = "youtube-playlist-item-linklabel";
      labelEl.textContent = `Link: ${entry.link.label || "(no label)"}`;
      textCol.appendChild(labelEl);

      item.appendChild(textCol);

      const actions = document.createElement("div");
      actions.className = "youtube-playlist-item-actions";

      const playBtn = document.createElement("button");
      playBtn.type = "button";
      playBtn.className = "btn btn-sm btn-outline-secondary youtube-playlist-play-btn";
      playBtn.title = i === curIndex ? "Now playing" : "Play this video";
      playBtn.innerHTML = i === curIndex ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-regular fa-circle-play"></i>';
      playBtn.disabled = i === curIndex;
      playBtn.addEventListener("click", () => switchToEntry(i));
      actions.appendChild(playBtn);

      const editLabelBtn = document.createElement("button");
      editLabelBtn.type = "button";
      editLabelBtn.className = "btn btn-sm btn-outline-secondary";
      editLabelBtn.title = "Rename this link's label";
      editLabelBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
      editLabelBtn.addEventListener("click", () => {
        if (entry.level === "question") {
          renameLinkPrompt(/** @type {string} */ (entry.questionId), entry.link.id, entry.link.label, entry.link.url);
        } else {
          renameGroupLinkPrompt(entry.level, { subject: entry.subject, topic: entry.topic ?? undefined, subTopic: entry.subTopic ?? undefined }, entry.link.id, entry.link.label, entry.link.url);
        }
        entry.link = { ...entry.link, label: currentLabel(entry) };
        if (i === curIndex) curLink = entry.link;
        labelEl.textContent = `Link: ${entry.link.label || "(no label)"}`;
        if (!videoId) titleEl.textContent = entry.link.label || entry.question || entry.breadcrumb;
      });
      actions.appendChild(editLabelBtn);

      const jumpBtn = document.createElement("button");
      jumpBtn.type = "button";
      jumpBtn.className = "btn btn-sm btn-outline-secondary youtube-playlist-jump-btn";
      jumpBtn.title = "Jump to where this video is attached";
      jumpBtn.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i>';
      jumpBtn.addEventListener("click", () => {
        modalHandle.close();
        if (entry.level === "question") revealQuestion(/** @type {string} */ (entry.questionId));
        else revealGroup(entry.level, entry.subject, entry.topic ?? undefined, entry.subTopic ?? undefined);
      });
      actions.appendChild(jumpBtn);

      item.appendChild(actions);
      items.appendChild(item);
    });
    playlistPanelMount.appendChild(items);
  }

  /** Re-reads bookmarks fresh off appState (via youtubeBookmarks.getLink) and redraws the list —
   *  or, in raw-text mode, the bulk textarea instead. */
  function renderList() {
    listMount.textContent = "";
    if (!bookmarksSupported()) {
      const note = document.createElement("p");
      note.className = "small text-muted";
      note.textContent = "Bookmarks aren't available for a Subject/Topic/SubTopic-level video — only for one attached to a specific question.";
      listMount.appendChild(note);
      return;
    }
    const freshLink = bookmarks.getLink(curQuestionId, curLink.id);
    const list = [...(freshLink?.bookmarks ?? [])].sort((a, b) => a.start - b.start);
    rangedBookmarks = list.filter((b) => b.end != null);
    activeBookmarkIndex = -1;

    if (rawTextMode) {
      renderRawTextEditor(list);
      return;
    }
    if (list.length === 0) {
      const empty = document.createElement("p");
      empty.className = "small text-muted";
      empty.textContent = "No bookmarks yet — play the video and click the bookmark button, or add one manually above.";
      listMount.appendChild(empty);
      return;
    }
    for (const bookmark of list) listMount.appendChild(buildBookmarkRow(bookmark));
  }

  /**
   * Text Area Toggle: bulk view/edit as "MM:SS-MM:SS - Label" / "MM:SS - Label" lines (one per
   * bookmark) — Save re-parses and replaces the whole list (features/youtubeBookmarks.js's
   * setBookmarks preserves star/createdAt for lines matching an existing start+end).
   * @param {import('../types.js').LinkBookmark[]} list
   */
  function renderRawTextEditor(list) {
    const textarea = document.createElement("textarea");
    textarea.className = "form-control form-control-sm yt-bookmark-textarea";
    textarea.rows = Math.max(4, list.length + 1);
    textarea.value = formatBookmarkLines(list);
    textarea.placeholder = "1:10-2:00 - Intro\n3:45 - Key point";
    listMount.appendChild(textarea);

    const actions = document.createElement("div");
    actions.className = "yt-bookmark-textarea-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn-sm btn-primary";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => {
      bookmarks.setBookmarks(curQuestionId, curLink.id, parseBookmarkLines(textarea.value));
      rawTextMode = false;
      renderList();
    });
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-sm btn-outline-secondary";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      rawTextMode = false;
      renderList();
    });
    actions.append(saveBtn, cancelBtn);
    listMount.appendChild(actions);
  }

  /**
   * @param {import('../types.js').LinkBookmark} bookmark
   * @returns {HTMLElement}
   */
  function buildBookmarkRow(bookmark) {
    const row = document.createElement("div");
    row.className = "yt-bookmark-row";

    const starBtn = document.createElement("button");
    starBtn.type = "button";
    starBtn.className = `icon-btn icon-starred${bookmark.starred ? " is-active" : ""}`;
    starBtn.title = bookmark.starred ? "Unstar this bookmark" : "Star this bookmark";
    starBtn.innerHTML = '<i class="fa-solid fa-star"></i>';
    starBtn.addEventListener("click", () => {
      bookmarks.updateBookmark(curQuestionId, curLink.id, bookmark.id, { starred: !bookmark.starred });
      renderList();
    });
    row.appendChild(starBtn);

    const seekBtn = document.createElement("button");
    seekBtn.type = "button";
    seekBtn.className = "btn btn-sm btn-outline-secondary";
    seekBtn.title = "Jump to this timestamp";
    seekBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    seekBtn.addEventListener("click", () => {
      if (player && typeof player.seekTo === "function") {
        player.seekTo(bookmark.start, true);
        if (typeof player.playVideo === "function") player.playVideo();
      }
    });
    row.appendChild(seekBtn);

    const timeInput = document.createElement("input");
    timeInput.type = "text";
    timeInput.className = "form-control form-control-sm yt-bookmark-time-input";
    timeInput.value = formatBookmarkRange(bookmark);
    timeInput.title = 'Editable — type or paste a timestamp / range, e.g. "1:10" or "1:10 - 2:00" (click Save or press Enter to commit)';
    row.appendChild(timeInput);

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.className = "form-control form-control-sm yt-bookmark-label-input";
    labelInput.value = bookmark.label || defaultBookmarkLabel(bookmark);
    labelInput.placeholder = defaultBookmarkLabel(bookmark);
    row.appendChild(labelInput);

    // Manual Row Save — no autosave on blur; both fields above commit together, only via this
    // button or Enter in either field. The button itself doubles as a dirty indicator (Save Floppy
    // Disk Color): it only lights up once timeInput/labelInput's live values actually differ from
    // this bookmark's last-saved start/end/label, so it's obvious at a glance which rows (if any)
    // still have uncommitted edits.
    const rowSaveBtn = document.createElement("button");
    rowSaveBtn.type = "button";
    rowSaveBtn.className = "btn btn-sm btn-outline-secondary yt-bookmark-save-btn";
    rowSaveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
    const refreshDirtyState = () => {
      const parsed = parseBookmarkRangeInput(timeInput.value);
      const dirty =
        timeInput.value !== formatBookmarkRange(bookmark) || labelInput.value !== (bookmark.label || defaultBookmarkLabel(bookmark));
      rowSaveBtn.classList.toggle("is-dirty", dirty && !!parsed);
      rowSaveBtn.title = dirty ? "Unsaved changes — click to save (or press Enter)" : "No unsaved changes";
    };
    const commitRowEdits = () => {
      const parsed = parseBookmarkRangeInput(timeInput.value);
      if (!parsed) {
        showToast("Couldn't read that timestamp — use mm:ss or mm:ss - mm:ss.", "error");
        return;
      }
      bookmarks.updateBookmark(curQuestionId, curLink.id, bookmark.id, { start: parsed.start, end: parsed.end, label: labelInput.value.trim() });
      renderList();
    };
    for (const input of [timeInput, labelInput]) {
      input.addEventListener("input", refreshDirtyState);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitRowEdits();
        }
      });
    }
    rowSaveBtn.addEventListener("click", commitRowEdits);
    refreshDirtyState();
    row.appendChild(rowSaveBtn);

    // Always Visible Mark Start/End — icon buttons that stamp the player's current timestamp into
    // timeInput's value (NOT a direct save — commit still goes through rowSaveBtn/Enter above, same
    // as any other edit to that field).
    /** @param {"start"|"end"} part */
    const applyMarkToTimeInput = (part) => {
      if (!player || typeof player.getCurrentTime !== "function") return;
      const seconds = Math.floor(player.getCurrentTime());
      const current = parseBookmarkRangeInput(timeInput.value) || { start: bookmark.start, end: bookmark.end ?? null };
      timeInput.value = formatBookmarkRange(part === "start" ? { start: seconds, end: current.end } : { start: current.start, end: seconds });
      refreshDirtyState();
    };
    const markStartBtn = document.createElement("button");
    markStartBtn.type = "button";
    markStartBtn.className = "btn btn-sm btn-outline-secondary";
    markStartBtn.title = "Set start to the player's current timestamp (Save to commit)";
    markStartBtn.innerHTML = '<i class="fa-solid fa-left-long"></i>';
    markStartBtn.addEventListener("click", () => applyMarkToTimeInput("start"));
    row.appendChild(markStartBtn);

    const markEndBtn = document.createElement("button");
    markEndBtn.type = "button";
    markEndBtn.className = "btn btn-sm btn-outline-secondary";
    markEndBtn.title = "Set end to the player's current timestamp (Save to commit)";
    markEndBtn.innerHTML = '<i class="fa-solid fa-right-long"></i>';
    markEndBtn.addEventListener("click", () => applyMarkToTimeInput("end"));
    row.appendChild(markEndBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-sm btn-outline-danger";
    deleteBtn.title = "Delete bookmark";
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    deleteBtn.addEventListener("click", () => {
      if (!confirmAction(`Delete bookmark "${bookmark.label || defaultBookmarkLabel(bookmark)}"?`)) return;
      bookmarks.removeBookmark(curQuestionId, curLink.id, bookmark.id);
      renderList();
    });
    row.appendChild(deleteBtn);

    return row;
  }

  syncBookmarkControlsVisibility();
  renderList();
  renderPlaylistPanel();

  addBtn.addEventListener("click", () => {
    if (!player || typeof player.getCurrentTime !== "function") return;
    bookmarks.addBookmark(curQuestionId, curLink.id, { start: Math.floor(player.getCurrentTime()) });
    renderList();
  });
  rawToggleBtn.addEventListener("click", () => {
    rawTextMode = !rawTextMode;
    renderList();
  });

  /**
   * Sequential/mid-bookmark auto-play (see module doc above) — only acts while the player is
   * actually playing, so it never yanks the seek head around while paused/scrubbing by hand.
   * @param {number} currentTime
   */
  function runSequentialTick(currentTime) {
    if (!isPlaying || rangedBookmarks.length === 0) return;
    const idx = rangedBookmarks.findIndex((b) => currentTime >= b.start && currentTime < /** @type {number} */ (b.end));
    if (idx !== -1) {
      activeBookmarkIndex = idx;
      return;
    }
    if (activeBookmarkIndex === -1) return;
    const finished = rangedBookmarks[activeBookmarkIndex];
    if (currentTime < /** @type {number} */ (finished.end)) return;
    const next = rangedBookmarks[activeBookmarkIndex + 1];
    if (next) {
      player.seekTo(next.start, true);
      activeBookmarkIndex += 1;
    } else if (playlist && playlist[curIndex + 1]) {
      // Group Playback: finishing the last bookmark with another video queued moves on to it
      // immediately, rather than pausing here and stranding the rest of the untagged video.
      advanceToNextInPlaylist();
    } else {
      // No next bookmark, and nothing queued after it — stop exactly at this one's end instead of
      // rolling on into the rest of the (untagged) video.
      if (typeof player.pauseVideo === "function") player.pauseVideo();
      activeBookmarkIndex = -1;
    }
  }

  loadYouTubeApi().then((YT) => {
    // Starting position: with 1+ ranged bookmarks, start the video at the FIRST one rather than the
    // beginning (or the URL's own ?t= timestamp) — playback then proceeds bookmark-to-bookmark via
    // runSequentialTick above once it's playing. Unconditional — the Global Autoplay toggle below
    // only decides whether playback begins on its own, not where.
    const initialRanged = (bookmarksSupported() ? bookmarks.getLink(curQuestionId, curLink.id)?.bookmarks ?? [] : [])
      .filter((b) => b.end != null)
      .sort((a, b) => a.start - b.start);
    const startSeconds = initialRanged.length > 0 ? initialRanged[0].start : extractStartSeconds(curLink.url);

    player = new YT.Player(mountId, {
      videoId: curVideoId,
      playerVars: { start: startSeconds || undefined, rel: 0, autoplay: forceAutoplay || appState.toggles.youtubeAutoplayOn ? 1 : 0 },
      events: {
        onReady: () => {
          addBtn.disabled = false;
          tickTimer = setInterval(() => {
            if (!player || typeof player.getCurrentTime !== "function") return;
            const t = player.getCurrentTime();
            currentTimeEl.textContent = formatTimestamp(t);
            runSequentialTick(t);
          }, 500);
        },
        onStateChange: (event) => {
          isPlaying = event.data === YT.PlayerState.PLAYING;
          // Group Playback: a video that plays all the way to its natural end (no bookmarks, or
          // bookmarks that don't cover the end) advances to the next playlist entry the same way
          // runSequentialTick's "last bookmark, next video queued" branch does.
          if (event.data === YT.PlayerState.ENDED) advanceToNextInPlaylist();
        },
      },
    });
  });
}
