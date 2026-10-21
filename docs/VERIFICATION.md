# FreeBoard verification report

Release candidate 1.0.0 • 21 October 2026. Results are measurements and observations from this build session, not a certification or a guarantee on untested devices.

## Stylus handwriting repair — 21 October 2026

A user report identified poor stylus handwriting despite earlier mouse-oriented checks. Those checks did not establish physical stylus quality. Investigation found that a palm touch in Excalidraw 0.18.1 could cancel and remove a short active freehand stroke. The host also requested a full recovery checkpoint after every pointer-up.

The repair adds a pen-only input adapter: coalesced samples and pressure are buffered outside React, active ink is painted on a separate canvas using the engine's own freehand outline, and pen lift commits one editable native history object. Pointer cancellation and focus/visibility loss commit received ink. A tiny second point preserves pen-tap dots through the engine's restore logic. Palm contacts during pen contact or within 350 ms of pen hover are rejected until their lift. Touch before any pen proximity remains ordinary finger input. Mouse, finger gestures, shapes, selection and erasing use the existing engine. Save timers pause during stylus contact and resume after idle; pointer-up no longer queues a full recovery write.

**Automated:** 48 tests across 8 suites pass. New coverage includes coalesced/absent/empty sample APIs, pressure fallback, transformed bounds, long-stroke normalization, taps, pen/palm routing, cancellation, view mode, spacebar, deferred saves and duplicate checkpoint coalescing. Existing history, connectors, validation, storage recovery, quota failure and service-worker checks remain passing. All 11 full-app journeys also pass on the repaired app (`verification/stylus-app-journeys.json`): import, keyboard style presets, image backup, Bengali/English composition, text history, reload/round trip, duplicate/trash/restore, invalid imports, storage failure/retry, tab conflict and desktop/tablet/mobile layouts.

**Real app browser harness:** `npm run dev`, open `/inking.html`, click **Run pen regression**. It creates a separate QA board in the current browser; existing boards are preserved. `verification/pen-input.json` records the final run in Chromium 154 on Linux. Scene: 600 objects (200 rectangles, 200 ellipses, 200 text objects), then pen input. Twenty-four short strokes have eight move dispatches each, each carrying four coalesced samples plus the dispatch endpoint. The native baseline lost the palm-interrupted stroke and wrote to IndexedDB 24 times during 24 strokes. The repaired run retained the palm stroke, 42 points and 42 pressure values in the last test stroke, and made zero store puts during the continuous writing sequence. Undo removed one whole stroke and redo restored it. Cancellation, a dot and subsequent finger drawing brought the count to 28; all 28 reopened after refresh. PNG/SVG preparation through the real export dialog succeeded (187,135 / 609,575 bytes; 930 / 367 ms including UI waits in this run).

The repaired run's synchronous DOM dispatch median/p95 was 0.10/1.70 ms. Remote animation frame median/p95 was approximately 156/1,016 ms even with `visibilityState` reporting visible, so these measurements **do not establish physical input-to-pixel latency, frame rate or perceived smoothness**. Earlier mouse checks and synthetic input are not a physical stylus certification. Chrome/Edge hardware, Android tablets, iPad/Safari, palm-before-hover behavior and pressure feel still require owner testing on real devices. No benchmark claim is invented for those environments.

The main content origin and IndexedDB namespace are retained while the canonical route becomes `/FreeBoard/`. A compatibility worker at the old route waits for explicit update activation, keeps old cached assets for active tabs, and redirects subsequent navigation. It does not delete documents. The public README uses actual application screenshots and links to the canonical app/source.

## Public deployment acceptance

