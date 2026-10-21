import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('public/excalidraw', { recursive: true });
await cp(
  'node_modules/@excalidraw/excalidraw/dist/prod/fonts',
  'public/excalidraw/fonts',
  { recursive: true },
);
// The SVG exporter subsets optional editor fonts using this local WASM file.
const prod = 'node_modules/@excalidraw/excalidraw/dist/prod';
for (const file of await readdir(prod))
  if (file.endsWith('.wasm')) await cp(`${prod}/${file}`, `public/${file}`);
// Preserve complete installed license texts for production dependencies and bundled fonts.
const lock = JSON.parse(await readFile('package-lock.json', 'utf8')),
  notices = [];
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path || entry.dev) continue;
  const name = path.split('node_modules/').at(-1);
  let files = [];
  try {
    files = (await readdir(path)).filter((n) =>
      /^(license|licence|copying|ofl)(\.|$|-)/i.test(n),
    );
  } catch {}
  const texts = [];
  for (const file of files) {
    try {
      texts.push(
        `--- ${file} ---\n${await readFile(`${path}/${file}`, 'utf8')}`,
      );
    } catch {}
  }
  notices.push(
    `${name}@${entry.version}\nLicense: ${entry.license ?? 'See package'}\n${texts.join('\n')}`,
  );
}
for (const file of [
  'docs/BUNDLED_FONT_NOTICES.txt',
  ...(await readdir('docs/licenses')).map((file) => `docs/licenses/${file}`),
]) {
  notices.push(`${file}\n\n${await readFile(file, 'utf8')}`);
}
await writeFile(
  'THIRD_PARTY_NOTICES.txt',
  notices.join('\n\n========================================\n\n'),
);
await cp('THIRD_PARTY_NOTICES.txt', 'public/THIRD_PARTY_NOTICES.txt');
