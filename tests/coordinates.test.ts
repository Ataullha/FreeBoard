import { describe, it, expect } from 'vitest';
import { toScene, toViewport, zoomAt } from '../src/model/coordinates';
describe('canvas transformations', () => {
  it('round trips offset, pan, and zoom across a deterministic range', () => {
    for (const z of [0.1, 0.25, 1, 2, 30])
      for (const scroll of [-1200, 0, 875])
        for (const x of [-450, 0, 372.25]) {
          const view = {
            scrollX: scroll,
            scrollY: scroll / 2,
            zoom: { value: z },
            offsetLeft: 14,
            offsetTop: 76,
          };
          const result = toScene(toViewport({ x, y: x / 2 }, view), view);
          expect(result.x).toBeCloseTo(x, 8);
          expect(result.y).toBeCloseTo(x / 2, 8);
        }
  });
  it('keeps the pointer anchor stationary when zoom changes', () => {
    const v = {
        scrollX: -100,
        scrollY: 150,
        zoom: { value: 0.7 },
        offsetLeft: 15,
        offsetTop: 70,
      },
      pointer = { x: 567, y: 321 };
    for (const z of [0.1, 0.5, 1, 6, 30]) {
      const actual = toScene(pointer, zoomAt(pointer, z, v)),
        expected = toScene(pointer, v);
      expect(actual.x).toBeCloseTo(expected.x, 8);
      expect(actual.y).toBeCloseTo(expected.y, 8);
    }
  });
  it('clamps unsafe zoom values', () => {
    const v = {
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 },
      offsetLeft: 0,
      offsetTop: 0,
    };
    expect(zoomAt({ x: 0, y: 0 }, 0, v).zoom.value).toBe(0.1);
    expect(zoomAt({ x: 0, y: 0 }, 999, v).zoom.value).toBe(30);
  });
});
