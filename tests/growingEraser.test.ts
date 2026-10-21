import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  AppState,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { attachGrowingEraser } from '../src/editor/growingEraser';
import { rect } from './fixtures';
vi.mock('@excalidraw/excalidraw', () => ({
  CaptureUpdateAction: { IMMEDIATELY: 'IMMEDIATELY', NEVER: 'NEVER' },
  newElementWith: (e: object, u: object) => ({ ...e, ...u }),
}));
let stop = () => {};
afterEach(() => {
  stop();
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function setup(zoom = 1, readOnly = false) {
  vi.useFakeTimers();
  const host = document.createElement('main'),
    canvas = document.createElement('canvas'),
    cursor = document.createElement('div');
  canvas.className = 'interactive';
  canvas.setPointerCapture = () => {};
  canvas.hasPointerCapture = () => false;
  host.append(canvas, cursor);
  document.body.append(host);
  let elements: readonly ExcalidrawElement[] = [
    { ...rect('target', 345), y: 240, width: 30, height: 30 },
    { ...rect('locked', 290), y: 240, width: 20, height: 20, locked: true },
  ];
  const state = {
    activeTool: { type: 'eraser' },
    viewModeEnabled: readOnly,
    zoom: { value: zoom },
    offsetLeft: 0,
    offsetTop: 0,
    scrollX: 0,
    scrollY: 0,
    selectedElementIds: {},
    selectedGroupIds: {},
    editingGroupId: null,
  } as AppState;
  const start = vi.fn(),
    finish = vi.fn(),
    updateScene = vi.fn(
      (update: { elements?: readonly ExcalidrawElement[] }) => {
        if (update.elements) elements = update.elements;
      },
    );
  const api = {
    getAppState: () => state,
    getSceneElementsIncludingDeleted: () => elements,
    updateScene,
  } as unknown as ExcalidrawImperativeAPI;
  stop = attachGrowingEraser(host, cursor, {
    editor: () => api,
    start,
    finish,
  });
  const event = (type: string) => {
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, {
      pointerId: 71,
      pointerType: 'mouse',
      clientX: 300 * zoom,
      clientY: 250 * zoom,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
    });
    canvas.dispatchEvent(e);
    return e;
  };
  return {
    cursor,
    event,
    start,
    finish,
    updateScene,
    elements: () => elements,
  };
}
describe('growing mouse eraser lifecycle', () => {
  it('previews a held gesture and commits exactly one undoable deletion on release', () => {
    const a = setup();
    a.event('pointerdown');
    vi.advanceTimersByTime(1750);
    expect(Number(a.cursor.dataset.radius)).toBeGreaterThan(50);
    expect(a.elements().every((e) => !e.isDeleted)).toBe(true);
    a.event('pointerup');
    expect(a.elements()[0].isDeleted).toBe(true);
    expect(a.elements()[1].isDeleted).toBe(false);
    expect(
      a.updateScene.mock.calls.filter(
        ([u]) => 'captureUpdate' in u && u.captureUpdate === 'IMMEDIATELY',
      ),
    ).toHaveLength(1);
    expect(a.finish).toHaveBeenCalledTimes(1);
    expect(a.cursor.hidden).toBe(true);
  });
  it('cancels with Escape, clears growth timers and resets the next gesture', () => {
    const a = setup();
    a.event('pointerdown');
    vi.advanceTimersByTime(1750);
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(a.elements().every((e) => !e.isDeleted)).toBe(true);
    expect(a.cursor.hidden).toBe(true);
    a.event('pointerdown');
    expect(Number(a.cursor.dataset.radius)).toBe(9);
    a.event('pointerup');
    expect(a.elements().every((e) => !e.isDeleted)).toBe(true);
  });
  it('keeps the growing circle the same screen size at another zoom', () => {
    const a = setup(2);
    a.event('pointerdown');
    vi.advanceTimersByTime(2500);
    a.event('pointerup');
    expect(a.elements()[0].isDeleted).toBe(false);
  });
  it('does not intercept a read-only board', () => {
    const a = setup(1, true);
    expect(a.event('pointerdown').defaultPrevented).toBe(false);
    expect(a.start).not.toHaveBeenCalled();
  });
});
