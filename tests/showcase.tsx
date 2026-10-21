/* Development-only browser acceptance against the real, memory-only preview. */
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { parseBackup } from '../src/io/validation';
import { BoardRepository } from '../src/storage/repository';
type FrameWindow = Window & typeof globalThis;
const pause = (ms = 90) => new Promise<void>((r) => setTimeout(r, ms));
function assert(v: unknown, message: string): asserts v {
  if (!v) throw Error(message);
}
async function until<T>(
  read: () => T | undefined | null | false,
  message = 'UI timeout',
): Promise<T> {
  const start = performance.now();
  while (performance.now() - start < 20000) {
    const value = read();
    if (value) return value;
    await pause();
  }
  throw Error(message);
}
function Lab() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [results, setResults] = useState(
    'Ready. Uses a memory-only preview; no saved boards are changed.',
  );
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  async function run() {
    setRunning(true);
    const d = frame.current!.contentDocument!,
      w = frame.current!.contentWindow as FrameWindow;
    const lines: string[] = [],
      metrics: Record<string, unknown> = { browser: w.navigator.userAgent };
    let failed = false;
    const repo = new BoardRepository();
    const snapshot = async () =>
      JSON.stringify(
        await Promise.all(
          (await repo.list()).map((b) => repo.load(b.id, false)),
        ),
      );
    const before = await snapshot();
    const click = async (name: string, root: ParentNode = d) => {
      const button = await until(
        () =>
          [...root.querySelectorAll<HTMLButtonElement>('button')].find(
            (b) =>
              (b.getAttribute('aria-label') === name ||
                b.textContent?.trim() === name) &&
              !b.disabled,
          ),
        `Missing button ${name}`,
      );
      button.click();
      await pause(140);
    };
    let captured: Blob | undefined;
    const originalUrl = w.URL.createObjectURL.bind(w.URL);
    w.URL.createObjectURL = (blob) => {
      if (blob instanceof w.Blob && blob.type === 'application/json')
        captured = blob;
      return originalUrl(blob);
    };
    const originalClick = w.HTMLAnchorElement.prototype.click;
    w.HTMLAnchorElement.prototype.click = function () {
      if (!this.download) originalClick.call(this);
    };
    const backup = async () => {
      captured = undefined;
      await click('Keep a backup');
      const b = await until(() => captured, 'No editable download');
      return parseBackup(await b.text());
    };
    const record = async (name: string, work: () => Promise<void>) => {
      if (failed) {
        lines.push(`SKIP ${name}`);
        return;
      }
      try {
        await work();
        lines.push(`PASS ${name}`);
      } catch (e) {
        failed = true;
        lines.push(
          `FAIL ${name}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      setResults(lines.join('\n'));
    };
    let strokeId = '',
      baseCount = 0;
    await record(
      'Three real posters work before loading the drawing engine',
      async () => {
        assert(
          !d.querySelector('canvas.interactive'),
          'Engine was loaded eagerly',
        );
        for (const [label, image] of [
          ['02Find an idea', 'brainstorm.jpg'],
          ['03Connect the steps', 'flowchart.jpg'],
          ['01Teach a lesson', 'lesson.jpg'],
        ]) {
          await click(label);
          const img = await until(() =>
            d.querySelector<HTMLImageElement>(`.poster>img[src$="${image}"]`),
          );
          await until(
            () => img.complete && img.naturalWidth > 0,
            'Missing poster image',
          );
        }
      },
    );
    await record(
      'Real editor opens and exports a valid Bengali/English lesson',
      async () => {
        await click('Try drawing here');
        await until(() => d.querySelector('canvas.interactive'));
        await until(() =>
          d.querySelector<HTMLButtonElement>(
            'button[aria-label="Select objects"]:not(:disabled)',
          ),
        );
        const b = await backup();
        baseCount = b.elements.length;
        assert(
          b.elements.some((e) => e.type === 'text' && /আজকের পাঠ/.test(e.text)),
          'Missing Bengali lesson text',
        );
        assert(b.format === 'freeboard', 'Wrong backup format');
      },
    );
    await record(
      'Fine-width stylus ink keeps pressure samples in the editable backup',
      async () => {
        await click('Pen');
        const slider = await until(() =>
          d.querySelector<HTMLInputElement>('#preview-width'),
        );
        Object.getOwnPropertyDescriptor(
          w.HTMLInputElement.prototype,
          'value',
        )!.set!.call(slider, '1.5');
        slider.dispatchEvent(new w.Event('input', { bubbles: true }));
        await pause();
        const canvas =
          d.querySelector<HTMLCanvasElement>('canvas.interactive')!;
        const r = canvas.getBoundingClientRect();
        const emit = (type: string, x: number, y: number, pressure: number) =>
          canvas.dispatchEvent(
            new w.PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              pointerId: 71,
              pointerType: 'pen',
              isPrimary: true,
              button: 0,
              buttons: type === 'pointerup' ? 0 : 1,
              clientX: r.left + x,
              clientY: r.top + y,
              pressure,
            }),
          );
        emit('pointerdown', r.width * 0.67, r.height * 0.68, 0.3);
        for (let i = 1; i <= 8; i++)
          emit(
            'pointermove',
            r.width * 0.67 + i * 5,
            r.height * 0.68 + Math.sin(i) * 8,
            0.3 + i * 0.06,
          );
        emit('pointerup', r.width * 0.67 + 42, r.height * 0.68, 0.5);
        await pause(250);
        const b = await backup(),
          stroke = b.elements.find(
            (e) => e.type === 'freedraw' && !e.isDeleted,
          );
        assert(stroke?.type === 'freedraw', 'No ink committed');
        strokeId = stroke.id;
        assert(
          Math.abs(stroke.strokeWidth - 1.5 / 4.25) < 0.001,
          'Width conversion failed',
        );
        assert(
          stroke.points.length >= 9 &&
            stroke.pressures.length === stroke.points.length,
          'Pressure samples lost',
        );
        metrics.ink = {
          points: stroke.points.length,
          pressures: stroke.pressures.length,
          modelWidth: stroke.strokeWidth,
        };
      },
    );
    await record(
      'Native undo and redo preserve a whole preview stroke',
      async () => {
        await click('Undo');
        assert(
          !(await backup()).elements.some(
            (e) => e.id === strokeId && !e.isDeleted,
          ),
          'Undo did not remove stroke',
        );
        await click('Redo');
        assert(
          (await backup()).elements.some(
            (e) => e.id === strokeId && !e.isDeleted,
          ),
          'Redo did not restore stroke',
        );
      },
    );
    await record(
      'Independent starters retain their edits when switching templates',
      async () => {
        await click('02Find an idea');
        await until(
          () =>
            !d.querySelector('button[aria-label="Pen"][aria-pressed="true"]'),
        );
        const b = await backup();
        assert(
          !b.elements.some((e) => e.id === strokeId),
          'Lesson ink leaked into brainstorming',
        );
        assert(
          b.elements.some(
            (e) => e.type === 'text' && e.text.includes('Good ideas'),
          ),
          'Wrong brainstorming template',
        );
        await click('01Teach a lesson');
        await pause(250);
        assert(
          (await backup()).elements.some(
            (e) => e.id === strokeId && !e.isDeleted,
          ),
          'Switch lost preview ink',
        );
      },
    );
    await record(
      'Reset has a cancel path and restores only the current preview',
      async () => {
        await click('Reset preview');
        await until(() => d.querySelector('dialog[open]'));
        await click('Keep editing');
        assert(
          (await backup()).elements.some(
            (e) => e.id === strokeId && !e.isDeleted,
          ),
          'Cancel removed ink',
        );
        await click('Reset preview');
        const modal = await until(() => d.querySelector('dialog[open]'));
        await click('Reset preview', modal);
        await until(() => !d.querySelector('dialog[open]'));
        await pause(250);
        const b = await backup();
        assert(
          b.elements.filter((e) => !e.isDeleted).length === baseCount,
          'Reset did not restore starter',
        );
      },
    );
    await record(
      'Flowchart preview exports genuinely attached connectors',
      async () => {
        await click('03Connect the steps');
        await pause(250);
        const b = await backup(),
          arrows = b.elements.filter((e) => e.type === 'arrow');
        assert(
          arrows.length === 2 &&
            arrows.every(
              (e) =>
                e.type === 'arrow' &&
                e.startBinding?.elementId &&
                e.endBinding?.elementId,
            ),
          'Connectors are not attached',
        );
        metrics.connectedArrows = arrows.length;
      },
    );
    await record(
      'Preview controls fit desktop, tablet and mobile widths',
      async () => {
        const checks: unknown[] = [];
        for (const width of [320, 390, 768, 1100]) {
          frame.current!.style.width = `${width}px`;
          await pause(400);
          await until(() => w.innerWidth === width);
          assert(
            d.documentElement.scrollWidth <= width + 1,
            `Horizontal overflow at ${width}`,
          );
          const nodes = [
            ...d.querySelectorAll<HTMLButtonElement>(
              '.starter-tabs button,.demo-controls button,.demo-bottom button',
            ),
          ];
          for (const button of nodes) {
            const r = button.getBoundingClientRect();
            assert(
              r.left >= -1 &&
                r.right <= width + 1 &&
                r.width >= 24 &&
                r.height >= 24,
              `Control bounds at ${width}: ${button.getAttribute('aria-label') || button.textContent}`,
            );
          }
          checks.push({
            width,
            controls: nodes.length,
            scrollWidth: d.documentElement.scrollWidth,
          });
        }
        metrics.layouts = checks;
        frame.current!.style.width = '1100px';
      },
    );
    await record(
      'Preview editing leaves all saved board documents and assets unchanged',
      async () => {
        assert((await snapshot()) === before, 'Saved board data changed');
        metrics.savedBoardsUnchanged = true;
      },
    );
    w.URL.createObjectURL = originalUrl;
    w.HTMLAnchorElement.prototype.click = originalClick;
    const output = {
      passed: lines.filter((l) => l.startsWith('PASS')).length,
      total: 9,
      results: lines,
      metrics,
    };
    setResults(JSON.stringify(output, null, 2));
    setRunning(false);
  }
  return (
    <main style={{ font: '14px system-ui', padding: 20 }}>
      <h1>FreeBoard product-preview checks</h1>
      <button onClick={run} disabled={!ready || running}>
        {running ? 'Running…' : 'Run preview checks'}
      </button>
      <pre
        id="showcase-results"
        style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
      >
        {results}
      </pre>
      <iframe
        ref={frame}
        onLoad={() => setReady(true)}
        src="/preview.html"
        title="Real product preview"
        style={{
          display: 'block',
          width: 1100,
          height: 1250,
          border: '1px solid #ddd',
        }}
      />
    </main>
  );
}
createRoot(document.getElementById('qa-root')!).render(<Lab />);
