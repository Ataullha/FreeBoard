import { describe, expect, it, vi } from 'vitest';
vi.mock('@excalidraw/excalidraw', () => ({
  newElementWith: (e: object, update: object) => ({ ...e, ...update }),
}));
import { deleteObjects } from '../src/editor/boardEditing';
import { eraserHit, eraserRadius } from '../src/editor/eraserGeometry';
import { rect, text } from './fixtures';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
const p = (x: number, y: number) => ({ x, y });
describe('growing object eraser geometry', () => {
  it('grows only after a short hold and resets for the next gesture', () => {
    expect(eraserRadius(0)).toBe(9);
    expect(eraserRadius(399)).toBe(9);
    expect(eraserRadius(1400)).toBe(44);
    expect(eraserRadius(100000)).toBe(64);
    expect(eraserRadius(0)).toBe(9);
  });
  it('hits a filled object, skips hollow interior, and sweeps across a fast move', () => {
    const e = rect();
    expect(eraserHit(e, p(80, 60), p(80, 60), 2)).toBe(true);
    expect(
      eraserHit(
        { ...e, backgroundColor: 'transparent' },
        p(80, 60),
        p(80, 60),
        2,
      ),
    ).toBe(false);
    expect(
      eraserHit(
        { ...e, backgroundColor: 'transparent' },
        p(-40, 60),
        p(200, 60),
        2,
      ),
    ).toBe(true);
  });
  it('uses the circular radius instead of deleting objects in its bounding square', () => {
    const e = { ...rect(), x: 10, y: 10, width: 20, height: 20 };
    expect(eraserHit(e, p(0, 0), p(0, 0), 10)).toBe(false);
    expect(eraserHit(e, p(0, 0), p(0, 0), 15)).toBe(true);
  });
  it('respects rotated bounds and locks', () => {
    const e = {
      ...rect(),
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      angle: Math.PI / 2,
    } as ExcalidrawElement;
    expect(eraserHit(e, p(50, 50), p(50, 50), 2)).toBe(true);
    expect(eraserHit(e, p(0, 0), p(0, 0), 2)).toBe(false);
    expect(eraserHit({ ...e, locked: true }, p(50, 50), p(50, 50), 64)).toBe(
      false,
    );
  });
  it('handles ellipse corners and hollow centers', () => {
    const e = {
      ...rect(),
      type: 'ellipse',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    } as ExcalidrawElement;
    expect(eraserHit(e, p(0, 0), p(0, 0), 2)).toBe(false);
    expect(eraserHit(e, p(50, 50), p(50, 50), 2)).toBe(true);
    expect(
      eraserHit(
        { ...e, backgroundColor: 'transparent' },
        p(50, 50),
        p(50, 50),
        2,
      ),
    ).toBe(false);
  });
  it('hits negative freehand coordinates and leftward lines accurately', () => {
    const e = {
      ...rect(),
      type: 'freedraw',
      x: 100,
      y: 100,
      width: 80,
      height: 10,
      points: [
        [0, 0],
        [-80, -10],
      ],
      pressures: [0.5, 0.5],
      simulatePressure: false,
      lastCommittedPoint: null,
    } as ExcalidrawElement;
    expect(eraserHit(e, p(40, 92.5), p(40, 92.5), 1)).toBe(true);
    expect(eraserHit(e, p(160, 90), p(160, 90), 1)).toBe(false);
  });
});
describe('board deletion transactions', () => {
  it('keeps tombstones for undo and clears locked objects only for Clear board', () => {
    const e = { ...rect(), locked: true };
    expect(deleteObjects([e], new Set([e.id]))[0]).toBe(e);
    const removed = deleteObjects([e], new Set([e.id]), false)[0];
    expect(removed.isDeleted).toBe(true);
    expect(e.isDeleted).toBe(false);
    expect(removed.id).toBe(e.id);
  });
  it('erases bound notes and group members together, while retaining locked neighbors', () => {
    const shape = {
      ...rect('note'),
      groupIds: ['g'],
      boundElements: [{ id: 'label', type: 'text' as const }],
    };
    const label = {
      ...text(),
      id: 'label',
      containerId: 'note',
      groupIds: ['g'],
    };
    const peer = { ...rect('peer'), groupIds: ['g'] };
    const locked = { ...rect('locked'), locked: true };
    const result = deleteObjects(
      [shape, label, peer, locked],
      new Set(['note', 'locked']),
    );
    expect(result.map((e) => e.isDeleted)).toEqual([true, true, true, false]);
  });
  it('expands a label hit through its container to the whole group', () => {
    const shape = {
      ...rect('container'),
      groupIds: ['group'],
      boundElements: [{ id: 'label', type: 'text' as const }],
    };
    const label = {
      ...text(),
      id: 'label',
      containerId: 'container',
      groupIds: [],
    };
    const peer = { ...rect('peer'), groupIds: ['group'] };
    expect(
      deleteObjects([shape, label, peer], new Set(['label'])).every(
        (e) => e.isDeleted,
      ),
    ).toBe(true);
  });
  it('detaches surviving arrows without changing their points', () => {
    const e = {
      ...rect('arrow'),
      type: 'arrow',
      points: [
        [0, 0],
        [200, 0],
      ],
      startBinding: { elementId: 'shape', focus: 0, gap: 0 },
      endBinding: null,
      startArrowhead: null,
      endArrowhead: 'arrow',
      elbowed: false,
    } as ExcalidrawElement;
    const result = deleteObjects([rect(), e], new Set(['shape']));
    expect(result[1]).toMatchObject({
      startBinding: null,
      points: [
        [0, 0],
        [200, 0],
      ],
    });
    expect(e).toMatchObject({ startBinding: { elementId: 'shape' } });
  });
});
