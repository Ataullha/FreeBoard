# Static deployment

FreeBoard is a static app. The supplied `dist/` directory needs no backend, database, environment secrets or build-time API keys. Hosting does not store or synchronize users' boards; each visitor uses local browser storage.

## Live GitHub Pages deployment

- Application: <https://ataullha.github.io/FreeBoard/>
- Source: <https://github.com/Ataullha/FreeBoard>
- Portfolio and deployment workflow: <https://github.com/Ataullha/ataullha.github.io>

The portfolio repository's `.github/workflows/pages.yml` checks out both repositories, installs the locked app dependencies, runs formatting/type/tests/build/audit, copies `dist/` into `/FreeBoard/`, and deploys the combined site through GitHub Pages Actions. The Classroom resources link remains intact, with a separate FreeBoard icon beside it.

For an app-source-only update, first let FreeBoard CI pass, then open the portfolio repository → Actions → **Publish portfolio and FreeBoard** → **Run workflow**. Use `main` or a reviewed commit in `freeboard_ref`. A portfolio `main` push also publishes. The app repository's own CI retains a build artifact and does not deploy by itself. In the portfolio repository's Settings → Pages, the source must be **GitHub Actions**. The workflow uses scoped, short-lived Actions permissions; no private key belongs in frontend code.

FreeBoard is deployed only at `/FreeBoard/`. The earlier `/FreePod/` deployment and compatibility redirect have been removed. The portfolio workflow excludes the old directory and asserts that it is absent from the site artifact. The portfolio icon and repository homepage use the FreeBoard address. Saved boards remain in the same origin's IndexedDB; deleting the old deployment does not clear browser storage. The canonical app also unregisters only the exact obsolete service-worker scope, without clearing documents or caches. Use `/FreeBoard/` for future visits and installed shortcuts.

For your own GitHub Pages site, copy the same static build to your selected path or adapt the workflow's repository/path names. The build uses relative asset URLs and the manifest uses relative scope/start URLs, supporting root or subdirectory hosting. GitHub Pages does not interpret Cloudflare's `_headers` file; use a host with configurable headers if response-header CSP is required.

GitHub Pages' [official limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), checked 21 October 2026, include a 1 GB published-site limit and a soft 100 GB/month bandwidth limit; custom Actions publishing is exempt from the soft 10 builds/hour limit. Account Actions quotas and [GitHub's terms](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) still apply. Static hosting does not provide authentication, backend storage, or collaboration.

## Cloudflare Pages direct upload

1. Use the supplied `FreeBoard-dist.zip`, or run `npm ci`, `npm run build` and `npm run package` to recreate it.
2. Sign in to your own Cloudflare account. Open Workers & Pages and create a Pages application using the Direct Upload / drag-and-drop path.
3. Choose a project name. Upload `FreeBoard-dist.zip` or the contents of `dist/`. The upload root must contain `index.html`, not an enclosing `freeboard/` directory. Include `_headers`, `manifest.webmanifest`, `sw.js`, icons, fonts and all assets.
4. Deploy and open the assigned HTTPS `pages.dev` address. No bindings or environment values are needed.
5. Confirm drawing, saving, backup import/export and Available offline. Keep this same origin when publishing updates so existing local boards remain accessible.

Cloudflare's Direct Upload project type cannot later be converted to Git integration; create a separate Git-integrated project if you choose that workflow later. A different project URL is a different browser-storage origin. Export/import boards to move them.

CLI alternative, using your own account:

```sh
npx wrangler login
npx wrangler pages deploy dist --project-name freeboard
```

Wrangler uploads a folder, not the source ZIP. The project name is your choice. No deployment credentials belong in frontend code.

## GitHub integration

Create your own repository from the source directory and commit its source, lockfile, tests, `public/`, scripts and docs. `node_modules/`, `dist/` and `artifacts/` are ignored and are regenerated. CI runs on pull requests and pushes, then retains the production build as an artifact; it does not auto-publish.

In Cloudflare Pages, connect your repository and choose:

| Setting                | Value                                                     |
| ---------------------- | --------------------------------------------------------- |
| Framework preset       | Vite (or None with the settings below)                    |
| Build command          | `npm run build`                                           |
| Build output directory | `dist`                                                    |
| Root directory         | Repository root containing `package.json`                 |
| Node version           | `24` via `NODE_VERSION` if the build environment needs it |
| Production branch      | Your chosen default branch                                |

Use `npm ci` for reproducible installs. No `.env` file is required. Add your own custom domain only after checking deployment and exporting any boards you need to move from the old origin.

## Free plan and terms, checked 21 October 2026

The current [official Pages limits](https://developers.cloudflare.com/pages/platform/limits/) specify 500 builds/month, one concurrent build, a 20-minute build timeout, 20,000 files/site on Free, and a 25 MiB single-asset maximum. The [Direct Upload guide](https://developers.cloudflare.com/pages/get-started/direct-upload/) limits dashboard uploads to 1,000 files; Wrangler supports 20,000. The build script checks the stricter dashboard count and per-file size.

The [Cloudflare self-serve agreement](https://www.cloudflare.com/terms/) applies, including acceptable-use rules; free-service availability can change or end. This is a deployment path using the currently documented free static tier, not a promise of permanent free hosting. Optional Workers, R2, databases, email or future collaboration services have separate quotas and terms. None is required by this app. A custom domain may have a separate registration cost.

## Offline and update acceptance

Serve over HTTPS (localhost is also trustworthy). `npm run preview` serves the actual production worker; `npm run dev` intentionally does not. Wait for Available offline, close/reopen once online, then test network-offline reload. Create and save a board, insert an image, export and reopen a backup. Restore a trashed board. Open the same board in a second tab and confirm view/copy behavior.

Publish a second build while the first is open. A refresh discovers the waiting worker; use Save & restart when offered. Verify the saved board remains. Do not force `skipWaiting` automatically or clear IndexedDB during deployments. Rolling back app assets should use a compatible document version; future-version documents are intentionally not downgraded.

`public/_headers` provides CSP, MIME sniffing and referrer protections and avoids caching `sw.js`/`index.html` indefinitely. Other static hosts must apply equivalent headers. Disable any host-injected analytics or scripts unless you intentionally update the CSP and privacy policy. The relative Vite base and manifest scope support root or subdirectory deployment. Keep all build files together beneath the chosen path; verify the manifest, worker scope and relative font/image URLs there.

Before announcing a public launch, complete the physical-device, Safari/Firefox, HTTPS offline-install and service-worker update checks listed in `VERIFICATION.md`. These need environments not available in this build session.
