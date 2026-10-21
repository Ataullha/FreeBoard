# Architecture

FreeBoard is a static React 18 / TypeScript / Vite application. The pinned Excalidraw 0.18.1 MIT editor handles drawing, coordinate transforms, hit testing, selection, bound connectors, native history and raster/vector rendering. FreeBoard owns the product shell, strict import boundary, board lifecycle, persistence and offline delivery. A pen-only canvas adapter collects coalesced pressure samples outside React, paints the active stroke once per animation frame with the engine’s own freehand outline, and commits one native editable/history object on pen lift. Mouse, finger gestures, selection, shapes, text and connectors use the native engine. Palm contacts cannot cancel an active stylus stroke; rejected contacts stay rejected through their release. Hover rejection has a short 350 ms grace period. A palm arriving before any pen proximity is not distinguishable from intentional finger input.

| Module                      | Responsibility                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/model/`                | Versioned BoardRecord/BoardBackup, scene selection closure, export references, coordinate helpers, safe IDs            |
| Excalidraw / `src/editor/`  | Native rendering, tools, selection, undo/redo, text and arrow bindings; editable starter templates and sticky creation |
| `src/storage/repository.ts` | IndexedDB transactions, schema upgrades, board-scoped assets, CAS revisions, trash and recovery                        |
| `src/storage/autosave.ts`   | Debouncing, serialized writes, dirty generations, retry and truthful status                                            |
| `src/storage/lease.ts`      | Web Locks editing lease, with revision protection as fallback                                                          |
| `src/io/`                   | JSON validation, image signatures/dimensions, sanitized clipboard, editable/raster/vector export                       |
| `src/ui/`                   | Accessible native dialogs, board library, export preparation and help                                                  |
| `src/App.tsx`               | Editor adapter, lifecycle coordination, shortcuts, error/recovery controls                                             |
| `src/pwa.ts`, `scripts/`    | Update prompting, static asset preparation and versioned offline cache                                                 |

## Product preview

`preview.html` is a separate Vite entry point. `src/showcase/main.tsx` owns the lightweight product presentation and lazy-loads `InteractiveDemo.tsx` on request. The demo uses Excalidraw and the existing pen/eraser adapters. Each template gets a keyed editor instance; a memory map retains its scene while switching. Controls that require the scene wait for initialization, preventing a download from capturing the previous editor during a rapid switch. No repository, autosave, board lease, preference write or worker registration is started by the preview. Its editable download uses the normal versioned document model and export code. Reset recreates only that demo instance.

`launchArtwork.ts` defines the 1200 × 630 social image in Canvas drawing commands. The owner-facing `share-card.html` can export that artwork with the locally bundled fonts and actual app screenshot. The final PNG is a static asset shared by the README and Open Graph metadata. All runtime assets remain local, and no dependency or paid service is added.

## Documents and history

Document version 2 stores immutable scene snapshots at persistence boundaries. Native editor history remains in memory; a continuous stroke or drag is one history action. Application insertions capture one immediate native history action. Text composition and editing use the native textarea; custom shortcuts ignore editable targets and composition events. History is intentionally reset when switching/reloading boards; persisted documents, rather than undo stacks, survive refresh.

Selected-object exports close over group members and bound text. Connectors are retained, but endpoints to excluded shapes are detached. References to missing objects are cleaned on import. The editor's binding system updates actual arrow geometry during pointer transformations.

## Persistence and conflict handling

IndexedDB database `boardpilot` (retained through the FreeBoard rename) has storage schema version 3. Stores are `boards`, legacy `assets`, `boardAssets` and `drafts`. Documents have an independent schema version. Missing v1/v2 stores are added transactionally; legacy asset records remain readable, and board fields migrate on read without deleting older data. Unknown future document versions are rejected. Connections close on `versionchange`.

Assets are keyed by board ID and asset ID, preventing an imported image ID from changing another board's image. A checkpoint checks the current saved revision and writes assets plus a writer-scoped draft in one transaction. Main save checks the same revision, writes board/assets atomically, increments revision and removes only the saving writer's draft. Failed writes leave the last committed document intact. No “Saved” state is emitted before the transaction completes.

Autosave schedules a draft after 180 ms and a main save after 650 ms of inactivity, after the latest edit. Stylus contact pauses background draft/save timers; lifting the pen restarts the idle window. It does not enqueue a full checkpoint for every letter. Repeated checkpoint requests coalesce, and an already checkpointed generation is skipped. Visibility loss, cancellation and focus loss commit the current pen stroke before recovery writes. Writes are serialized. A generation counter keeps edits made during a write dirty, and preserves a rename made during an in-flight save. The page attempts a flush on visibility loss and warns on unload while dirty; browsers do not guarantee asynchronous work during abrupt shutdown. Recovery protects committed checkpoints, not every last keystroke before a crash.

Web Locks obtains an exclusive editing lease per board when available. BroadcastChannel informs other tabs of newer revisions. CAS checks are the final protection on every writer, including browsers without either API. A conflict switches the editor to view mode and preserves its scene for export/copy. Dirty conflicts cannot silently switch away. Stale drafts remain separately rescuable.

Trash is a soft delete with a revision increment. No permanent-delete or asset garbage collection is exposed in this release. This favors recovery; long-running image-heavy workspaces should download backups and manage browser storage intentionally.

## Writing and workspace controls

`src/ui/LocalClock.tsx` owns its minute-aligned timer, so clock updates do not run in the pointer-input loop. Pen and marker widths are separate small preferences; the pixel slider maps to the engine’s freehand size factor, preserving the native editable/exported representation. Existing objects retain their styles.

`src/editor/growingEraser.ts` implements mouse-only hold growth and previews pending objects without mutating their document data. Screen-space radius is converted at the current zoom; swept circle tests cover fast movement, rotated shapes, negative path coordinates, and hollow/filled geometry. Release commits tombstones and detached connector bindings as one immediate native history action. Escape cancels. `boardEditing.ts` expands bound labels and group members while protecting locked objects; Clear board explicitly includes locked objects and uses the same tombstone/undo approach. Touch and stylus erasing remain native. Ellipse outlines use a polygon approximation; pressure-path hit margins are conservative.

## Safe input and exports

Only supported drawing element types and bounded numeric/style enums are accepted. JSON is parsed as data, never evaluated or inserted as HTML. Links, embeddables and arbitrary executable/custom data are stripped or rejected. Image data must be supported raster MIME with matching signatures and bounded decoded dimensions; URLs and SVG payloads are rejected. Clipboard and drop share these rules. The production CSP limits connections to the same origin and disallows frames/objects.

PNG/SVG use native engine bounds and rendering. PNG export caps pixels, avoiding unbounded mobile canvas allocations. SVG embeds the editor fonts plus local Inter and Noto Sans Bengali; raster files become data URLs. Backups contain data URLs and editable elements. No export is uploaded.

## Offline updates

Build output is content-hashed into a worker cache version. All runtime assets and fonts are precached in batches; incomplete installs fail without claiming offline readiness. New workers wait. Save & restart flushes the current document before requesting activation. Old caches remain while multiple clients may still need old lazy chunks. Cache data contains application assets only; board data remains in IndexedDB. A browser may independently evict storage.

## Deliberate scope

The application is a local whiteboard. There is no cloud login, public sharing service, collaboration, AI, remote asset loader or optional backend stub. Adding cloud later requires a separate authenticated adapter with account isolation, permissions, true synchronization and an independent quota/privacy model. Do not present static URLs or shared browser storage as collaboration.
