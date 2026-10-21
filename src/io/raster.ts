import { MAX_IMAGE_PIXELS } from '../model/document';
export function hasRasterSignature(bytes: string, mime: string): boolean {
  return mime === 'image/png'
    ? bytes.startsWith('\x89PNG\r\n\x1a\n')
    : mime === 'image/jpeg'
      ? bytes.startsWith('\xff\xd8\xff')
      : mime === 'image/webp' &&
        bytes.startsWith('RIFF') &&
        bytes.slice(8, 12) === 'WEBP';
}
/** Check declared dimensions before the browser allocates a decoded bitmap. */
export function rasterSize(
  bytes: string,
  mime: string,
): { width: number; height: number } {
  if (!hasRasterSignature(bytes, mime))
    throw new Error('Image contents do not match their format.');
  const n = (p: number) => bytes.charCodeAt(p),
    be16 = (p: number) => (n(p) << 8) | n(p + 1),
    be32 = (p: number) =>
      n(p) * 16777216 + n(p + 1) * 65536 + n(p + 2) * 256 + n(p + 3),
    le24 = (p: number) => n(p) + n(p + 1) * 256 + n(p + 2) * 65536;
  let width = 0,
    height = 0;
  if (
    mime === 'image/png' &&
    bytes.length >= 24 &&
    bytes.slice(12, 16) === 'IHDR'
  ) {
    width = be32(16);
    height = be32(20);
  }
  if (mime === 'image/jpeg') {
    let p = 2;
    while (p + 4 < bytes.length) {
      if (n(p) !== 255) {
        p++;
        continue;
      }
      const marker = n(p + 1);
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0xd8 || marker === 0x01 || marker === 0xff) {
        p += 2;
        continue;
      }
      const length = be16(p + 2);
      if (length < 2) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker) &&
        p + 9 < bytes.length
      ) {
        height = be16(p + 5);
        width = be16(p + 7);
        break;
      }
      p += 2 + length;
    }
  }
  if (mime === 'image/webp' && bytes.length >= 30) {
    const type = bytes.slice(12, 16);
    if (type === 'VP8X') {
      width = le24(24) + 1;
      height = le24(27) + 1;
    } else if (type === 'VP8 ' && bytes.slice(23, 26) === '\x9d\x01\x2a') {
      width = (n(26) | (n(27) << 8)) & 0x3fff;
      height = (n(28) | (n(29) << 8)) & 0x3fff;
    } else if (type === 'VP8L' && n(20) === 0x2f) {
      const bits = (n(21) | (n(22) << 8) | (n(23) << 16) | (n(24) << 24)) >>> 0;
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    }
  }
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    throw new Error('This image has an invalid or unsupported header.');
  if (width > 8192 || height > 8192 || width * height > MAX_IMAGE_PIXELS)
    throw new Error(
      'Use an image up to 20 megapixels and 8,192 pixels on each side.',
    );
  return { width, height };
}
