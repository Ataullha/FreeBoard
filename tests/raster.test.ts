import { describe, it, expect } from 'vitest';
import { rasterSize } from '../src/io/raster';
function png(w: number, h: number) {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([73, 72, 68, 82], 12);
  new DataView(bytes.buffer).setUint32(16, w);
  new DataView(bytes.buffer).setUint32(20, h);
  return String.fromCharCode(...bytes);
}
describe('image bounds before decoding', () => {
  it('reads valid PNG dimensions', () =>
    expect(rasterSize(png(640, 480), 'image/png')).toEqual({
      width: 640,
      height: 480,
    }));
  it('rejects oversized or zero-size compressed images before decoding', () => {
    expect(() => rasterSize(png(50000, 50000), 'image/png')).toThrow(
      /megapixels/,
    );
    expect(() => rasterSize(png(0, 0), 'image/png')).toThrow(/invalid/);
  });
  it('rejects truncated or disguised images', () => {
    expect(() => rasterSize('RIFFfakeWEBP', 'image/webp')).toThrow();
    expect(() => rasterSize('<svg/>', 'image/png')).toThrow();
  });
});
