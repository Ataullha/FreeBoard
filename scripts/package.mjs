// Small dependency-free ZIP writer for this static distribution (no Zip64 required).
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';

await stat('dist/index.html').catch(() => {
  throw new Error('Run npm run build before packaging.');
});
await stat('docs/VERIFICATION.md').catch(() => {
  throw new Error('Include a verification report before packaging.');
});
const roots = ['src', 'tests', 'scripts', 'docs', 'public', 'dist', '.github'];
const files = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'index.html',
  'qa.html',
  'journeys.html',
  'inking.html',
  'README.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md',
  'LICENSE',
  'THIRD_PARTY_NOTICES.txt',
  '.gitignore',
  '.editorconfig',
  '.prettierignore',
  '.prettierrc.json',
  '.nvmrc',
];
async function walk(directory) {
  const result = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const path = `${directory}/${entry.name}`;
    if (entry.isSymbolicLink())
      throw new Error(`Refusing a symlink in the package: ${path}`);
    if (entry.isDirectory()) result.push(...(await walk(path)));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}
const table = Uint32Array.from({ length: 256 }, (_, i) => {
  let n = i;
  for (let j = 0; j < 8; j++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes) {
  let n = 0xffffffff;
  for (const b of bytes) n = table[(n ^ b) & 255] ^ (n >>> 8);
  return (n ^ 0xffffffff) >>> 0;
}
async function zip(paths, prefix, strip = '') {
  const parts = [],
    directory = [];
  let offset = 0;
  for (const path of paths.sort()) {
    const name = Buffer.from(prefix + path.slice(strip.length));
    const source = await readFile(path),
      compressed = deflateRawSync(source, { level: 9 });
    const header = Buffer.alloc(30),
      central = Buffer.alloc(46),
      checksum = crc32(source);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(33, 12);
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(source.length, 22);
    header.writeUInt16LE(name.length, 26);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(source.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    parts.push(header, name, compressed);
    directory.push(central, name);
    offset += header.length + name.length + compressed.length;
  }
  const end = Buffer.alloc(22),
    directoryBytes = directory.reduce((n, b) => n + b.length, 0);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(paths.length, 8);
  end.writeUInt16LE(paths.length, 10);
  end.writeUInt32LE(directoryBytes, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...directory, end]);
}
await mkdir('artifacts', { recursive: true });
for (const root of roots) files.push(...(await walk(root)));
const outputs = [
  ['FreeBoard-source.zip', await zip(files, 'freeboard/')],
  ['FreeBoard-dist.zip', await zip(await walk('dist'), '', 'dist/')],
];
const sums = [];
for (const [name, bytes] of outputs) {
  await writeFile(`artifacts/${name}`, bytes);
  sums.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}`);
  console.log(`${name}: ${(bytes.length / 1024 / 1024).toFixed(2)} MiB`);
}
await writeFile('artifacts/SHA256SUMS.txt', sums.join('\n') + '\n');
