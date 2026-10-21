import { CaptureUpdateAction } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { toScene } from '../model/coordinates';
import type { Point } from '../model/coordinates';
import { deleteObjects } from './boardEditing';
import { eraserHit, eraserRadius, ERASER_BASE_RADIUS } from './eraserGeometry';
/** Mouse object eraser: a bounded screen-space radius grows during each hold. */
export function attachGrowingEraser(
  host: HTMLElement,
  cursor: HTMLDivElement,
  options: {
    editor: () => ExcalidrawImperativeAPI | null;
    start: () => void;
    finish: () => void;
  },
) {
  const win = host.ownerDocument.defaultView!,
    doc = host.ownerDocument;
  let pointer: number | null = null,
    target: HTMLCanvasElement | null = null,
    started = 0,
    timer: ReturnType<typeof setInterval> | undefined,
    frame = 0,
    space = false;
  let last: Point = { x: 0, y: 0 },
    current: Point = last,
    buffer: Point[] = [],
    elements: readonly ExcalidrawElement[] = [],
    view: ReturnType<ExcalidrawImperativeAPI['getAppState']> | null = null;
  const pending = new Set<string>();
  const block = (e: Event) => {
    if (e.cancelable) e.preventDefault();
    e.stopImmediatePropagation();
  };
  const onCanvas = (e: PointerEvent) =>
    e.target instanceof HTMLCanvasElement &&
    e.target.matches('canvas.interactive') &&
    host.contains(e.target);
  const show = (p: Point, radius: number) => {
    const box = host.getBoundingClientRect();
    cursor.hidden = false;
    cursor.style.width = `${radius * 2}px`;
    cursor.style.height = `${radius * 2}px`;
    cursor.style.transform = `translate3d(${p.x - box.left - radius}px,${p.y - box.top - radius}px,0)`;
    cursor.dataset.radius = String(Math.round(radius));
    cursor.dataset.count = String(pending.size);
  };
  const process = () => {
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
    if (pointer === null || !view) return;
    const radius = eraserRadius(performance.now() - started),
      points = buffer.length ? buffer : [current];
    buffer = [];
    let changed = false;
    for (const p of points) {
      const a = toScene(last, view),
        b = toScene(p, view);
      for (const e of elements)
        if (
          !pending.has(e.id) &&
          eraserHit(e, a, b, radius / view.zoom.value)
        ) {
          pending.add(e.id);
          changed = true;
        }
      last = p;
    }
    if (changed) {
      const candidates = deleteObjects(elements, pending);
      const highlight = candidates
        .filter((e, i) => e.isDeleted && !elements[i].isDeleted)
        .map((e) => elements.find((o) => o.id === e.id)!);
      options.editor()?.updateScene({
        appState: { elementsToHighlight: highlight },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }
    show(current, radius);
  };
  const finish = (cancel = false) => {
    if (pointer === null) return;
    process();
    const editor = options.editor(),
      id = pointer;
    pointer = null;
    clearInterval(timer);
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
    const currentElements =
      editor?.getSceneElementsIncludingDeleted() ?? elements;
    const next = cancel
        ? currentElements
        : deleteObjects(currentElements, pending),
      changed = next.some((e, i) => e !== currentElements[i]);
    const state = editor?.getAppState();
    editor?.updateScene({
      ...(changed ? { elements: next } : {}),
      appState: {
        elementsToHighlight: null,
        selectedElementIds: changed ? {} : (state?.selectedElementIds ?? {}),
        selectedGroupIds: changed ? {} : (state?.selectedGroupIds ?? {}),
        editingGroupId: changed ? null : (state?.editingGroupId ?? null),
      },
      captureUpdate: changed
        ? CaptureUpdateAction.IMMEDIATELY
        : CaptureUpdateAction.NEVER,
    });
    options.finish();
    pending.clear();
    buffer = [];
    view = null;
    cursor.hidden = true;
    if (target?.hasPointerCapture(id)) target.releasePointerCapture(id);
    target?.removeAttribute('data-mouse-eraser');
    target = null;
  };
  const input = (e: PointerEvent) => {
    if (e.pointerId === pointer) {
      block(e);
      current = { x: e.clientX, y: e.clientY };
      if (e.type === 'pointermove') {
        for (const sample of e.getCoalescedEvents?.() ?? [])
          buffer.push({ x: sample.clientX, y: sample.clientY });
        buffer.push(current);
        if (!frame) frame = win.requestAnimationFrame(process);
      }
      if (
        e.type === 'pointerup' ||
        e.type === 'pointercancel' ||
        e.type === 'lostpointercapture'
      ) {
        buffer.push(current);
        finish();
      }
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const editor = options.editor(),
      a = editor?.getAppState();
    if (
      !onCanvas(e) ||
      !editor ||
      !a ||
      a.viewModeEnabled ||
      a.activeTool.type !== 'eraser' ||
      space
    ) {
      if (pointer === null) {
        cursor.hidden = true;
        target?.removeAttribute('data-mouse-eraser');
      }
      return;
    }
    if (e.type === 'pointermove') {
      target = e.target as HTMLCanvasElement;
      target.dataset.mouseEraser = 'true';
      show({ x: e.clientX, y: e.clientY }, ERASER_BASE_RADIUS);
    }
    if (e.type !== 'pointerdown' || e.button !== 0 || e.altKey) return;
    block(e);
    pointer = e.pointerId;
    target = e.target as HTMLCanvasElement;
    target.dataset.mouseEraser = 'true';
    started = performance.now();
    last = current = { x: e.clientX, y: e.clientY };
    buffer = [current];
    elements = editor.getSceneElementsIncludingDeleted();
    view = a;
    pending.clear();
    options.start();
    try {
      target.setPointerCapture(pointer);
    } catch {
      /* synthetic events cannot capture */
    }
    process();
    timer = setInterval(process, 64);
  };
  const key = (e: KeyboardEvent) => {
    if (e.code === 'Space') space = e.type === 'keydown';
    if (pointer !== null && e.key === 'Escape') {
      block(e);
      finish(true);
    }
  };
  const leave = () => {
    if (pointer === null) {
      cursor.hidden = true;
      target?.removeAttribute('data-mouse-eraser');
    }
  };
  host.addEventListener('pointerleave', leave);
  const leaving = () => finish();
  const hidden = () => {
    if (doc.hidden) finish();
  };
  const blur = () => {
    space = false;
    finish();
    cursor.hidden = true;
  };
  const events = [
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
    'lostpointercapture',
  ] as const;
  for (const event of events)
    win.addEventListener(event, input, { capture: true, passive: false });
  win.addEventListener('keydown', key, true);
  win.addEventListener('keyup', key, true);
  win.addEventListener('blur', blur);
  win.addEventListener('beforeunload', leaving, true);
  doc.addEventListener('visibilitychange', hidden, true);
  return () => {
    for (const event of events) win.removeEventListener(event, input, true);
    host.removeEventListener('pointerleave', leave);
    win.removeEventListener('keydown', key, true);
    win.removeEventListener('keyup', key, true);
    win.removeEventListener('blur', blur);
    win.removeEventListener('beforeunload', leaving, true);
    doc.removeEventListener('visibilitychange', hidden, true);
    clearInterval(timer);
    if (frame) win.cancelAnimationFrame(frame);
    target?.removeAttribute('data-mouse-eraser');
    cursor.hidden = true;
  };
}
