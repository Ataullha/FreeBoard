# FreeBoard

Make space for ideas. FreeBoard is a private, browser-based whiteboard for lessons, ideas and simple team workflows. Open it and draw immediately. No registration, API key, payment or backend is required.

FreeBoard pairs locally bundled Inter typography with a black-and-white interface, compact drawing controls and responsive workspace dialogs. Noto Sans Bengali supports mixed Bengali and English text. See the [design system](docs/DESIGN.md) for typography, colors and interface decisions.

FreeBoard is open source under the [MIT license](LICENSE). Everyone is welcome to fork the project, report bugs, improve documentation and propose changes through pull requests. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) before contributing. This is a release candidate; tested environments and remaining checks are documented in the [verification report](docs/VERIFICATION.md).

## Run it

Use Node.js 22.12+ (Node 24 LTS recommended) and npm. From the project directory:

```sh
npm ci
npm run dev
```

Open the URL Vite prints, normally `http://localhost:4173`. Production output is already included in the delivered source ZIP under `dist/`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development, including local font preparation |
| `npm run typecheck` | Strict TypeScript checks |
| `npm test` | Repeatable model, storage, import, autosave and worker tests |
| `npm run test:watch` | Watch automated tests |
| `npm run format:check` | Check maintained source formatting |
| `npm run build` | Type check, bundle and generate the offline worker in `dist/` |
| `npm run preview` | Serve the production build on port 4173 |
| `npm run check` | Type check, tests and production build |
| `npm run package` | Create source and direct-upload ZIPs in `artifacts/` after building |

Do not open `dist/index.html` as a `file://` URL. Serve the directory. PWA installation, service workers and Web Locks need HTTPS or a trustworthy localhost origin. The development server deliberately does not register a service worker.

## Make something

Pick Pen, Highlighter, a shape, line, arrow, text or sticky note. Properties appear when useful. Double-click a note or shape to edit its text. Bengali and English work together, including multiple lines. Insert local PNG, JPEG or WebP images with the image button, paste, or drag and drop.

Select with V. Drag an object to move it; drag corner handles to resize and the upper round handle to rotate. Images preserve proportions by default; Shift allows free resizing. Shift-click or drag a selection rectangle for multiple objects. Use the right-click menu for group, lock, duplicate and layer order. Attach arrow endpoints near shape edges to keep connections when objects move or resize.

The object eraser deletes whole unlocked objects, including attached text. It does not erase individual stroke pixels. Highlighter strokes use 30% opacity; independent overlapping strokes accumulate color. Stylus pressure is used when supplied by the device.

Space-drag temporarily pans; H selects Hand. Wheel/trackpad navigation, pointer-centered zoom and two-finger pinch use the editor's coordinate system. Fit, reset view, grid and presentation controls sit at the lower right. Exit presentation with Escape. On touchscreens, use one finger for the active tool and two for navigation; Hand pans with one finger.

### Useful shortcuts

| Action | Shortcut |
| --- | --- |
| Select / pen / highlighter / hand | V / P / M / H |
| Rectangle / ellipse / arrow / line / text | R / O / A / L / T |
| Sticky / image / object eraser | N / I / E |
| Undo / redo | Ctrl or Cmd + Z / Shift + Z |
| Copy / cut / paste / select all | Ctrl or Cmd + C / X / V / A |
| Duplicate / group / ungroup | Ctrl or Cmd + D / G / Shift + G |
| Lock or unlock | Ctrl or Cmd + Shift + L |
| Bring forward / send backward | Ctrl or Cmd + ] / [ |
| Fit content | Shift + 1 |
| Save now / import backup | Ctrl or Cmd + S / O |

Tool shortcuts are ignored inside text editors, inputs and dialogs, and during IME composition. Use your operating system's Bengali input method. The in-app help contains the same shortcuts.

## Keep your work

The title field renames the open board. Boards opens your workspace: create, search, duplicate or reopen boards, choose one of three editable templates, restore Trash, or rescue an interrupted draft from Recovery. Trash is recoverable and has no automatic purge in this release.

Autosave uses IndexedDB for objects and images. “Saved on this device” appears only after a successful transaction. On storage failure, the board remains editable with a readable error, Retry and an immediate backup action. Do not close a failed or conflicted board before downloading a backup or making a copy.

**Browser storage can be cleared.** Private browsing, profile cleanup, disk pressure, a new device or a different website origin can make boards unavailable. Export important work regularly. Protect storage asks the browser for persistent storage; the browser may decline. The same browser profile can access all its local boards; this is not account isolation or encryption.

One tab holds the editing lock per board where supported. A second tab can view or copy it. Transactional revision checks reject stale writes even without Web Locks. Conflicting unsaved edits can be copied; stale recovery drafts can be rescued separately.

## Import, export and offline use

Export opens editable JSON, PNG or SVG options for the whole board or selected objects. Choose a solid or transparent image background. Click Prepare file, then Download. JSON preserves editable objects, styles, image bytes and version information. PNG is capped at 16 million pixels / 8192 pixels per side to protect device memory; SVG embeds fonts and images. Long or complex exports can take a few seconds.

Import a `.freeboard.json` backup from Boards, Ctrl/Cmd+O, or drag and drop. It creates a new board. Invalid files leave the current board intact. Imports accept FreeBoard and legacy BoardPilot document versions 1 and 2; future versions are rejected. Untrusted HTML, scripts, SVG images, embedded websites and remote image URLs are not supported.

Limits: 40 MiB backup input, 30 MiB decoded assets per backup, 10,000 objects and 250,000 stroke points. Local images: PNG/JPEG/WebP only, up to 10 MiB, 20 megapixels and 8192 pixels on either side. Header validation occurs before decoding.

On HTTPS, the production app caches its bundled assets and reports Available offline only when controlled by its worker. After that, reopening and editing need no network connection. Updates wait for Save & restart. Board storage is independent of application caches. No login, cloud sync or collaboration is included; share downloaded artwork or editable backups manually.

The FreeBoard rename preserves the original browser database and preference keys. Existing saved boards and `.boardpilot.json` backups remain available on the same website origin. New backups use `.freeboard.json`.

## Owner handoff

- [Deployment, direct upload and current hosting limits](docs/DEPLOYMENT.md)
- [Architecture and data-safety design](docs/ARCHITECTURE.md)
- [Interface and typography](docs/DESIGN.md)
- [Verification results, benchmark and untested environments](docs/VERIFICATION.md)
- [Privacy information](docs/PRIVACY.md)
- [Dependencies, licenses and attribution](docs/DEPENDENCIES.md)
- [Product description and launch copy](docs/LAUNCH.md)

The source ZIP includes source, tests, lockfile, notices, CI and a ready-to-upload production build. No private credentials are required. GitHub CI validates changes and uploads `dist`; it does not publish to a hosting account. Connect your own repository and hosting account when ready.

MIT for FreeBoard code. Bundled dependencies and fonts retain their respective licenses. See `LICENSE`, `THIRD_PARTY_NOTICES.txt` and `docs/licenses/`.
