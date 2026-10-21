import { describe, expect, it } from 'vitest';
import type { AppState } from '@excalidraw/excalidraw/types';
import { PenStroke } from '../src/editor/penStroke';
const view = {
  offsetLeft: 20,
  offsetTop: 40,
  scrollX: -50,
  scrollY: 70,
  zoom: { value: 2 },
  currentItemStrokeColor: '#171717',
  currentItemStrokeWidth: 2,
  currentItemOpacity: 100,
} as AppState;
const sample = (x: number, y: number, p = 0.5) => ({
  clientX: x,
  clientY: y,
  pressure: p,
});
describe('stylus sample buffer', () => {
  it('keeps coalesced samples, pressure and dispatch endpoint in order', () => {
    const s = new PenStroke(sample(120, 240, 0.2), view);
    s.samples({
      ...sample(140, 260, 0.8),
      getCoalescedEvents: () => [sample(125, 245, 0.3), sample(130, 250, 0.6)],
    } as unknown as PointerEvent);
    expect(s.points).toEqual([
      [0, 0],
      [2.5, 2.5],
      [5, 5],
      [10, 10],
    ]);
    expect(s.pressures).toEqual([0.2, 0.3, 0.6, 0.8]);
  });
  it('falls back when coalescing is absent or returns no samples', () => {
    const s = new PenStroke(sample(120, 240, 0), view);
    s.samples(sample(121, 241, 0) as PointerEvent);
    s.samples({
      ...sample(122, 242, 0.5),
      getCoalescedEvents: () => [],
    } as unknown as PointerEvent);
    expect(s.points).toHaveLength(3);
    expect(s.pressures).toEqual([0.5, 0.5, 0.5]);
  });
  it('normalizes negative bounds at a non-default zoom without moving the ink', () => {
    const s = new PenStroke(sample(120, 240, 0.2), view);
    s.add(sample(80, 200, 0.7));
    const e = s.finish();
    expect([e.x, e.y, e.width, e.height]).toEqual([80, 10, 20, 20]);
    expect(e.points).toEqual([
      [20, 20],
      [0, 0],
    ]);
    expect(e.lastCommittedPoint).toEqual([0, 0]);
    expect(s.points).toEqual([
      [0, 0],
      [-20, -20],
    ]); // finishing does not mutate the preview
  });
  it('keeps dots and highlighter opacity without multiplying alpha per sample', () => {
    const s = new PenStroke(sample(120, 240, 0.6), view, true);
    s.add(sample(120, 240, 0.9));
    expect(s.finish().points).toHaveLength(2);
    expect(s.finish().opacity).toBe(30);
  });
  it('finishes a long stroke without spreading a huge array into a function', () => {
    const s = new PenStroke(sample(0, 0), view);
    for (let i = 1; i < 100001; i++) s.add(sample(i, i % 20));
    const e = s.finish();
    expect(e.points).toHaveLength(100001);
    expect(e.width).toBe(50000);
  });
});
