# Contributing to FreeBoard

Contributions are welcome from students, teachers, creators and developers of every experience level. You can report a reproducible bug, improve documentation or translations, review a change, or submit a pull request.

## Start locally

Fork the repository and clone your fork. Use Node.js 24 LTS and npm:

```sh
npm ci
npm run dev
```

No account, API key or backend is required to run FreeBoard. The development script prepares locally bundled editor assets from the dependency lockfile. Do not commit generated vendor fonts, WebAssembly assets, `dist/`, `node_modules/` or local configuration. The production build includes the runtime assets and required notices.

## Report a problem

Search existing issues first. Describe the expected behavior, actual behavior, steps to reproduce, browser/version and device. A minimal board created specifically for the report is more useful than a private document. Never attach private boards, credentials, personal data or browser storage dumps.

For security-sensitive problems, follow [SECURITY.md](SECURITY.md). For feature proposals, explain the user problem and a focused solution before implementing a large change.

## Submit a change

1. Create a branch in your fork and make a focused change.
2. Update documentation when behavior changes. Add a regression test when fixing data handling or editor behavior.
3. Run the checks below and describe the results in your pull request.
4. Include a screenshot for visible interface changes and describe any remaining verification limits.

```sh
npm run format:check
npm run check
npm audit --omit=dev --audit-level=high
```

Use `npm run format` to format maintained source. Development-only `/qa.html` and `/journeys.html` exercise the native editor, complete app journeys and the deterministic 600-object performance scene. They create synthetic test data in your browser; use a separate browser profile when you want to keep test boards separate from personal work.

## Protect the core experience

- Preserve existing documents, image assets, undo behavior and legacy backup compatibility. The retained `boardpilot` storage namespace is intentional.
- Keep drawing and exports accurate after pan, zoom and object transforms. Test attached arrows when changing geometry.
- Check Bengali and English text, multiline editing and IME composition. Drawing shortcuts must not run while typing.
- Keep the guest experience functional without a server, paid API, API key or runtime CDN.
- Keep controls usable on narrow screens and respect keyboard focus and reduced motion.
- Preserve dependency and font attribution. Do not add a dependency without reviewing its license and runtime cost.

Pull requests are reviewed before merging. A public repository allows anyone to fork and propose changes; it does not grant direct write access. By submitting a contribution, you agree to provide it under the project's MIT license. Follow the [Code of Conduct](CODE_OF_CONDUCT.md) in issues, reviews and discussions.
