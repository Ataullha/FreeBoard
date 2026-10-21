import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AppState,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import { attachPenInput } from '../src/editor/penInput';
vi.mock('@excalidraw/excalidraw', () => ({
  CaptureUpdateAction: { IMMEDIATELY: 'IMMEDIATELY' },
  getFreeDrawSvgPath: () => '',
}));
let stop = () => {};
beforeEach(() => {
  vi.stubGlobal('Path2D', class {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fill: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  vi.spyOn(window, 'cancelAnimationFrame').mockReturnValue();
});
afterEach(() => {
  stop();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup(viewModeEnabled = false) {
  const host = document.createElement('main'),
    target = document.createElement('canvas'),
    layer = document.createElement('canvas'),
    button = document.createElement('button');
  target.className = 'interactive';
  target.setPointerCapture = vi.fn();
  target.hasPointerCapture = () => false;
  host.append(target, layer, button);
  document.body.append(host);
  const state = {
    activeTool: { type: 'freedraw' },
    viewModeEnabled,
    offsetLeft: 0,
    offsetTop: 0,
    scrollX: 0,
    scrollY: 0,
    zoom: { value: 1 },
    currentItemStrokeColor: '#171717',
    currentItemStrokeWidth: 2,
    currentItemOpacity: 100,
  } as AppState;
  const updateScene = vi.fn(),
    start = vi.fn(),
    finish = vi.fn();
  const editor = {
    getAppState: () => state,
    getSceneElementsIncludingDeleted: () => [],
    updateScene,
  } as unknown as ExcalidrawImperativeAPI;
  stop = attachPenInput(host, layer, {
    editor: () => editor,
    highlighter: () => false,
    start,
    finish,
  });
  const event = (
    type: string,
    id: number,
    kind: string,
    on: HTMLElement = target,
  ) => {
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, {
      pointerId: id,
      pointerType: kind,
      clientX: id,
      clientY: id,
      pressure: 0.7,
      button: 0,
    });
    on.dispatchEvent(e);
    return e;
  };
  return { event, button, start, finish, updateScene };
}
describe('pen and palm routing', () => {
  it('blocks palm contact through its lift without cancelling a pen stroke', () => {
    const { event, start, finish, updateScene, button } = setup();
    expect(event('pointerdown', 1, 'pen').defaultPrevented).toBe(true);
    expect(event('pointerdown', 2, 'touch').defaultPrevented).toBe(true);
    event('pointermove', 1, 'pen');
    event('pointerup', 1, 'pen');
    expect(event('pointerup', 2, 'touch').defaultPrevented).toBe(true);
    expect(event('pointerdown', 3, 'touch', button).defaultPrevented).toBe(
      false,
    );
    expect(start).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledTimes(1);
    expect(updateScene.mock.calls[0][0].captureUpdate).toBe('IMMEDIATELY');
  });
  it('rejects a palm after pen hover but allows ordinary touch before pen proximity', () => {
    const { event } = setup();
    expect(event('pointerdown', 3, 'touch').defaultPrevented).toBe(false);
    event('pointermove', 1, 'pen');
    expect(event('pointerdown', 4, 'touch').defaultPrevented).toBe(true);
  });
  it('releases a native finger gesture admitted before pen proximity', () => {
    const { event, finish } = setup();
    expect(event('pointerdown', 2, 'touch').defaultPrevented).toBe(false);
    event('pointerdown', 1, 'pen');
    expect(event('pointerup', 2, 'touch').defaultPrevented).toBe(false);
    event('pointerup', 1, 'pen');
    expect(finish).toHaveBeenCalledTimes(1);
  });
  it('commits cancellation once and accepts the next pen stroke', () => {
    const { event, finish } = setup();
    event('pointerdown', 1, 'pen');
    event('pointercancel', 1, 'pen');
    event('pointerup', 1, 'pen');
    event('pointerdown', 2, 'pen');
    event('pointerup', 2, 'pen');
    expect(finish).toHaveBeenCalledTimes(2);
  });
  it('leaves read-only input and temporary spacebar panning to the editor', () => {
    let api = setup(true);
    expect(api.event('pointerdown', 1, 'pen').defaultPrevented).toBe(false);
    expect(api.start).not.toHaveBeenCalled();
    stop();
    document.body.replaceChildren();
    api = setup();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(api.event('pointerdown', 1, 'pen').defaultPrevented).toBe(false);
    expect(api.start).not.toHaveBeenCalled();
  });
});
