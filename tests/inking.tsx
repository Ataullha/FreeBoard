/* Development-only synthetic pen/palm checks against the real product iframe. */
import { createRoot } from 'react-dom/client';
import { useRef, useState } from 'react';
import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import { backupFor, defaultCanvas, makeBoard } from '../src/model/document';
import { parseBackup } from '../src/io/validation';
const wait = (ms = 40) => new Promise<void>((r) => setTimeout(r, ms));
async function until<T>(read: () => T | undefined | null | false): Promise<T> {
  for (let i = 0; i < 200; i++) {
    const v = read();
    if (v) return v;
    await wait();
  }
  throw Error('UI timeout');
}
function Lab() {
  const ref = useRef<HTMLIFrameElement>(null);
  const [result, setResult] = useState(
    'Ready. Creates a separate QA board; existing boards are preserved.',
  );
  const [running, setRunning] = useState(false);
  async function run() {
    setRunning(true);
    let d = ref.current!.contentDocument!;
    const w = ref.current!.contentWindow as Window & typeof globalThis;
    const log: Record<string, unknown> = {
      browser: w.navigator.userAgent,
      kind: 'Synthetic DOM dispatch, not hardware latency',
      visibility: d.visibilityState,
    };
    const click = async (name: string) => {
      (
        await until(() =>
          [...d.querySelectorAll('button')].find(
            (b) =>
              !b.disabled &&
              (b.getAttribute('aria-label') === name ||
                b.textContent?.trim() === name),
          ),
        )
      ).click();
      await wait(90);
    };
    const exportedBlob = async (format: 'json' | 'png' | 'svg' = 'json') => {
      await click('Export');
      if (format !== 'json')
        await click(
          format === 'png'
            ? 'PNG imageA crisp image for slides and messages'
            : 'SVG artworkScalable vector · embedded fonts',
        );
      await click('Prepare file');
      const a = await until(() =>
        d.querySelector<HTMLAnchorElement>('a[download]'),
      );
      const blob = await (await w.fetch(a.href)).blob();
      await click('Close dialog');
      return blob;
    };
    const exported = async () =>
      parseBackup(await (await exportedBlob()).text());
    try {
      await until(() => d.querySelector('#board-title:not(:disabled)'));
      const elements = convertToExcalidrawElements(
        Array.from({ length: 600 }, (_, i) =>
          i % 3 === 2
            ? {
                type: 'text' as const,
                x: (i % 30) * 60,
                y: Math.floor(i / 30) * 50,
                text: `Idea ${i}`,
                fontSize: 14,
                fontFamily: 2,
              }
            : {
                type: i % 3 ? ('ellipse' as const) : ('rectangle' as const),
                x: (i % 30) * 60,
                y: Math.floor(i / 30) * 50,
                width: 45,
                height: 32,
                roughness: 0,
              },
        ),
      );
      const testTitle = `Pen QA ${Date.now()}`;
      const transfer = new w.DataTransfer();
      transfer.items.add(
        new w.File(
          [
            JSON.stringify(
              backupFor(makeBoard(testTitle), {
                elements,
                appState: defaultCanvas(),
                files: {},
              }),
            ),
          ],
          'pen.freeboard.json',
          { type: 'application/json' },
        ),
      );
      d.querySelector('main')!.dispatchEvent(
        new w.DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      );
      await until(
        () =>
          d.querySelector<HTMLInputElement>('#board-title')?.value ===
            testTitle && d.querySelector('.save-state.saved'),
      );
      await click('Reset view');
      await click('Pen (P)');
      const c = await until(() =>
        d.querySelector<HTMLCanvasElement>('canvas.interactive'),
      );
      c.setPointerCapture = () => {};
      c.releasePointerCapture = () => {};
      const box = c.getBoundingClientRect();
      const x = box.left + 380,
        y = box.top + 260;
      const durations: number[] = [];
      let writes = 0;
      const put = w.IDBObjectStore.prototype.put;
      w.IDBObjectStore.prototype.put = function (
        ...args: Parameters<IDBObjectStore['put']>
      ) {
        writes++;
        return put.apply(this, args);
      };
      const event = (
        type: string,
        id: number,
        kind: string,
        px: number,
        py: number,
        coalesced = false,
      ) => {
        const e = new w.PointerEvent(type, {
          pointerId: id,
          pointerType: kind,
          isPrimary: kind === 'pen',
          button: 0,
          buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
          pressure: type === 'pointerup' ? 0 : 0.65,
          clientX: px,
          clientY: py,
          bubbles: true,
          cancelable: true,
        });
        if (coalesced)
          Object.defineProperty(e, 'getCoalescedEvents', {
            value: () =>
              Array.from(
                { length: 4 },
                (_, i) =>
                  new w.PointerEvent(type, {
                    pointerId: id,
                    pointerType: kind,
                    pressure: 0.2 + i * 0.2,
                    clientX: px - 3 + i,
                    clientY: py + i * 0.25,
                  }),
              ),
          });
        const activeCanvas =
          d.querySelector<HTMLCanvasElement>('canvas.interactive')!;
        activeCanvas.setPointerCapture = () => {};
        activeCanvas.releasePointerCapture = () => {};
        const start = performance.now();
        activeCanvas.dispatchEvent(e);
        durations.push(performance.now() - start);
      };
      event('pointerdown', 71, 'pen', x, y);
      await wait(30);
      event('pointermove', 71, 'pen', x + 8, y + 3);
      await wait(25);
      event('pointerdown', 72, 'touch', x + 100, y + 100);
      await wait(25);
      event('pointermove', 71, 'pen', x + 22, y + 12);
      await wait(25);
      event('pointerup', 71, 'pen', x + 30, y + 15);
      event('pointerup', 72, 'touch', x + 100, y + 100);
      await wait(100);
      const palm = await exported();
      log.canvasConnected = c.isConnected;
      log.inkLayer =
        d.querySelector<HTMLCanvasElement>('.pen-ink-layer')?.dataset;
      log.initialObjectCount = palm.elements.length;
      log.palmStroke = palm.elements
        .filter((e) => e.type === 'freedraw' && !e.isDeleted)
        .map((e) => ({ points: e.type === 'freedraw' ? e.points.length : 0 }));
      await click('Pen (P)');
      writes = 0;
      durations.length = 0;
      const raf: number[] = [];
      let last = w.performance.now(),
        watch = true;
      const tick = (t: number) => {
        if (!watch) return;
        raf.push(t - last);
        last = t;
        w.requestAnimationFrame(tick);
      };
      w.requestAnimationFrame(tick);
      const started = performance.now();
      for (let j = 0; j < 24; j++) {
        event(
          'pointerdown',
          100 + j,
          'pen',
          x + (j % 8) * 45,
          y + Math.floor(j / 8) * 45,
        );
        await wait(16);
        for (let i = 1; i <= 8; i++) {
          event(
            'pointermove',
            100 + j,
            'pen',
            x + (j % 8) * 45 + i * 3,
            y + Math.floor(j / 8) * 45 + Math.sin(i) * 6,
            true,
          );
          await wait(8);
        }
        event(
          'pointerup',
          100 + j,
          'pen',
          x + (j % 8) * 45 + 27,
          y + Math.floor(j / 8) * 45,
        );
        await wait(20);
      }
      watch = false;
      const duringWrites = writes;
      await until(() => d.querySelector('.save-state.saved'));
      w.IDBObjectStore.prototype.put = put;
      const sorted = durations.sort((a, b) => a - b),
        frames = raf.sort((a, b) => a - b);
      log.performance = {
        sceneObjects: 600,
        strokes: 24,
        elapsedMs: Math.round(performance.now() - started),
        dispatchMedianMs: sorted[Math.floor(sorted.length * 0.5)],
        dispatchP95Ms: sorted[Math.floor(sorted.length * 0.95)],
        frameMedianMs: frames[Math.floor(frames.length * 0.5)],
        frameP95Ms: frames[Math.floor(frames.length * 0.95)],
        storePutsDuringWriting: duringWrites,
      };
      const backup = await exported(),
        ink = backup.elements.filter(
          (e) => e.type === 'freedraw' && !e.isDeleted,
        );
      log.penStrokes = ink.length;
      const lastStroke = ink.at(-1);
      log.lastStroke = lastStroke;
      if (
        ink.length !== 25 ||
        lastStroke?.type !== 'freedraw' ||
        lastStroke.points.length !== 42
      )
        throw Error('Pen sample or palm regression');
      await click('Undo');
      const undone = await exported();
      log.undoCount = undone.elements.filter(
        (e) => e.type === 'freedraw' && !e.isDeleted,
      ).length;
      await click('Redo');
      const redone = await exported();
      log.redoCount = redone.elements.filter(
        (e) => e.type === 'freedraw' && !e.isDeleted,
      ).length;
      if (log.undoCount !== 24 || log.redoCount !== 25)
        throw Error('Stroke history regression');
      await click('Pen (P)');
      event('pointerdown', 900, 'pen', x, y + 180);
      event('pointermove', 900, 'pen', x + 30, y + 180);
      event('pointercancel', 900, 'pen', x + 30, y + 180);
      await wait(400);
      event('pointerdown', 901, 'pen', x + 40, y + 180);
      event('pointerup', 901, 'pen', x + 40, y + 180);
      await wait(400);
      event('pointerdown', 902, 'touch', x + 60, y + 180);
      await wait(30);
      event('pointermove', 902, 'touch', x + 90, y + 180);
      await wait(1100);
      event('pointerup', 902, 'touch', x + 95, y + 180);
      await until(() => d.querySelector('.save-state.saved'));
      const extra = await exported();
      log.cancelDotTouchCount = extra.elements.filter(
        (e) => e.type === 'freedraw' && !e.isDeleted,
      ).length;
      if (log.cancelDotTouchCount !== 28)
        throw Error('Cancel/dot/finger fallback regression');
      const exports: Record<string, unknown> = {};
      for (const format of ['png', 'svg'] as const) {
        const started = performance.now(),
          blob = await exportedBlob(format);
        exports[format] = {
          bytes: blob.size,
          uiElapsedMs: Math.round(performance.now() - started),
        };
        if (blob.size < 1000) throw Error('Empty artwork export');
      }
      log.exports = exports;
      const title = d.querySelector<HTMLInputElement>('#board-title')!.value;
      await until(() => d.querySelector('.save-state.saved'));
      ref.current!.contentWindow!.location.reload();
      await until(
        () =>
          ref.current!.contentDocument !== d &&
          ref.current!.contentDocument?.querySelector<HTMLInputElement>(
            '#board-title',
          )?.value === title &&
          ref.current!.contentDocument.querySelector('.save-state.saved'),
      );
      d = ref.current!.contentDocument!;
      const recovered = await exported();
      log.reloadedStrokeCount = recovered.elements.filter(
        (e) => e.type === 'freedraw' && !e.isDeleted,
      ).length;
      if (log.reloadedStrokeCount !== 28) throw Error('Reload lost ink');
      log.reload = 'saved board and pressure samples reopened';
    } catch (e) {
      log.error = String(e);
    }
    setResult(JSON.stringify(log, null, 2));
    setRunning(false);
  }
  return (
    <>
      <div style={{ fontFamily: 'system-ui', padding: 12, background: '#eee' }}>
        <button disabled={running} onClick={() => void run()}>
          {running ? 'Running pen checks…' : 'Run pen regression'}
        </button>
        <pre
          aria-label="Pen test results"
          style={{ maxHeight: 240, overflow: 'auto' }}
        >
          {result}
        </pre>
      </div>
      <iframe
        title="Real FreeBoard pen test"
        ref={ref}
        src="/"
        style={{ width: 1100, height: 750, border: 0 }}
      />
    </>
  );
}
createRoot(document.getElementById('ink-root')!).render(<Lab />);