The final runtime source tree (`58f9554`) passed [GitHub CI](https://github.com/Ataullha/FreeBoard/actions/runs/39580924529), including formatting, type checks, 48 tests, production build and production dependency audit. The portfolio commit `a2b263d` passed [build and Pages deployment](https://github.com/Ataullha/ataullha.github.io/actions/runs/39581514438). Published app: <https://ataullha.github.io/FreeBoard/>. Its loaded `assets/index-BENJQ12I.js` matches the local production build, including the pen overlay; worker cache version is `freeboard-db299f1546ce45c3`.

The existing live `/FreePod/` session was refreshed, offered **Save & restart**, and followed the compatibility worker to `/FreeBoard/`. The saved board reopened and reported Available offline. An editable backup downloaded from the new route had all nine original objects and image-file mappings exactly equal to its pre-migration backup; mixed Bengali/English multiline text was retained. No document storage was cleared.

The portfolio's FreeBoard icon was clicked and opened the canonical route. Classroom still targets its original Google Drive folder. The second app tab correctly reported viewing mode while the first held the editing lock. The public README logo, CI badge and all three actual application preview images loaded successfully. Both published repository trees were compared with their prepared local trees and matched exactly. Physical-device and offline-network limitations above still apply; these live checks do not substitute for a hardware stylus test.

## FreeBoard final monochrome release

The application is renamed FreeBoard across its interface, page titles, install manifest, icons, exported filenames, source package, documentation and CI. The interface, starter illustrations, new template boards and default canvas are monochrome. Inter typography and Noto Sans Bengali remain bundled locally. Existing artwork and image colors are preserved.

The original IndexedDB database, preference keys, broadcast channel and browser locks are deliberately retained. Existing saved boards remain available on the same website origin. Native imports accept both FreeBoard and legacy BoardPilot v1/v2 backups, normalizing the format and inert sticky marker without rewriting artwork. Service-worker tests cover both old cache-name prefixes and protect lazy chunks needed by older open tabs.

The new verification records are `verification/freeboard-editor-checks.json` and `verification/freeboard-app-journeys.json`. Earlier results and performance files are retained as historical baseline measurements. See [DESIGN.md](DESIGN.md) for the final monochrome theme.

## Environment

- Node.js 24.19.0 and npm, Linux build container.
- Remote Linux Chromium 154.0.0.0; desktop viewport 1363 × 936 at device scale 1.
- Development browser lab uses the actual Excalidraw engine and application, with synthetic pointer/keyboard/file events. The app journey tests use real DOM controls, real IndexedDB, raster files and editable downloads.
- The provided preview uses an insecure HTTP hostname. It does not expose service workers or Web Locks as a secure HTTPS origin would. Revision-check and BroadcastChannel protection were exercised instead.

## Automated checks

`npm ci` succeeded from a separate clean copy of the project. TypeScript passed. All **36 tests in six suites passed**. `npm run check` successfully produced the static build from that clean install. Its build manifest and cache hash matched the delivered production build exactly. Source formatting passed. The production dependency audit reported **zero known vulnerabilities** on 21 October 2026; retain the lockfile and repeat the audit before future releases.

| Area           | Checks                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coordinates    | Scene/viewport round trips, pan/zoom offsets, pointer-anchored zoom and clamping                                                                                                |
| Serialization  | Bengali/English text, images, styles and attached-arrow references; selected-object reference closure; v1 migration and v2 round trip                                           |
| Validation     | Malformed/future documents, nonfinite values, invalid IDs/types, remote and SVG images, active metadata, missing image assets                                                   |
| IndexedDB      | Atomic create/save, duplicate, trash/restore, draft recovery, stale-draft rescue, concurrent revision rejection, legacy storage migration, same image ID isolated across boards |
| Autosave       | Failure remains dirty, no false Saved, retry, edits and renames during in-flight writes, initially unavailable storage                                                          |
| Images         | Signature, dimensions and pixel budgets checked before image decoding                                                                                                           |
| Service worker | Complete install, failed asset install, offline navigation/assets, cross-origin exclusion, deliberate update activation, old lazy chunks retained for multiple tabs             |

Worker tests run the actual worker template in a simulated worker/cache environment. They do not replace a real installed-PWA test.

## Browser editor checks

All **11 native editor checks passed**, including actual pointer movement/resizing of shapes with attached arrows. See `verification/freeboard-editor-checks.json`; earlier checks remain in `verification/editor-checks.json`.

1. Native coordinate conversions match after pan and zoom.
2. Insert/undo/redo creates one native history action.
3. Move, resize, rotation, style, deletion and their undo/redo preserve state.
4. Native group, ungroup and ungroup undo work.
5. Attached arrows follow a dragged and resized shape.
6. Touch pointer drawing creates a multi-point stroke; Hand pans with touch.
7. Two touch pointers increase zoom around their center.
8. Bengali/English text and raster images survive JSON round trip, PNG and SVG export; transparent PNG alpha and embedded SVG fonts/images are checked; both exported images decode.
9. Real browser IndexedDB recovers drafts, rejects stale saves and restores Trash.
10. Simulated quota failure never reports Saved and keeps the scene dirty.
11. Core drawing continues with fetch disabled after assets have loaded, making zero fetch attempts.

The history tests use native action dispatch; the connector, touch and offline checks use pointer events. They do not measure physical stylus latency or validate hardware palm rejection.

## Application journeys

All **eleven application journey checks passed**. The tests verified keyboard/toolbar style-preset consistency, local image insertion through the actual drop pipeline, editable exports, Bengali/English note editing and composition without drawing shortcuts, IME Escape candidate handling, one-action text undo/redo, reload, backup reopening, duplicate/trash/restore, invalid imports leaving the current board intact, quota-error export and successful retry, and BroadcastChannel/CAS stale-tab protection. Custom controls remained named, at least 24 pixels in size, within bounds and separated from history/navigation at **320, 390, 768 and 1100 CSS pixels**. See `verification/app-journeys.json` for the original run and `verification/app-journeys-redesign.json` for the previous frontend refresh; `verification/freeboard-app-journeys.json` records the FreeBoard release. Mobile Fit content, pen selection, expanded properties, collapsed history and the two-column board library were also inspected in the browser. The development journey runner resets its viewport before each run, including after a phone preview.

## Production smoke check

The final compiled FreeBoard assets were served locally with the shipping content-security policy applied through a preview-only meta tag (the deployed `_headers` file supplies the actual headers). Startup reopened an existing board from the retained database. The workspace created a new editable monochrome lesson with Bengali and English text. SVG preparation succeeded using local fonts; its filename was `Todays lesson.svg`. Editable backup preparation succeeded with `Todays lesson.freeboard.json` and a ready-to-save download link. Fit content worked, and the header reported Saved on this device only after persistence. No application or CSP errors were observed; the browser emitted unrelated extension metadata errors. The original production smoke check additionally exercised the optional handwriting font and font-subsetting worker under the same CSP. Unsupported native links remain hidden.

The FreeBoard production build contains 395 files, about 22.72 MiB of assets, and no asset above Cloudflare's 25 MiB limit (largest asset 1,820,507 bytes). The release manifest is `dist/build-info.json`, cache version `freeboard-c8ff12fdab6b4054` (23,819,387 asset bytes before the worker/build-info files). All 392 precache paths resolve to bundled files. Static asset checks and archive CRC validation accompany packaging.

## FreeBoard performance measurements

The final FreeBoard build was measured in the same deterministic 600-object development scene. `verification/freeboard-performance.json` records the first run, with the other QA views open. `verification/freeboard-performance-repeat.json` records the repeat after closing them.

| Measurement                          |               First run |      Editor-only repeat |
| ------------------------------------ | ----------------------: | ----------------------: |
| Insert to second animation frame     |              1,988.1 ms |                160.1 ms |
| Idle frame median                    |              1,016.9 ms |                 16.9 ms |
| Six-object pan to frame median       |              1,015.0 ms |              1,016.5 ms |
| 600-object pan to frame median / p95 |    1,017.0 / 1,557.7 ms |    1,016.4 / 1,039.6 ms |
| Native update enqueue median / p95   |           1.0 / 67.4 ms |            0.5 / 2.6 ms |
| Pan long tasks / longest             |           18 / 2,245 ms |               3 / 63 ms |
| PNG export                           | 760.6 ms; 875,778 bytes | 589.2 ms; 875,778 bytes |
| SVG export                           | 332.4 ms; 838,142 bytes | 226.7 ms; 838,142 bytes |

The repeat reduced interference by closing other test views. The similar six-object and 600-object pan frame waits suggest that remote presentation or scheduling contributes to the reported delay; this is an inference, not a measured hardware diagnosis. Native update enqueue was below 3 ms at p95 in the repeat. Three pan long tasks remained, and the idle frame timing differed substantially between runs. These are development/remote-browser measurements, not FPS or physical input-latency claims. Target-device profiling remains necessary before performance marketing claims. The UI uses actual neutral colors, not a grayscale filter on the drawing canvas, and export memory remains capped at 16 million pixels / 8192 pixels per side.

## Performance method

The measurements below were collected for the original offline application before the Inter/frontend refresh and FreeBoard rename, and are retained as a historical baseline. The current FreeBoard runs are recorded above; the older baseline remains below for context. Do not present the historical timings below as current FreeBoard results.

Open `/qa.html` in development and click Run 600-object benchmark. The deterministic scene contains 600 objects: 100 each rectangles, ellipses, mixed Bengali/English text, arrows, raster image objects and freehand/highlighter strokes, with 2,800 stroke points. Images share one small local raster asset. Layout is a 30 × 20 arrangement; seeds and coordinates are deterministic. This measures the engine scene, not a board full of 100 distinct photographs.

The first recorded run (`verification/performance.json`) measured:

| Measurement                                               |           Observed value |
| --------------------------------------------------------- | -----------------------: |
| Insert to second animation frame                          |                  12.0 ms |
| Pan update to next frame, median / p95                    |       1016.3 / 1017.2 ms |
| Six-step pointer gesture, including animation-frame waits |               16262.9 ms |
| Entire-scene PNG export                                   | 3059.7 ms; 880,259 bytes |
| Entire-scene SVG export                                   |  131.6 ms; 825,806 bytes |

The pan-update animation-frame waits were around one second in this remote environment. The gesture deliberately waits for two frames per step, so its wall time includes those waits. These values are **not** FPS, input latency or a claim of smooth 60 Hz interaction. A repeat includes an idle-frame baseline and native update-enqueue timings to distinguish scheduler waiting from API-call work. Physical-device interaction profiling remains an owner check.

The final run (`verification/performance-final.json`) added a six-object control and long-task observation. Idle frames measured 1016.5 ms median; the six-object pan control measured 1015.8 ms; 600-object pan measured 1016.4 ms median / 1017.3 ms p95. Native update enqueue cost was 0.1 ms median / 0.3 ms p95, with no observed main-thread long tasks during the pan phase. The similar idle/control timings support an inference that much of this delay comes from remote presentation/scheduling rather than object-count work. They do not establish hardware input latency. The final PNG took 4074 ms and SVG 202 ms, with the same 880,259 / 825,806 byte outputs. Across the recorded runs, PNG export was about 3.05–4.07 seconds and SVG about 110–202 ms.

PNG export is the observed costly operation in this scene. The implementation limits it to 16 million pixels and 8192 pixels per side; export preparation reports its busy state and offers SVG as another format. Autosave clones a scene at write boundaries, debounces writes and avoids cloning on every pointer callback. Content-version comparison avoids repeat persistence captures when the document/view has not changed. All fonts are cached locally; the larger initial offline asset download is a deliberate cost of keeping every offered font available offline.

## Accessibility and layout

The shell uses semantic buttons, labeled tool states, named controls, visible focus outlines, modal native dialogs, keyboard shortcuts and reduced-motion CSS. Text-editing targets and IME composition do not trigger tool shortcuts. Custom shell text colors were checked: muted text on white 5.74:1; primary white button text on black 18.88:1. Status messages use labels and icons as well as tone. This is not a claim that every native editor surface meets a complete WCAG audit.

The mobile review found and fixed duplicate zoom controls and history/navigation overlap, enlarged drawing targets to 42 × 42 pixels, and supplied an explicit accessible name for the icon-only board library button. Final automated layout checks inspect custom control names, bounds, minimum 24-pixel targets and history/navigation separation at multiple widths.

## Remaining verification and product limits

- Chromium on Linux was available. Firefox, Safari, Edge, iOS/iPadOS and Android browsers were not available for this session. Physical phones/tablets, stylus pressure, palm rejection and a real Bengali OS input method need device checks. Composition events and mixed-language text were exercised in Chromium.
- Full HTTPS PWA installation, cold offline reload and a live two-version service-worker update need the deployed HTTPS origin. Actual service-worker code has automated lifecycle/cache tests; loaded-asset drawing was verified with fetch disabled. Do not describe this as a completed physical offline-install test.
- The remote browser download handoff did not yield a retrievable file during the final smoke check. Export blobs, editable round trips and PNG/SVG decoding were checked; saving the prepared file through the operating system remains an owner-browser check.
- The native operating-system file chooser was not relied on in the repeat run. Real File objects were exercised through the app's drop/import/image handlers. Owner review should also choose files with the visible file picker.
- Keyboard and semantic controls were checked, but no screen-reader audit was available. Canvas artwork is inherently visual; complete nonvisual object manipulation is not claimed.
- Browser storage can be evicted/cleared. Trash is recoverable and has no permanent purge or asset garbage collector. Undo history is session-only; saved documents and checkpoints survive reload. The last changes before an abrupt crash may precede the latest successful checkpoint.
- There are no cloud accounts, synchronization or real-time collaboration. These are intentionally absent from the production interface. Static hosting has no board database or cross-device access.
- Full-size PNG export can take seconds and is pixel-capped. The observed frame waits in the remote test prevent credible hardware interaction/FPS conclusions; repeat the included benchmark on target devices before performance marketing claims.

## Repeat it

```sh
npm ci
npm run format:check
npm run check
npm audit --omit=dev
npm run dev
```

Visit `/qa.html` for the 11 editor checks and 600-object benchmark. Visit `/journeys.html` for the application journeys; this creates new QA boards without deleting existing ones. Both labs are development-only and are not entry points in the production build. Use `npm run preview` to inspect the production bundle, then carry out the HTTPS/offline/update checks in `DEPLOYMENT.md`.
