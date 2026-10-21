# Dependency and license decisions

Reviewed 21 October 2026. This application has no license-key requirement.

| Candidate | License / production condition | Decision |
| --- | --- | --- |
| Excalidraw 0.18.1 | MIT, copyright 2020 Excalidraw | Chosen: mature pointer handling, selection, bound text, arrows, transforms, native undo and rendering. |
| tldraw SDK | Its current SDK license requires a production license key, including its hobby-license path. | Not chosen for this key-free distribution. |
| Fabric.js | MIT | Viable canvas toolkit; selection history, connector binding, text containers and touch editing would require more application code. |

Primary references: [Excalidraw license](https://github.com/excalidraw/excalidraw/blob/v0.18.1/LICENSE), [tldraw license](https://tldraw.dev/community/license), [Fabric source/license](https://github.com/fabricjs/fabric.js).

## Included notices

`THIRD_PARTY_NOTICES.txt` is generated from installed production dependencies by `npm run prebuild`. It includes complete license files that those packages ship. `docs/licenses/EXCALIDRAW-MIT.txt` supplies the MIT notice omitted from the published Excalidraw package. Preserve the root license, third-party notices and font notices in redistributions. Production builds include the notices at `/THIRD_PARTY_NOTICES.txt`.

FreeBoard code and original vector icons are MIT licensed. The supplied Nuvexa project was inspected as the starting material; its notice is retained in `docs/licenses/ORIGINAL_PROJECT_LICENSE.txt`. FreeBoard's implementation is a separate React/TypeScript application.

## Fonts

All runtime fonts are served locally. Font binaries are copied unchanged from the pinned Excalidraw and Fontsource packages. `BUNDLED_FONT_NOTICES.txt` preserves copyright, trademark, designer and license metadata from every bundled editor font family. The corresponding full OFL and MIT notices are retained with the distribution.

| Family | License |
| --- | --- |
| Inter, Noto Sans Bengali | SIL Open Font License 1.1, full license in Fontsource notices |
| Assistant, Cascadia Code, Excalifont, Liberation Sans, Lilita One, Nunito, Virgil, Xiaolai | SIL Open Font License 1.1 |
| Comic Shanns | MIT, full copyright/permission notice in bundled-font metadata |

Primary additional font sources: [Inter and its license](https://rsms.me/inter/), [Fontsource Inter license](https://github.com/fontsource/font-files/blob/main/fonts/google/inter/LICENSE), [Cascadia license](https://github.com/microsoft/cascadia-code/blob/main/LICENSE), [Liberation license](https://github.com/liberationfonts/liberation-fonts/blob/main/LICENSE), [Excalifont license declaration](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/fonts/Excalifont/index.ts), [Virgil source](https://github.com/excalidraw/virgil). Fonts retain their own licenses when embedded in artwork.

## Dependency maintenance

Versions and transitive security overrides are locked in `package-lock.json`. Run `npm audit --omit=dev` before release; audit results reflect the registry at that time, not a guarantee of future security. Overrides for nanoid, lodash-es, Sass, Mermaid, Chevrotain and KaTeX resolve advisories inherited through the editor. The app disables website embedding and diagram generation; these transitive modules are not exposed as product controls. Re-run type checks, tests, build and the browser lab when changing the editor or overrides. No paid APIs, cloud SDK, analytics or runtime CDN script is required.
