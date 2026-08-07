# Rewrite Interview Question Viewer from scratch

## Context

The repo currently contains only spec/reference material — `feature.md` (locked 38-feature
checklist), `README-AI.md` (22 gotchas from a prior implementation that no longer exists in this
repo), `data.js` (seed CSV), `docs/Data_JS_Import_Aug05_v001.csv` (reference CSV), and
`rewrite-prompt.md` (a fully-drafted architecture spec written in a prior session). There is no
existing `index.html`/`css/`/`js/` to migrate — this is a greenfield build, not a refactor.

The user confirmed they want this session to actually execute the rewrite now (not just hand the
prompt to a separate future session). The goal is to build a vanilla-JS, native-ES-module app
(no bundler) with JSDoc+`tsconfig` type checking that reproduces 100% of `feature.md`'s behavior
while avoiding the architectural mistakes documented in `README-AI.md` (chiefly: a single
3,142-line god-module owning rendering+CRUD+drag-drop+bulk-CSV+copy-builders, and a render
approach that nukes and rebuilds the entire tree on every change).

Two research passes already extracted the full feature list and gotchas from `feature.md`/
`README-AI.md` (no need to re-read them line-by-line during implementation, though they remain the
tie-breaker source of truth for exact wording), and a Plan pass produced a complete file-by-file
architecture. Four ambiguities in that architecture were resolved with the user:
- **Bulk Add/Update/Copy CSV format**: comma-separated with a required header row (per feature.md's
  literal wording — chosen over README-AI.md's tab-separated/header-less description).
- **Active Question**: single pointer global across all files (top-level schema field, not nested
  in `FileRecord`), keyed by the question's stable ID (not content) since IDs are now fixed at
  import time.
- **Study Timer**: global, not per-file.

## Stack

- Vanilla JS, native ES modules (`<script type="module">`), no bundler/build step to run the app.
- JSDoc annotations + `tsconfig.json` (`checkJs: true, allowJs: true, noEmit: true`) for `tsc
  --noEmit` type checking as a dev-time step only.
- CDN libraries: PapaParse (CSV), SortableJS (drag-and-drop), Font Awesome (icons), Bootstrap (CSS
  + plain programmatic JS APIs only — **not** its data-api collapse/accordion, which is the root
  cause of gotcha #2). Drop jQuery + Select2 entirely; replace with a small custom dependency-free
  multi-select component.
- `node --test` for pure-logic sanity checks (grouping/sort order, CSV round-trip, bulk dedup
  matching, order-recompute math) — no test framework dependency needed.

## File layout

```
index.html                # shell: CDN tags, static DOM skeleton, <script type="module" src="src/app.js">
tsconfig.json, package.json (typecheck/test scripts)
css/style.css

src/
  app.js                  # entry: bootstrap + wire static DOM controls to feature modules only
  types.js                # JSDoc @typedef only: Question, Group, FilterState, StorageSchemaV1, etc.

  data/                    # pure, zero-DOM domain layer (each file has a co-located *.test.js)
    id.js                  # stable question ID generator (assigned once at CSV import)
    group.js               # groupData() — Subject→Topic→SubTopic→Question, Starred-top/LessImportant-bottom tiering
    order.js                # nextOrder()/moveUp/Down/Top/Bottom — ALWAYS reads full unfiltered rawData
    emptyGroups.js          # placeholder group tracking (mark/prune/rename), separate from rawData
    filter.js               # filterGroupedData(), interdependent filter-option computation
    csv/mainCsv.js          # parse/serialize main file CSV (comma, header, empty-group marker rows, Duplicate-excluded on export)
    csv/bulkCsv.js          # parse/serialize Bulk Add/Update/Copy CSV (comma-separated, header required); dedup + update-matching
    copyBuilders.js         # 5 pure text builders (plain, structure+answer, hierarchy, structure-only, hierarchy-only), never leak ancestor path
    mutations.js            # the ONLY place that mutates {rawData, emptyGroups}: add/update/rename/delete/move/bulkAdd/bulkUpdate — returns new immutable pairs
    search.js                # Jump to Question (max 10 grouped results, scoped to filtered set)
    fuzzyHints.js            # duplicate-detection fuzzy matching for draft questions
    filename.js              # export filename auto-versioning (name_MonDD_v0NN.csv)

  persistence/
    schema.js                # SCHEMA_VERSION + single root localStorage key (iqv:v1) — one envelope, not scattered keys
    store.js                  # typed read/write per schema section; emits "iqv:persisted" DOM CustomEvent on every write (sync layer's hook)
    tempMode.js               # redirects store.js writes to in-memory Map when Temp/Test Mode is on

  state/appState.js           # runtime singleton: current file, rawData, grouped, filterState, openNodeKeys (Set), activeQuestionId, toggles, transient selection sets

  render/                      # rendering only — no CRUD/DnD/CSV logic
    keyedList.js               # generic keyed-diff/patch primitive (LIS-based move minimization), reused at every tree level
    accordion.js                # open/closed Set-backed component; bindHeader() with proper stopPropagation for nested clickables
    highlight.js                 # shared full-header flash/highlight overlay (jump-to-question + relocate-flash + drop-target)
    treeRenderer.js               # orchestrates nested-accordion tree via keyedList + accordion + nodeViews
    flatRenderer.js                # Flatten View: one heading per non-empty group, no collapse, no bulk-select/drag
    nodeViews/{subjectView,topicView,subTopicView,questionView}.js
    breadcrumb.js, statsBadges.js

  features/                     # thin CRUD/UI modules — call data layer + render engine's patch API only
    fileManager.js, filters.js, statusFlags.js, timer.js, editMode.js, answerEditor.js,
    quickAdd.js, bulkAdd.js, bulkUpdate.js, bulkCopy.js, duplicateHints.js, rename.js,
    deleteGroup.js, bulkSelection.js, moveForm.js, dragDrop.js, moveButtons.js, emptyGroups.js,
    copySingle.js, copyMenus.js, copyVisible.js, flattenView.js, undoRedo.js, closeAll.js,
    floatingToggles.js, activeQuestion.js, search.js, tempMode.js

  multiselect/multiSelect.js    # dependency-free multi-select (replaces jQuery+Select2)

  sync/
    jsonbin.js, gzip.js, syncConfig.js, autoPush.js, autoPull.js, manualPull.js
```

Discipline to enforce throughout (this is what prevents `tree.js` from re-forming): `render/*`
never imports `features/*`; `features/*` never touch the DOM except through `render/*`'s exported
patch functions; `data/*` never imports `render/*`/`persistence/*` or touches `document`/`window`.

## Storage schema (single root key `iqv:v1`)

- `StorageSchemaV1`: `schemaVersion`, `files: FileRecord[]`, `activeFileId`, `globalToggles`,
  `activeQuestion: {fileId, questionId} | null` (top-level, global, ID-keyed), `sync`, `timer`
  (top-level, global).
- `FileRecord`: `id, fileName, rawData: Question[], emptyGroups: EmptyGroup[], filters:
  FilterState, lastExportVersion, lastExportDate`.
- `Question`: stable `id` (assigned once at import, internal-only, not a CSV column) plus
  `subject/topic/subTopic/question/answer/done/reviewLater/duplicate/lessImportant/starred/order/
  subjectOrder/topicOrder/subTopicOrder`.
- `EmptyGroup`: `subject, topic|null, subTopic|null, createdOrder`.
- `GlobalToggles`: `flatGroupView, dragDropOn (default true), editModeOn, tempMode`.
- Full typedefs go in `src/types.js` first, before any other code, as a reviewable checkpoint
  against `feature.md`.

## Render engine: keyed reconciliation

`render/keyedList.js` implements a classic keyed-diff/patch primitive (LIS-based move
minimization, same class of algorithm as React/Vue's keyed lists, no VDOM): index existing DOM
children by key, reuse+patch matching keys in place (preserving scroll/focus/open state for free),
compute the longest increasing subsequence of retained positions to minimize `insertBefore` calls,
remove stale keys last. Keys: `S::subject`, `...::T::topic`, `...::ST::subTopic`, `Q::questionId`.
`render/accordion.js` owns `appState.openNodeKeys` as first-class state (never scraped from DOM);
node-view create/patch functions read it to decide expanded/collapsed rendering. A status-flag
toggle only reconciles the affected SubTopic's question list, not the whole tree.

## Drag-and-drop integration

`features/dragDrop.js` owns all `Sortable.create()` calls (Subject/Topic/SubTopic/Question lists).
On `onUpdate`/`onAdd`, it reads the post-drag DOM key order, maps to question IDs, calls
`data/order.js` + `data/mutations.js.moveQuestions` (the same function `moveForm.js` uses), then
`treeRenderer.patchAfterMutation()` reconciles just the affected SubTopic(s) — any tiering
violation from the raw drag position self-corrects on that patch. Dropping onto a **collapsed**
SubTopic header is handled via a document-level hit-test during active drags
(`elementFromPoint`-based, using the shared `highlight.js` overlay for the drop-target indicator)
that bypasses Sortable's own DOM-insertion path and calls `moveQuestions` directly, since a
collapsed target has no live list DOM to reconcile against.

## Build order

1. **Scaffolding**: `tsconfig.json`, `package.json`, `index.html` shell, empty `css/style.css`.
2. **Types**: `src/types.js` written and checked against `feature.md`'s CSV columns and 5 status
   flags before anything else.
3. **Data/domain layer**, bottom-up, each module with its `node --test` file written alongside:
   `id.js` → `group.js` (+test) → `order.js` (+test, explicitly asserting order math never derives
   from a filtered/shorter array) → `emptyGroups.js` (+test) → `filter.js` (+test) →
   `csv/mainCsv.js` (+test, round-trip using `docs/Data_JS_Import_Aug05_v001.csv` as a real
   fixture) → `csv/bulkCsv.js` (+test) → `mutations.js` (+test: delete-blocked-while-nonempty,
   rename-cascades-to-emptyGroups) → `copyBuilders.js` (+test: scope never leaks ancestor) →
   `search.js`, `fuzzyHints.js`, `filename.js` (+test). Checkpoint: `node --test` all green,
   `tsc --noEmit` clean.
4. **Persistence layer**: `schema.js` → `store.js` (+test: every write emits `iqv:persisted`) →
   `tempMode.js`.
5. **Runtime state + render engine**: `state/appState.js` → `render/keyedList.js` →
   `render/accordion.js` → `render/highlight.js` → node views (question → subTopic → topic →
   subject) → `treeRenderer.js` → `flatRenderer.js` → `breadcrumb.js`/`statsBadges.js`.
   Checkpoint: wire a hardcoded sample-data load in `app.js` and confirm the tree actually paints
   in a browser (first visual checkpoint, via the `run` skill).
6. **Feature modules**: `fileManager.js` (first full vertical slice) → `filters.js` +
   `multiSelect.js` → `statusFlags.js`, `answerEditor.js`, `editMode.js` → `activeQuestion.js`,
   `search.js` → `quickAdd.js`, `bulkAdd.js`, `bulkUpdate.js`, `bulkCopy.js`,
   `duplicateHints.js` → `rename.js`, `deleteGroup.js`, `bulkSelection.js` → `moveForm.js` +
   `dragDrop.js` together (collapsed-header-drop is the trickiest single piece) →
   `moveButtons.js`, `emptyGroups.js` → `copySingle.js`, `copyMenus.js`, `copyVisible.js` →
   `flattenView.js` → `undoRedo.js` (wrapped last, retrofitting every mutation call site through
   `applyMutation()`) → `timer.js`, `closeAll.js`, `floatingToggles.js`. Checkpoint: manually walk
   upload → browse → edit → status toggle → bulk add → move → drag-drop → undo/redo in-browser
   before starting sync.
7. **Sync layer**: `jsonbin.js`, `gzip.js` → `syncConfig.js` → `autoPush.js` (subscribes to
   `iqv:persisted`), `autoPull.js`, `manualPull.js`. Checkpoint: manual push/pull test.
8. **Final wiring**: `src/app.js` wires every static control to its feature module (should stay
   short — logic lives elsewhere). Run via the `run` skill and walk every one of `feature.md`'s 38
   items end-to-end, with specific attention to: drag-and-drop onto collapsed headers, bulk CSV
   add/update with duplicate rows, undo/redo across several mutation types in a row, and the
   JSONBin sync flow. Final `tsc --noEmit` + `node --test` sweep.

Do not leave partial/stubbed features. If anything in `feature.md` turns out ambiguous or
contradictory beyond what's already resolved above, stop and ask rather than guessing.

## Verification

- `node --test` across all `data/*.test.js` and `persistence/store.test.js` must pass after each
  phase they belong to.
- `npx tsc --noEmit` must be clean after each phase.
- Two in-browser checkpoints (end of render-engine phase, end of feature-modules phase) plus a
  final full walkthrough of all 38 `feature.md` items via the `run` skill — this is the real
  functional verification, since type-checking and unit tests only cover pure logic, not UI
  behavior.
