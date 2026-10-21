# FreeBoard interface and typography

Updated 21 October 2026. The whiteboard remains the main workspace. The redesign improves hierarchy, type, control states and workspace organization without adding account or cloud requirements.

## Direction

FreeBoard uses a strictly monochrome interface: black primary actions, white surfaces, neutral gray borders and high-contrast text. Its original F mark is rendered as local SVG and install icons. The header is compact, the drawing dock floats above the canvas, and contextual properties appear only when useful. An active tool has a black surface, white icon and a programmatic pressed state.

The direction was informed by the product teams' own accounts of [Figma UI3](https://www.figma.com/blog/our-approach-to-designing-ui3/) and [Linear's UI redesign](https://linear.app/now/how-we-redesigned-the-linear-ui): prioritize work, use clear hierarchy, align controls consistently and remove competing visual noise. FreeBoard uses original layouts, copy and vector illustrations; it does not reproduce either company's interface or assets.

The empty canvas offers three editable starting points. Template illustrations are small local SVG components, with no network or image-generation requirement. The board library uses segmented folders, a labeled search input, current-board indicators and thumbnail cards. Export, help, privacy and recovery dialogs share the same type and spacing system.

## Typography

| Use | Family and weight |
| --- | --- |
| Interface | Inter 400, 500, 600 and 700, with Noto Sans Bengali fallback |
| Empty-state heading | Inter 600, 38 px desktop / 28 px phone |
| Dialog titles | Inter 600, 25 px desktop / 21 px phone |
| Header title | Inter 600, 13 px desktop / 12 px phone |
| Canvas default sans-serif | Local Inter 400 through the editor's Helvetica family alias |
| Bengali canvas text | Local Noto Sans Bengali 400 through explicit fallback aliases |
| Additional artwork fonts | The editor's locally bundled, licensed font choices |

Inter is pinned to `@fontsource/inter` 5.3.0. Only the four required Latin weights are bundled for the interface. Noto Sans Bengali remains pinned to 5.2.8. There are no runtime Google Fonts, remote stylesheets or CDN requests. SVG exports embed the same local Inter and Bengali fonts used on the canvas; PNG export waits for the canvas families to load. The fonts remain under the SIL Open Font License 1.1, with full notices in the production distribution.

## Color tokens

| Token | Value | Purpose |
| --- | --- | --- |
| `--ink` | `#171717` | Primary text and hierarchy |
| `--muted` | `#666666` | Supporting labels |
| `--accent` | `#111111` | Primary actions and active tool |
| `--accent-soft` | `#f1f1f1` | Quiet selected surfaces |
| `--line` | `#e5e5e5` | Borders and dividers |
| `--paper` | `#ffffff` | Interface canvas and previews |

New canvases use white backgrounds; starter templates and note defaults use neutral grays. Existing board backgrounds, artwork colors and image pixels are document content and remain intact. Functional artwork color swatches retain their actual colors so drawing color selection stays accurate. Muted text has 5.74:1 contrast on white and 5.74:1 on the standard canvas background. Primary white button text has 18.88:1 contrast on the black accent. These selected checks are not a complete WCAG audit.

## Responsive behavior

Desktop uses a single-row drawing dock and the full wordmark. Phone layouts retain 42 × 42 px drawing targets in two rows, compact the header, provide explicit zoom controls and keep navigation separate from undo/redo. Template and board grids become two columns. Dialogs stay within the viewport and scroll internally. Focus indicators, visible shortcuts, reduced-motion support and text-editing shortcut guards remain in place.

Verification details and remaining device checks are in [VERIFICATION.md](VERIFICATION.md).
