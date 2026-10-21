import type { AppState } from '@excalidraw/excalidraw/types';
import type { ExcalidrawFreeDrawElement } from '@excalidraw/excalidraw/element/types';
import { createId } from '../model/id';
import { toScene } from '../model/coordinates';

type Point = ExcalidrawFreeDrawElement['points'][number];
type Sample = Pick<PointerEvent, 'clientX' | 'clientY' | 'pressure'>;
/** Append-only input buffer. Scene traversal and React stay outside pointermove. */
export class PenStroke {
  readonly points: Point[] = [];
  readonly pressures: number[] = [];
  readonly element: ExcalidrawFreeDrawElement;
  private x: number;
  private y: number;
  constructor(
    sample: Sample,
    readonly view: AppState,
    highlighter = false,
  ) {
    const p = toScene({ x: sample.clientX, y: sample.clientY }, view);
    this.x = p.x;
    this.y = p.y;
    this.element = {
      type: 'freedraw',
      id: createId(),
      x: p.x,
      y: p.y,
      width: 0,
      height: 0,
      angle: 0 as ExcalidrawFreeDrawElement['angle'],
      strokeColor: view.currentItemStrokeColor,
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: view.currentItemStrokeWidth,
      strokeStyle: 'solid',
      roughness: 0,
      opacity: highlighter ? 30 : view.currentItemOpacity,
      roundness: null,
      seed: Math.floor(Math.random() * 2147483647),
      version: 1,
      versionNonce: Math.floor(Math.random() * 2147483647),
      index: null,
      isDeleted: false,
      groupIds: [],
      frameId: null,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      points: this.points,
      pressures: this.pressures,
      simulatePressure: false,
      lastCommittedPoint: null,
    };
    this.add(sample);
  }
  add(sample: Sample) {
    if (!Number.isFinite(sample.clientX) || !Number.isFinite(sample.clientY))
      return;
    const p = toScene({ x: sample.clientX, y: sample.clientY }, this.view);
    const x = p.x - this.x,
      y = p.y - this.y,
      last = this.points.at(-1);
    // Ignore duplicate coordinates without discarding small handwriting details.
    if (last && last[0] === x && last[1] === y) return;
    this.points.push([x, y] as Point);
    this.pressures.push(
      Number.isFinite(sample.pressure) && sample.pressure > 0
        ? Math.min(1, sample.pressure)
        : 0.5,
    );
  }
  samples(event: PointerEvent) {
    const samples = event.getCoalescedEvents?.() ?? [];
    for (const sample of samples) this.add(sample);
    this.add(event); // API may be absent, empty, or omit the dispatch endpoint.
  }
  finish(): ExcalidrawFreeDrawElement {
    // Excalidraw drops one-point paths on restore. A subpixel second point
    // preserves a tap/dot as an editable stroke across reload and import.
    if (this.points.length === 1) {
      this.points.push([0.0001, 0.0001] as Point);
      this.pressures.push(this.pressures[0]);
    }
    const xs = this.points.map((p) => p[0]),
      ys = this.points.map((p) => p[1]);
    // Use iteration for large strokes; spreading a point array can overflow the stack.
    let minX = 0,
      minY = 0,
      maxX = 0,
      maxY = 0;
    for (let i = 0; i < xs.length; i++) {
      minX = Math.min(minX, xs[i]);
      minY = Math.min(minY, ys[i]);
      maxX = Math.max(maxX, xs[i]);
      maxY = Math.max(maxY, ys[i]);
    }
    return {
      ...this.element,
      x: this.x + minX,
      y: this.y + minY,
      width: maxX - minX,
      height: maxY - minY,
      points: this.points.map((p) => [p[0] - minX, p[1] - minY] as Point),
      pressures: [...this.pressures],
      lastCommittedPoint: [
        this.points.at(-1)![0] - minX,
        this.points.at(-1)![1] - minY,
      ] as Point,
    };
  }
}
