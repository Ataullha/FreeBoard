import {
  CaptureUpdateAction,
  getFreeDrawSvgPath,
} from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawFreeDrawElement } from '@excalidraw/excalidraw/element/types';
import { PenStroke } from './penStroke';

type Options = {
  editor: () => ExcalidrawImperativeAPI | null;
  highlighter: () => boolean;
  start: (element: ExcalidrawFreeDrawElement) => void;
  finish: (element: ExcalidrawFreeDrawElement) => void;
};
/** Pen-only fast path. Mouse, finger gestures, selection, shapes and eraser remain native. */
export function attachPenInput(
  host: HTMLElement,
  canvas: HTMLCanvasElement,
  options: Options,
) {
  const win = host.ownerDocument.defaultView!,
    doc = host.ownerDocument;
  if (import.meta.env.DEV) canvas.dataset.inkState = 'ready';
  const context = canvas.getContext('2d', { desynchronized: true });
  let stroke: PenStroke | null = null,
    pointer: number | null = null,
    target: HTMLElement | null = null;
  let frame = 0,
    clearFrame = 0,
    hoverUntil = 0,
    space = false;
  const palms = new Set<number>();
  const forwardedTouches = new Set<number>();
  const block = (e: Event) => {
    if (e.cancelable) e.preventDefault();
    e.stopImmediatePropagation();
  };
  const drawingTarget = (e: PointerEvent) =>
    e.target instanceof HTMLElement &&
    host.contains(e.target) &&
    e.target.matches('canvas.interactive');
  const paint = () => {
    frame = 0;
    if (!stroke || !context) return;
    const box = host.getBoundingClientRect(),
      ratio = win.devicePixelRatio || 1;
    const width = Math.round(box.width * ratio),
      height = Math.round(box.height * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, box.width, box.height);
    const a = stroke.view,
      z = a.zoom.value;
    context.translate(
      (stroke.element.x + a.scrollX) * z + a.offsetLeft - box.left,
      (stroke.element.y + a.scrollY) * z + a.offsetTop - box.top,
    );
    context.scale(z, z);
    context.globalAlpha = stroke.element.opacity / 100;
    context.fillStyle = stroke.element.strokeColor;
    context.fill(new Path2D(getFreeDrawSvgPath(stroke.element)));
    context.globalAlpha = 1;
  };
  const schedule = () => {
    if (!frame) frame = win.requestAnimationFrame(paint);
  };
  const finish = () => {
    if (!stroke) return;
    if (import.meta.env.DEV) {
      canvas.dataset.inkState = 'committed';
      canvas.dataset.inkSamples = String(stroke.points.length);
    }
    const completed = stroke.finish(),
      editor = options.editor();
    if (frame) win.cancelAnimationFrame(frame);
    paint(); // show the endpoint before the native scene's next paint
    stroke = null;
    const id = pointer;
    pointer = null;
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
    options.finish(completed);
    if (editor)
      editor.updateScene({
        elements: [...editor.getSceneElementsIncludingDeleted(), completed],
        appState: { selectedElementIds: {} },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    if (id !== null && target?.hasPointerCapture(id))
      target.releasePointerCapture(id);
    target = null;
    // Keep the preview until the native canvas has painted the committed element.
    clearFrame = win.requestAnimationFrame(() => {
      clearFrame = win.requestAnimationFrame(() => {
        clearFrame = 0;
        if (!stroke && context) {
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
      });
    });
  };
  const input = (e: PointerEvent) => {
    const onCanvas = drawingTarget(e);
    if (e.pointerType === 'touch') {
      // A touch admitted before pen proximity belongs to the native gesture.
      // Always deliver its release so a later pen cannot strand that gesture.
      if (
        (e.type === 'pointerup' || e.type === 'pointercancel') &&
        forwardedTouches.delete(e.pointerId)
      )
        return;
      if (
        palms.has(e.pointerId) ||
        ((stroke || performance.now() < hoverUntil) && onCanvas)
      ) {
        if (e.type === 'pointerdown') palms.add(e.pointerId);
        if (e.type === 'pointerup' || e.type === 'pointercancel')
          palms.delete(e.pointerId);
        block(e);
      } else if (e.type === 'pointerdown' && onCanvas)
        forwardedTouches.add(e.pointerId);
      return;
    }
    if (e.pointerType !== 'pen') return;
    if (
      onCanvas &&
      (e.type === 'pointermove' ||
        e.type === 'pointerover' ||
        e.type === 'pointerdown')
    )
      hoverUntil = performance.now() + 350;
    if (e.pointerId === pointer && stroke) {
      block(e);
      if (e.type === 'pointermove') {
        stroke.samples(e);
        schedule();
      }
      if (e.type === 'pointerup') {
        stroke.add({
          ...e,
          clientX: e.clientX,
          clientY: e.clientY,
          pressure: stroke.pressures.at(-1) ?? 0.5,
        });
        finish();
      }
      if (e.type === 'pointercancel' || e.type === 'lostpointercapture')
        finish();
      return;
    }
    const editor = options.editor(),
      a = editor?.getAppState();
    if (
      e.type !== 'pointerdown' ||
      !onCanvas ||
      !editor ||
      !a ||
      a.viewModeEnabled ||
      space ||
      a.activeTool.type !== 'freedraw' ||
      e.button !== 0
    )
      return;
    block(e);
    if (clearFrame) win.cancelAnimationFrame(clearFrame);
    clearFrame = 0;
    pointer = e.pointerId;
    target = e.target as HTMLElement;
    stroke = new PenStroke(e, a, options.highlighter());
    if (import.meta.env.DEV) canvas.dataset.inkState = 'drawing';
    options.start(stroke.element);
    target.focus({ preventScroll: true });
    // Capture keeps the stroke alive outside the canvas; synthetic tests cannot capture.
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* browser may already have cancelled contact */
    }
    paint();
  };
  const key = (e: KeyboardEvent) => {
    if (e.code === 'Space') space = e.type === 'keydown';
    if (stroke && e.key === 'Escape') finish();
  };
  const hidden = () => {
    if (doc.hidden) finish();
  };
  const blur = () => {
    space = false;
    palms.clear();
    forwardedTouches.clear();
    finish();
  };
  const events = [
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
    'pointerover',
    'lostpointercapture',
  ] as const;
  for (const event of events)
    win.addEventListener(event, input, { capture: true, passive: false });
  win.addEventListener('keydown', key, true);
  win.addEventListener('keyup', key, true);
  win.addEventListener('blur', blur);
  win.addEventListener('beforeunload', finish, true);
  doc.addEventListener('visibilitychange', hidden, true);
  return () => {
    for (const event of events) win.removeEventListener(event, input, true);
    win.removeEventListener('keydown', key, true);
    win.removeEventListener('keyup', key, true);
    win.removeEventListener('blur', blur);
    win.removeEventListener('beforeunload', finish, true);
    doc.removeEventListener('visibilitychange', hidden, true);
    if (frame) win.cancelAnimationFrame(frame);
    if (clearFrame) win.cancelAnimationFrame(clearFrame);
  };
}
