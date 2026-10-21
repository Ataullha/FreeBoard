/* Development-only browser checks. Not an entry in the production build. */
import { createRoot } from 'react-dom/client';
import { useRef, useState, useCallback } from 'react';
import {
  CaptureUpdateAction,
  Excalidraw,
  MainMenu,
  convertToExcalidrawElements,
  newElementWith,
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import '@excalidraw/excalidraw/index.css';
import '../src/styles.css';
import { exportArtwork } from '../src/io/export';
import { readImage } from '../src/io/images';
import { parseBackup } from '../src/io/validation';
import {
  backupFor,
  canvasState,
  makeBoard,
  defaultCanvas,
} from '../src/model/document';
import { createId } from '../src/model/id';
import { toScene } from '../src/model/coordinates';
import { BoardRepository, ConflictError } from '../src/storage/repository';
import { Autosave } from '../src/storage/autosave';
window.EXCALIDRAW_ASSET_PATH = new URL('./excalidraw/', location.href).href;
const frame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
const rounded = (value: number) => Math.round(value * 100) / 100;
function Lab() {
  const editor = useRef<ExcalidrawImperativeAPI | null>(null),
    host = useRef<HTMLDivElement>(null),
    resultsRef = useRef<Record<string, unknown>>({});
  const [ready, setReady] = useState(false);
  const [results, setResults] = useState<string>(
      'Ready. Tests use a separate scene and a temporary database.',
    ),
    [running, setRunning] = useState(false),
    [previews, setPreviews] = useState<{ png: string; svg: string } | null>(
      null,
    ),
    [mobile, setMobile] = useState(false);
  const bind = useCallback((a: ExcalidrawImperativeAPI) => {
    editor.current = a;
    setReady(true);
    setResults('Ready. Tests use a separate scene and a temporary database.');
  }, []);
  const scene = () => ({
    elements: editor.current!.getSceneElementsIncludingDeleted(),
    appState: canvasState(editor.current!.getAppState()),
    files: editor.current!.getFiles(),
  });
  const active = () => editor.current!.getSceneElements();
  const canvas = () =>
    host.current!.querySelector<HTMLCanvasElement>('canvas.interactive') ??
    host.current!.querySelector<HTMLCanvasElement>('canvas:last-of-type')!;
  function key(
    key: string,
    code: string,
    ctrl = false,
    shift = false,
    target: HTMLElement = canvas(),
  ) {
    target.focus();
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        code,
        ctrlKey: ctrl,
        shiftKey: shift,
        bubbles: true,
        cancelable: true,
      }),
    );
    target.dispatchEvent(
      new KeyboardEvent('keyup', {
        key,
        code,
        ctrlKey: ctrl,
        shiftKey: shift,
        bubbles: true,
        cancelable: true,
      }),
    );
  }
  function event(
    type: string,
    x: number,
    y: number,
    pointerId = 1,
    pointerType = 'mouse',
    target: EventTarget = canvas(),
  ) {
    target.dispatchEvent(
      new PointerEvent(type, {
        pointerId,
        pointerType,
        isPrimary: pointerId === 1 || pointerId === 31,
        clientX: x,
        clientY: y,
        button: 0,
        buttons: type === 'pointerup' ? 0 : 1,
        pressure: type === 'pointerup' ? 0 : 0.5,
        bubbles: true,
        cancelable: true,
      }),
    );
  }
  async function drag(
    from: { x: number; y: number },
    to: { x: number; y: number },
    touch = false,
  ) {
    const c = canvas();
    const original = c.setPointerCapture;
    c.setPointerCapture = () => {};
    const a = editor.current!.getAppState(),
      p = sceneCoordsToViewportCoords({ sceneX: from.x, sceneY: from.y }, a),
      q = sceneCoordsToViewportCoords({ sceneX: to.x, sceneY: to.y }, a),
      type = touch ? 'touch' : 'mouse';
    event('pointerdown', p.x, p.y, 1, type);
    await frame();
    for (let i = 1; i <= 6; i++) {
      event(
        'pointermove',
        p.x + ((q.x - p.x) * i) / 6,
        p.y + ((q.y - p.y) * i) / 6,
        1,
        type,
        c,
      );
      await frame();
    }
    event('pointerup', q.x, q.y, 1, type, c);
    c.setPointerCapture = original;
    await frame();
  }
  function set(
    elements: readonly ExcalidrawElement[],
    selected: Record<string, true> = {},
  ) {
    editor.current!.updateScene({
      elements,
      appState: { selectedElementIds: selected },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }
  async function run() {
    setRunning(true);
    const passed: string[] = [];
    setResults('Running editor checks…');
    async function test(name: string, work: () => void | Promise<void>) {
      try {
        await work();
        passed.push(`PASS  ${name}`);
      } catch (e) {
        passed.push(
          `FAIL  ${name}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      setResults(passed.join('\n'));
    }
    const e = editor.current!;
    e.resetScene();
    await frame();
    const shape = convertToExcalidrawElements(
      [
        {
          type: 'rectangle',
          id: 'history-shape',
          x: 300,
          y: 200,
          width: 160,
          height: 100,
          roughness: 0,
          backgroundColor: '#e1eadd',
          fillStyle: 'solid',
        },
      ],
      { regenerateIds: false },
    );
    await test('Native coordinate conversion agrees after pan and zoom', () => {
      for (const zoom of [0.1, 0.5, 2, 30]) {
        const v = {
          ...e.getAppState(),
          zoom: { value: zoom as never },
          scrollX: -315,
          scrollY: 172,
        };
        const p = { x: 430, y: 230 },
          a = toScene(p, v),
          b = viewportCoordsToSceneCoords({ clientX: p.x, clientY: p.y }, v);
        assert(
          Math.abs(a.x - b.x) < 1e-7 && Math.abs(a.y - b.y) < 1e-7,
          'Coordinate mismatch',
        );
      }
    });
    await test('Insert → undo → redo is one native history action', async () => {
      set(shape);
      await frame();
      key('z', 'KeyZ', true);
      await frame();
      assert(active().length === 0, 'Undo did not remove inserted shape');
      key('z', 'KeyZ', true, true);
      await frame();
      assert(active().length === 1, 'Redo did not restore shape');
    });
    await test('Move, resize, rotation, style, and deletion undo/redo', async () => {
      const original = active()[0];
      set(
        active().map((el) =>
          newElementWith(el, {
            x: el.x + 80,
            width: 230,
            height: 130,
            angle: 0.4 as never,
            strokeColor: '#1971c2',
          }),
        ),
      );
      await frame();
      key('z', 'KeyZ', true);
      await frame();
      assert(
        active()[0].x === original.x &&
          active()[0].width === original.width &&
          active()[0].angle === original.angle,
        'Transform undo mismatch',
      );
      key('z', 'KeyZ', true, true);
      await frame();
      assert(
        active()[0].width === 230 && active()[0].angle === 0.4,
        'Transform redo mismatch',
      );
      e.updateScene({
        appState: { selectedElementIds: { [active()[0].id]: true } },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      await frame();
      key('Delete', 'Delete');
      await frame();
      assert(active().length === 0, 'Delete failed');
      key('z', 'KeyZ', true);
      await frame();
      assert(active().length === 1, 'Deletion undo failed');
    });
    await test('Group and ungroup with native keyboard commands', async () => {
      const pair = convertToExcalidrawElements(
        [
          {
            type: 'rectangle',
            id: 'group-a',
            x: 300,
            y: 150,
            width: 100,
            height: 80,
          },
          {
            type: 'ellipse',
            id: 'group-b',
            x: 500,
            y: 150,
            width: 100,
            height: 80,
          },
        ],
        { regenerateIds: false },
      );
      set(pair, { 'group-a': true, 'group-b': true });
      await frame();
      key('g', 'KeyG', true);
      await frame();
      assert(
        active().every((el) => el.groupIds.length === 1),
        'Group failed',
      );
      key('g', 'KeyG', true, true);
      await frame();
      assert(
        active().every((el) => el.groupIds.length === 0),
        'Ungroup failed',
      );
      key('z', 'KeyZ', true);
      await frame();
      assert(
        active().every((el) => el.groupIds.length === 1),
        'Ungroup undo failed',
      );
    });
    await test('Attached connectors follow actual pointer dragging and resizing', async () => {
      const pair = convertToExcalidrawElements(
        [
          {
            type: 'rectangle',
            id: 'source',
            x: 300,
            y: 200,
            width: 150,
            height: 100,
            backgroundColor: '#e1eadd',
            fillStyle: 'solid',
            roughness: 0,
          },
          {
            type: 'rectangle',
            id: 'target',
            x: 650,
            y: 200,
            width: 150,
            height: 100,
            backgroundColor: '#f3e5ba',
            fillStyle: 'solid',
            roughness: 0,
          },
          {
            type: 'arrow',
            id: 'connector',
            x: 455,
            y: 250,
            width: 190,
            height: 0,
            points: [
              [0, 0],
              [190, 0],
            ],
            start: { id: 'source' },
            end: { id: 'target' },
            roughness: 0,
          },
        ],
        { regenerateIds: false },
      );
      set(pair);
      e.setActiveTool({ type: 'selection' });
      await frame();
      const endpoint = (el: ExcalidrawElement) =>
        JSON.stringify({
          x: el.x,
          y: el.y,
          points: 'points' in el ? el.points : [],
        });
      const before = endpoint(active().find((el) => el.id === 'connector')!);
      await drag({ x: 370, y: 250 }, { x: 410, y: 300 });
      const source = active().find((el) => el.id === 'source')!,
        arrow = active().find((el) => el.id === 'connector')!;
      assert(source.x > 320, 'Pointer drag did not move source');
      assert(
        arrow.type === 'arrow' &&
          arrow.startBinding?.elementId === 'source' &&
          arrow.endBinding?.elementId === 'target',
        'Binding was lost',
      );
      assert(endpoint(arrow) !== before, 'Connector endpoint did not move');
      const oldWidth = source.width;
      await drag(
        { x: source.x + source.width + 4, y: source.y + source.height + 4 },
        { x: source.x + source.width + 74, y: source.y + source.height + 44 },
      );
      const resized = active().find((el) => el.id === 'source')!,
        attached = active().find((el) => el.id === 'connector')!;
      assert(resized.width > oldWidth, 'Resize handle did not resize source');
      assert(
        attached.type === 'arrow' &&
          attached.startBinding?.elementId === 'source',
        'Resize detached connector',
      );
    });
    await test('Touch pointer drawing and hand navigation', async () => {
      e.resetScene();
      e.setActiveTool({ type: 'freedraw' });
      await frame();
      await drag({ x: 320, y: 190 }, { x: 450, y: 270 }, true);
      assert(
        active().some((el) => el.type === 'freedraw' && el.points.length > 2),
        'Touch stroke missing points',
      );
      e.setActiveTool({ type: 'hand' });
      await frame();
      const before = e.getAppState().scrollX;
      await drag({ x: 350, y: 220 }, { x: 410, y: 240 }, true);
      assert(e.getAppState().scrollX !== before, 'Touch pan did not move view');
    });
    await test('Two touch pointers pinch around their center', async () => {
      e.setActiveTool({ type: 'selection' });
      const a = e.getAppState(),
        cx = a.offsetLeft + a.width * 0.6,
        cy = a.offsetTop + a.height * 0.4,
        z = a.zoom.value;
      const c = canvas(),
        original = c.setPointerCapture;
      c.setPointerCapture = () => {};
      event('pointerdown', cx - 50, cy, 31, 'touch');
      event('pointerdown', cx + 50, cy, 32, 'touch');
      await frame();
      event('pointermove', cx - 90, cy, 31, 'touch', c);
      event('pointermove', cx + 90, cy, 32, 'touch', c);
      await frame();
      event('pointerup', cx - 90, cy, 31, 'touch', c);
      event('pointerup', cx + 90, cy, 32, 'touch', c);
      c.setPointerCapture = original;
      await frame();
      assert(e.getAppState().zoom.value > z, 'Pinch did not increase zoom');
    });
    await test('Bengali/English text and images survive editable backup and PNG/SVG export', async () => {
      e.resetScene();
      e.updateScene({
        appState: { ...defaultCanvas(), currentItemFontFamily: 2 },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      const tile = document.createElement('canvas');
      tile.width = 100;
      tile.height = 70;
      const ctx = tile.getContext('2d')!;
      ctx.fillStyle = '#2d5545';
      ctx.fillRect(0, 0, 100, 70);
      ctx.fillStyle = '#f8e8b5';
      ctx.fillRect(20, 15, 60, 40);
      const blob = await new Promise<Blob>((resolve) =>
          tile.toBlob((b) => resolve(b!), 'image/png'),
        ),
        image = await readImage(
          new File([blob], 'sample.png', { type: 'image/png' }),
        );
      e.addFiles([image.file]);
      const content = convertToExcalidrawElements(
        [
          {
            type: 'text',
            id: 'bn',
            text: 'আমি বাংলায় লিখি।\nI teach in English.',
            x: 260,
            y: 160,
            fontFamily: 2,
            fontSize: 28,
            strokeColor: '#263d35',
          },
          {
            type: 'image',
            id: 'image',
            x: 260,
            y: 280,
            width: 200,
            height: 140,
            fileId: image.file.id,
            status: 'saved',
          },
        ],
        { regenerateIds: false },
      );
      set(content);
      await frame();
      const s = scene(),
        roundTrip = parseBackup(
          JSON.stringify(backupFor(makeBoard('বাংলা / English'), s)),
        );
      assert(
        roundTrip.elements.length === 2 &&
          Object.keys(roundTrip.files).length === 1,
        'Round trip lost content',
      );
      assert(
        roundTrip.elements.some(
          (el) => el.type === 'text' && el.text.includes('বাংলায়'),
        ),
        'Bengali text lost',
      );
      const png = await exportArtwork(s, 'png', false),
        svg = await exportArtwork(s, 'svg', false);
      assert(png.size > 1000 && svg.size > 1000, 'Empty export');
      const svgText = await svg.text();
      assert(
        svgText.includes('বাংলায়') &&
          svgText.includes('FreeBoard Bengali') &&
          svgText.includes('data:image/png'),
        'SVG missing text/fonts/image',
      );
      const pngURL = URL.createObjectURL(png),
        svgURL = URL.createObjectURL(svg),
        img = new Image();
      img.src = pngURL;
      await img.decode();
      assert(
        img.naturalWidth > 100 && img.naturalHeight > 100,
        'PNG dimensions wrong',
      );
      const check = document.createElement('canvas');
      check.width = img.width;
      check.height = img.height;
      check.getContext('2d')!.drawImage(img, 0, 0);
      assert(
        check.getContext('2d')!.getImageData(0, 0, 1, 1).data[3] === 0,
        'Transparent background not transparent',
      );
      const vector = new Image();
      vector.src = svgURL;
      await vector.decode();
      assert(vector.naturalWidth > 0, 'SVG does not decode');
      setPreviews({ png: pngURL, svg: svgURL });
    });
    await test('Real IndexedDB draft recovery, conflict handling, trash, and restore', async () => {
      const repo = new BoardRepository(`freeboard-lab-${createId()}`);
      try {
        const s = scene(),
          b = await repo.create(makeBoard('Lab', s), s.files);
        await repo.checkpoint(b, s, 'interrupted');
        assert((await repo.load(b.id)).recovered, 'Draft not recovered');
        const saved = await repo.save(b, s, 'live');
        let conflict = false;
        try {
          await repo.save(b, s, 'stale');
        } catch (err) {
          conflict = err instanceof ConflictError;
        }
        assert(conflict, 'Stale write accepted');
        const copy = await repo.duplicate(saved.id);
        await repo.trash(copy);
        const trashed = (await repo.load(copy.id)).board;
        assert(trashed.deletedAt, 'Trash failed');
        await repo.trash(trashed, true);
        assert(!(await repo.load(copy.id)).board.deletedAt, 'Restore failed');
      } finally {
        await repo.close();
      }
    });
    await test('Storage failure keeps edits dirty and never claims Saved', async () => {
      const repo = new BoardRepository(),
        states: string[] = [];
      repo.save = async () => {
        throw new DOMException('Full', 'QuotaExceededError');
      };
      const autosave = new Autosave(
        repo,
        { ...makeBoard('Quota test'), revision: 1 },
        'lab',
        (s) => states.push(s),
      );
      autosave.capture(scene());
      await autosave.flush();
      assert(
        states.at(-1) === 'error' &&
          !states.includes('saved') &&
          autosave.dirty,
        'False saved state',
      );
      await autosave.dispose();
    });
    await test('Editing continues with fetch disabled after assets are loaded', async () => {
      const original = window.fetch;
      let attempts = 0;
      window.fetch = async () => {
        attempts++;
        throw new TypeError('Simulated offline');
      };
      try {
        e.resetScene();
        e.updateScene({
          appState: { ...defaultCanvas() },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        e.setActiveTool({ type: 'freedraw' });
        await frame();
        await drag({ x: 320, y: 190 }, { x: 450, y: 270 });
        assert(
          active().some((el) => el.type === 'freedraw' && el.points.length > 2),
          'Drawing failed with network unavailable: ' +
            JSON.stringify({
              types: active().map((el) => el.type),
              tool: e.getAppState().activeTool,
              zoom: e.getAppState().zoom,
              scrollX: e.getAppState().scrollX,
              scrollY: e.getAppState().scrollY,
            }),
        );
        assert(attempts === 0, 'Core drawing tried a network request');
      } finally {
        window.fetch = original;
      }
    });
    resultsRef.current = {
      kind: 'browser-editor-checks',
      time: new Date().toISOString(),
      userAgent: navigator.userAgent,
      results: passed,
    };
    setResults(JSON.stringify(resultsRef.current, null, 2));
    setRunning(false);
  }
  async function benchmark() {
    setRunning(true);
    setResults('Building the deterministic performance scene…');
    try {
      const e = editor.current!;
      e.resetScene();
      e.updateScene({
        appState: { ...defaultCanvas() },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      const tile = document.createElement('canvas');
      tile.width = 48;
      tile.height = 32;
      const c = tile.getContext('2d')!;
      c.fillStyle = '#2d5545';
      c.fillRect(0, 0, 48, 32);
      c.fillStyle = '#f8e8b5';
      c.fillRect(9, 6, 30, 20);
      const blob = await new Promise<Blob>((resolve) =>
          tile.toBlob((b) => resolve(b!), 'image/png'),
        ),
        asset = await readImage(
          new File([blob], 'performance.png', { type: 'image/png' }),
        );
      e.addFiles([asset.file]);
      const specs: ExcalidrawElementSkeleton[] = [];
      for (let i = 0; i < 600; i++) {
        const x = (i % 30) * 170 + 40,
          y = Math.floor(i / 30) * 110 + 40,
          id = `perf-${i}`,
          base = {
            id,
            x,
            y,
            seed: i + 1,
            roughness: 0,
            strokeColor: '#2d5545',
            strokeWidth: 2,
          };
        switch (i % 6) {
          case 0:
            specs.push({
              ...base,
              type: 'rectangle',
              width: 135,
              height: 80,
              fillStyle: 'solid',
              backgroundColor: '#e2eade',
            });
            break;
          case 1:
            specs.push({
              ...base,
              type: 'ellipse',
              width: 100,
              height: 70,
              backgroundColor: '#f1e6d4',
              fillStyle: 'solid',
            });
            break;
          case 2:
            specs.push({
              ...base,
              type: 'text',
              fontFamily: 2,
              fontSize: 18,
              text:
                i % 12 === 2
                  ? 'বাংলায় ভাবি\nIdea ' + i
                  : 'A little idea\nNumber ' + i,
            });
            break;
          case 3:
            specs.push({
              ...base,
              type: 'arrow',
              width: 110,
              height: 30,
              points: [
                [0, 0],
                [110, 30],
              ],
            });
            break;
          case 4:
            specs.push({
              ...base,
              type: 'image',
              fileId: asset.file.id,
              width: 120,
              height: 80,
              status: 'saved',
            });
            break;
          case 5:
            specs.push({
              ...base,
              type: 'freedraw',
              width: 130,
              height: 60,
              points: Array.from({ length: 28 }, (_, k) => [
                k * 4.8,
                30 + Math.sin(k * 0.45) * 25,
              ]),
              pressures: [],
              simulatePressure: true,
              opacity: i % 12 === 5 ? 30 : 100,
              strokeWidth: i % 12 === 5 ? 12 : 2,
            } as unknown as ExcalidrawElementSkeleton);
        }
      }
      const elements = convertToExcalidrawElements(specs, {
          regenerateIds: false,
        }),
        start = performance.now();
      set(elements);
      await frame();
      const insertion = performance.now() - start;
      const frameTimes: number[] = [],
        callTimes: number[] = [],
        idleFrames: number[] = [];
      const longTasks: { start: number; duration: number }[] = [];
      const observer = PerformanceObserver.supportedEntryTypes.includes(
        'longtask',
      )
        ? new PerformanceObserver((list) => {
            for (const entry of list.getEntries())
              longTasks.push({
                start: entry.startTime,
                duration: entry.duration,
              });
          })
        : null;
      observer?.observe({ entryTypes: ['longtask'] });
      for (let i = 0; i < 10; i++) {
        const t = performance.now();
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        idleFrames.push(performance.now() - t);
      }
      const panStart = performance.now();
      for (let i = 0; i < 60; i++) {
        const t = performance.now();
        e.updateScene({
          appState: { scrollX: -i * 4, scrollY: -i * 2 },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        callTimes.push(performance.now() - t);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        frameTimes.push(performance.now() - t);
      }
      const panEnd = performance.now();
      e.setActiveTool({ type: 'selection' });
      const dragStart = performance.now();
      await drag({ x: 90, y: 80 }, { x: 150, y: 100 });
      const dragTime = performance.now() - dragStart;
      const s = scene(),
        t1 = performance.now(),
        png = await exportArtwork(s, 'png', true),
        pngMs = performance.now() - t1,
        t2 = performance.now(),
        svg = await exportArtwork(s, 'svg', false),
        svgMs = performance.now() - t2;
      frameTimes.sort((a, b) => a - b);
      callTimes.sort((a, b) => a - b);
      idleFrames.sort((a, b) => a - b);
      // A small control scene separates object-count cost from remote presentation timing.
      const controlFrames: number[] = [];
      e.resetScene();
      await frame();
      e.addFiles(Object.values(s.files));
      set(s.elements.slice(0, 6));
      await frame();
      for (let i = 0; i < 10; i++) {
        const t = performance.now();
        e.updateScene({
          appState: { scrollX: -i * 4, scrollY: -i * 2 },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        controlFrames.push(performance.now() - t);
      }
      controlFrames.sort((a, b) => a - b);
      e.resetScene();
      await frame();
      e.addFiles(Object.values(s.files));
      set(s.elements);
      e.updateScene({
        appState: s.appState,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      await frame();
      observer?.disconnect();
      const panTasks = longTasks.filter(
        (t) => t.start >= panStart && t.start <= panEnd,
      );
      resultsRef.current = {
        kind: 'performance',
        time: new Date().toISOString(),
        userAgent: navigator.userAgent,
        viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
        scene: {
          objects: active().length,
          mix: '100 rectangles, 100 ellipses, 100 mixed-language text, 100 arrows, 100 raster images, 100 freehand/highlighter strokes',
          strokePoints: 2800,
        },
        metrics: {
          insertToSecondAnimationFrameMs: rounded(insertion),
          idleAnimationFrameMedianMs: rounded(idleFrames[5]),
          sixObjectPanToFrameMedianMs: rounded(controlFrames[5]),
          panLongTaskCount: observer ? panTasks.length : null,
          panLongestTaskMs: observer
            ? rounded(Math.max(0, ...panTasks.map((t) => t.duration)))
            : null,
          panUpdateEnqueueMedianMs: rounded(callTimes[30]),
          panUpdateEnqueueP95Ms: rounded(callTimes[57]),
          panUpdateToNextFrameMedianMs: rounded(frameTimes[30]),
          panUpdateToNextFrameP95Ms: rounded(frameTimes[57]),
          sixStepPointerDragMs: rounded(dragTime),
          pngExportMs: rounded(pngMs),
          pngBytes: png.size,
          svgExportMs: rounded(svgMs),
          svgBytes: svg.size,
        },
        notes:
          'Development build in a remote Chromium browser. Frame scheduling includes browser/host load; these are not FPS or input-latency claims.',
      };
      setResults(JSON.stringify(resultsRef.current, null, 2));
    } catch (err) {
      setResults(
        `Benchmark failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setRunning(false);
    }
  }
  return (
    <div
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        background: '#f9faf7',
      }}
    >
      <header
        style={{
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: '1px solid #dfe7da',
          flexWrap: 'wrap',
        }}
      >
        <strong>FreeBoard verification lab</strong>
        <button
          className="button secondary small"
          disabled={running || !ready}
          onClick={() => void run()}
        >
          Run editor checks
        </button>
        <button
          className="button secondary small"
          disabled={running || !ready}
          onClick={() => void benchmark()}
        >
          Run 600-object benchmark
        </button>
        <button
          className="button secondary small"
          onClick={() => setMobile(!mobile)}
        >
          Toggle mobile preview
        </button>
        <button
          className="button secondary small"
          onClick={() => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(
              new Blob([JSON.stringify(resultsRef.current, null, 2)], {
                type: 'application/json',
              }),
            );
            a.download = 'freeboard-verification.json';
            a.click();
          }}
        >
          Download results
        </button>
      </header>
      <div
        style={{ display: 'flex', flex: 1, minHeight: 0, gap: 12, padding: 12 }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          <div
            ref={host}
            style={{
              height: 470,
              minHeight: 470,
              border: '1px solid #dfe7da',
              position: 'relative',
            }}
          >
            <Excalidraw
              excalidrawAPI={bind}
              initialData={{
                appState: {
                  ...defaultCanvas(),
                  currentItemFontFamily: 2,
                  currentItemRoughness: 0,
                },
              }}
              handleKeyboardGlobally={true}
              aiEnabled={false}
              UIOptions={{
                canvasActions: {
                  loadScene: false,
                  export: false,
                  saveAsImage: false,
                },
              }}
            >
              <MainMenu />
            </Excalidraw>
          </div>
          <pre
            aria-label="Verification results"
            style={{
              font: '11px/1.6 monospace',
              whiteSpace: 'pre-wrap',
              padding: 12,
              background: '#fff',
              border: '1px solid #dfe7da',
            }}
          >
            {results}
          </pre>
          {previews && (
            <div style={{ display: 'flex', gap: 10 }}>
              <figure>
                <figcaption>PNG export</figcaption>
                <img
                  src={previews.png}
                  alt="Exported Bengali/English text and raster image"
                  style={{ maxHeight: 250, maxWidth: 400 }}
                />
              </figure>
              <figure>
                <figcaption>SVG export</figcaption>
                <img
                  src={previews.svg}
                  alt="Vector export with embedded fonts and image"
                  style={{ maxHeight: 250, maxWidth: 400 }}
                />
              </figure>
            </div>
          )}
        </div>
        {mobile && (
          <iframe
            title="Mobile FreeBoard preview"
            src="/"
            style={{
              width: 390,
              height: 740,
              minWidth: 390,
              border: '1px solid #dfe7da',
              borderRadius: 12,
            }}
          />
        )}
      </div>
    </div>
  );
}
createRoot(document.getElementById('qa-root')!).render(<Lab />);
