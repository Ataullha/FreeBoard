import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function walk(dir) {
  let all = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) all.push(...(await walk(p)));
    else all.push(p);
  }
  return all;
}
const paths = (await walk('dist')).filter((p) => !p.endsWith('/sw.js'));
const hash = createHash('sha256');
for (const p of paths.sort()) {
  hash.update(p);
  hash.update(await readFile(p));
}
const version = `freeboard-${hash.digest('hex').slice(0, 16)}`;
const urls = paths
  .filter((p) => !p.endsWith('_headers'))
  .map((p) => './' + p.slice(5));
const sw = (await readFile('scripts/sw-template.js', 'utf8'))
  .replace('__CACHE__', JSON.stringify(version))
  .replace('__ASSETS__', JSON.stringify(urls));
await writeFile('dist/sw.js', sw);
const sizes = await Promise.all(
  paths.map(async (p) => ({ path: p, bytes: (await stat(p)).size })),
);
if (paths.length > 1000)
  throw new Error('Build exceeds Cloudflare drag-and-drop file count.');
if (sizes.some((p) => p.bytes > 25 * 1024 * 1024))
  throw new Error('Build exceeds Cloudflare single-asset size limit.');
await writeFile(
  'dist/build-info.json',
  JSON.stringify(
    {
      version,
      files: sizes.length + 2,
      bytes: sizes.reduce((s, p) => s + p.bytes, 0),
    },
    null,
    2,
  ),
);
console.log(
  `Offline build: ${sizes.length + 2} files, ${(sizes.reduce((s, p) => s + p.bytes, 0) / 1024 / 1024).toFixed(2)} MiB, ${version}`,
);
