/* Development-only end-to-end checks using the real app's DOM, drop and export UI. */
import { createRoot } from 'react-dom/client';
import { useRef, useState } from 'react';
import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import { backupFor, makeBoard, defaultCanvas } from '../src/model/document';
import { parseBackup } from '../src/io/validation';
import '../src/styles.css';

type AppWindow = Window & typeof globalThis;
const pause = (ms = 80) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
async function until<T>(
  read: () => T | null | undefined | false,
  message: string,
): Promise<T> {
  const start = performance.now();
  while (performance.now() - start < 12000) {
    const value = read();
    if (value) return value;
    await pause();
  }
  throw new Error(message);
}
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function Journeys() {
  const frame = useRef<HTMLIFrameElement>(null),
    second = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false),
    [ready, setReady] = useState(false);
  const [width, setWidth] = useState(1100),
    [results, setResults] = useState(
      'Ready. Creates new QA boards in this browser; existing boards are preserved.',
    );
  const doc = () => frame.current!.contentDocument!;
  const win = () => frame.current!.contentWindow as AppWindow;
  async function button(name: string, root: ParentNode = doc()) {
    const element = await until(
      () =>
        [...root.querySelectorAll<HTMLButtonElement>('button')].find(
          (b) =>
            (b.getAttribute('aria-label') === name ||
              b.textContent?.trim() === name) &&
            !b.matches(':disabled'),
        ),
      `Button unavailable: ${name}`,
    );
    element.click();
    await pause();
  }
  function input(
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string,
  ) {
    const w = win(),
      prototype =
        element.tagName === 'TEXTAREA'
          ? w.HTMLTextAreaElement.prototype
          : w.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(
      element,
      value,
    );
    element.dispatchEvent(new w.Event('input', { bubbles: true }));
  }
  async function saved() {
    await until(
      () => doc().querySelector('.save-state.saved'),
      'The app did not report a successful save',
    );
  }
  async function drop(file: File) {
    const w = win(),
      transfer = new w.DataTransfer();
    transfer.items.add(file);
    const target = await until(
      () => doc().querySelector('main'),
      'Canvas not ready',
    );
    target.dispatchEvent(
      new w.DragEvent('drop', {
        dataTransfer: transfer,
        bubbles: true,
        cancelable: true,
      }),
    );
    await pause(100);
    await until(
      () => doc().querySelector('.app-shell[aria-busy="false"]'),
      'File operation did not finish',
    );
  }
  async function exported(format: 'json' | 'png' | 'svg' = 'json') {
    await button('Export');
    await until(
      () => doc().querySelector('dialog[open]'),
      'Export dialog did not open',
    );
    if (format !== 'json')
      await button(
        format === 'png'
          ? 'PNG imageA crisp image for slides and messages'
          : 'SVG artworkScalable vector · embedded fonts',
      );
    await button('Prepare file');
    const anchor = await until(
      () => doc().querySelector<HTMLAnchorElement>('a[download]'),
      'Export preparation failed',
    );
    const response = await win().fetch(anchor.href),
      blob = await response.blob();
    await button('Close dialog');
    return blob;
  }
  async function library() {
    await button('FreeBoard workspace');
    await until(
      () => doc().querySelector('.board-grid'),
      'Board library did not load',
    );
  }
  async function run() {
    setRunning(true);
    setWidth(1100);
    const log: string[] = [];
    let title = `QA journey ${Date.now()}`;
    let count = 0;
    let failed = false;
    const record = async (name: string, work: () => Promise<void>) => {
      if (failed) {
        log.push(`SKIP  ${name}: prerequisite failed`);
        return;
      }
      try {
        await work();
        log.push(`PASS  ${name}`);
      } catch (error) {
        failed = true;
        log.push(
          `FAIL  ${name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      setResults(log.join('\n'));
    };
    await record(
      'Valid editable backup imports through the real drop handler',
      async () => {
        await until(
          () =>
            frame.current!.clientWidth === 1100 &&
            !doc().querySelector('.App-bottom-bar'),
          'Desktop preview did not settle before running the journeys',
        );
        await until(
          () => doc().querySelector('#board-title:not(:disabled)'),
          'Initial board not ready',
        );
        const scene = {
          elements: convertToExcalidrawElements([
            {
              type: 'rectangle',
              x: 100,
              y: 100,
              width: 200,
              height: 130,
              backgroundColor: '#e2eadd',
              fillStyle: 'solid',
            },
            {
              type: 'text',
              x: 360,
              y: 100,
              text: 'বাংলায় ভাবি।\nIdeas in English.',
              fontFamily: 2,
            },
          ]),
          appState: defaultCanvas(),
          files: {},
        };
        const backup = backupFor(makeBoard(title), scene);
        await drop(
          new (win().File)([JSON.stringify(backup)], 'journey.freeboard.json', {
            type: 'application/json',
          }),
        );
        await until(
          () =>
            doc().querySelector<HTMLInputElement>('#board-title')?.value ===
            title,
          'Imported board did not open',
        );
        await saved();
      },
    );
    await record(
      'Keyboard tools use the same style presets as toolbar buttons',
      async () => {
        const c = await until(
            () => doc().querySelector<HTMLCanvasElement>('canvas.interactive'),
            'Drawing canvas did not finish opening',
          ),
          w = win();
        const press = (key: string, code: string) => {
          c.focus();
          c.dispatchEvent(
            new w.KeyboardEvent('keydown', {
              key,
              code,
              bubbles: true,
              cancelable: true,
            }),
          );
          c.dispatchEvent(
            new w.KeyboardEvent('keyup', {
              key,
              code,
              bubbles: true,
              cancelable: true,
            }),
          );
        };
        const opacity = () => {
          const slider = doc().querySelector<HTMLElement>(
            'input[type=range],[role=slider]',
          );
          return slider instanceof w.HTMLInputElement
            ? slider.value
            : slider?.getAttribute('aria-valuenow');
        };
        press('m', 'KeyM');
        await until(() => opacity() === '30', 'Highlighter preset not applied');
        press('r', 'KeyR');
        await until(
          () => opacity() === '100',
          'Keyboard rectangle inherited highlighter transparency',
        );
        assert(
          doc().querySelector(
            '[aria-label="Rectangle (R)"][aria-pressed=true]',
          ),
          'Rectangle shortcut did not select the tool',
        );
        press('7', 'Digit7');
        await until(
          () =>
            doc().querySelector('[aria-label="Pen (P)"][aria-pressed=true]'),
          'Numeric pen shortcut retained highlighter mode',
        );
        press('v', 'KeyV');
        await pause(100);
      },
    );
    await record(
      'Local PNG insertion and editable export preserve image bytes',
      async () => {
        const c = document.createElement('canvas');
        c.width = 80;
        c.height = 50;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#2d5545';
        ctx.fillRect(0, 0, 80, 50);
        ctx.fillStyle = '#e8d9a8';
        ctx.fillRect(10, 10, 60, 30);
        const blob = await new Promise<Blob>((resolve) =>
          c.toBlob((b) => resolve(b!), 'image/png'),
        );
        await drop(
          new (win().File)([blob], 'journey.png', { type: 'image/png' }),
        );
        await saved();
        const backup = parseBackup(await (await exported()).text());
        assert(
          backup.elements.some((e) => e.type === 'image') &&
            Object.keys(backup.files).length === 1,
          'Image or image bytes missing from backup',
        );
        count = backup.elements.length;
      },
    );
    await record(
      'Bengali/English note editing and composition ignore drawing shortcuts',
      async () => {
        await button('Sticky note (N)');
        await pause(150);
        const c = doc().querySelector<HTMLCanvasElement>('canvas.interactive')!,
          r = c.getBoundingClientRect(),
          w = win();
        c.dispatchEvent(
          new w.MouseEvent('dblclick', {
            clientX: r.x + r.width / 2,
            clientY: r.y + r.height * 0.43,
            bubbles: true,
            cancelable: true,
          }),
        );
        const t = await until(
          () =>
            doc().querySelector<HTMLTextAreaElement>(
              'textarea.excalidraw-wysiwyg',
            ),
          'Note text editor did not open',
        );
        t.focus();
        t.dispatchEvent(
          new w.CompositionEvent('compositionstart', { bubbles: true }),
        );
        input(t, 'আমি বাংলায় লিখি।\nEnglish M N P I');
        t.dispatchEvent(
          new w.KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            isComposing: true,
            bubbles: true,
            cancelable: true,
          }),
        );
        assert(
          doc().querySelector('textarea.excalidraw-wysiwyg'),
          'IME Escape prematurely closed text editing',
        );
        t.dispatchEvent(
          new w.CompositionEvent('compositionend', {
            data: 'বাংলায়',
            bubbles: true,
          }),
        );
        for (const key of ['m', 'n', 'p', 'i']) {
          t.dispatchEvent(
            new w.KeyboardEvent('keydown', {
              key,
              code: `Key${key.toUpperCase()}`,
              bubbles: true,
            }),
          );
          t.dispatchEvent(
            new w.KeyboardEvent('keyup', {
              key,
              code: `Key${key.toUpperCase()}`,
              bubbles: true,
            }),
          );
        }
        t.dispatchEvent(
          new w.KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            bubbles: true,
            cancelable: true,
          }),
        );
        await until(
          () => !doc().querySelector('textarea.excalidraw-wysiwyg'),
          'Note edit did not finish',
        );
        await saved();
        const backup = parseBackup(await (await exported()).text());
        assert(
          backup.elements.some(
            (e) =>
              e.type === 'text' &&
              e.text.includes('আমি বাংলায় লিখি।') &&
              e.text.includes('English M N P I'),
          ),
          'Edited Unicode text was lost',
        );
        assert(
          backup.elements.length === count + 2,
          'Typing triggered a drawing command',
        );
        count = backup.elements.length;
      },
    );
    await record('Text editing is one logical undo/redo action', async () => {
      const c = doc().querySelector<HTMLCanvasElement>('canvas.interactive')!,
        w = win();
      await pause(100);
      c.focus();
      c.dispatchEvent(
        new w.KeyboardEvent('keydown', {
          key: 'z',
          code: 'KeyZ',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      c.dispatchEvent(
        new w.KeyboardEvent('keyup', {
          key: 'z',
          code: 'KeyZ',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      await pause(100);
      const undone = parseBackup(await (await exported()).text());
      assert(
        undone.elements.length === count &&
          !undone.elements.some(
            (e) => e.type === 'text' && e.text.includes('English M N P I'),
          ),
        'Undo did not restore the note before editing',
      );
      await pause(100);
      c.focus();
      c.dispatchEvent(
        new w.KeyboardEvent('keydown', {
          key: 'z',
          code: 'KeyZ',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      c.dispatchEvent(
        new w.KeyboardEvent('keyup', {
          key: 'z',
          code: 'KeyZ',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      await pause(100);
      const redone = parseBackup(await (await exported()).text());
      assert(
        redone.elements.length === count &&
          redone.elements.some(
            (e) => e.type === 'text' && e.text.includes('English M N P I'),
          ),
        'Redo did not restore edited text',
      );
      await saved();
    });
    await record(
      'Reload recovers saved text, objects and image; editable backup reopens',
      async () => {
        frame.current!.src = '/';
        await pause(100);
        await until(
          () =>
            doc().querySelector<HTMLInputElement>('#board-title')?.value ===
            title,
          'Reload did not reopen the board',
        );
        await saved();
        const blob = await exported(),
          backup = parseBackup(await blob.text());
        assert(
          backup.elements.length === count &&
            Object.keys(backup.files).length === 1,
          'Reload lost scene data',
        );
        title += ' imported';
        backup.title = title;
        await drop(
          new (win().File)(
            [JSON.stringify(backup)],
            'roundtrip.freeboard.json',
            { type: 'application/json' },
          ),
        );
        await until(
          () =>
            doc().querySelector<HTMLInputElement>('#board-title')?.value ===
            title,
          'Backup did not reopen',
        );
        await saved();
      },
    );
    await record(
      'Board duplicate, trash and restore through workspace controls',
      async () => {
        await library();
        await button(`Duplicate ${title}`);
        title += ' (copy)';
        await until(
          () =>
            doc().querySelector<HTMLInputElement>('#board-title')?.value ===
            title,
          'Duplicate did not open',
        );
        await saved();
        await library();
        await button(`Move ${title} to trash`);
        await until(
          () =>
            !doc().querySelector(`button[aria-label="Move ${title} to trash"]`),
          'Trash did not update',
        );
        await until(
          () => !doc().querySelector('fieldset.library-fields:disabled'),
          'Workspace is still loading',
        );
        const trashTab = [
          ...doc().querySelectorAll<HTMLButtonElement>('[role="tab"]'),
        ].find((b) => b.textContent?.includes('Trash'))!;
        trashTab.click();
        await until(
          () => doc().querySelector(`button[aria-label="Restore ${title}"]`),
          'Deleted board missing from Trash',
        );
        await button(`Restore ${title}`);
        await until(
          () => !doc().querySelector(`button[aria-label="Restore ${title}"]`),
          'Restore did not finish',
        );
        await until(
          () => !doc().querySelector('fieldset.library-fields:disabled'),
          'Workspace is still loading',
        );
        [...doc().querySelectorAll<HTMLButtonElement>('[role="tab"]')]
          .find((b) => b.textContent?.startsWith('Boards'))!
          .click();
        await until(
          () => doc().querySelector(`button[aria-label="Open ${title}"]`),
          'Restored board missing from Boards',
        );
        await button(`Open ${title}`);
        await until(
          () =>
            doc().querySelector<HTMLInputElement>('#board-title')?.value ===
            title,
          'Restored board did not open',
        );
        await saved();
      },
    );
    await record(
      'Invalid import leaves current board intact with backup access',
      async () => {
        await drop(
          new (win().File)(['{"broken":'], 'invalid.json', {
            type: 'application/json',
          }),
        );
        await until(
          () => doc().querySelector('.error-banner'),
          'Invalid file did not show an error',
        );
        assert(
          doc().querySelector<HTMLInputElement>('#board-title')?.value ===
            title,
          'Invalid import replaced the current board',
        );
        assert(
          [...doc().querySelectorAll('button')].some(
            (b) => b.textContent === 'Download backup',
          ),
          'Immediate backup action missing',
        );
        await button('Dismiss message');
      },
    );
    await record(
      'Storage write failure offers export; retry saves retained edits',
      async () => {
        const w = win(),
          original = w.IDBDatabase.prototype.transaction;
        try {
          w.IDBDatabase.prototype.transaction = function () {
            throw new w.DOMException(
              'Simulated quota failure',
              'QuotaExceededError',
            );
          };
          title += ' recovered';
          input(doc().querySelector<HTMLInputElement>('#board-title')!, title);
          await until(
            () => doc().querySelector('.error-banner'),
            'Storage failure was not visible',
          );
          assert(
            !doc().querySelector('.save-state.saved'),
            'Storage failure falsely reported Saved',
          );
          const backup = parseBackup(await (await exported()).text());
          assert(
            backup.title === title && backup.elements.length === count,
            'Emergency backup lost unsaved work',
          );
        } finally {
          w.IDBDatabase.prototype.transaction = original;
        }
        await button('Retry save');
        await saved();
      },
    );
    await record(
      'Second tab receives conflict notice and cannot silently overwrite',
      async () => {
        const other = document.createElement('iframe');
        other.title = 'Second tab conflict test';
        other.src = '/';
        other.style.cssText = 'width:600px;height:350px;border:1px solid #ccc';
        second.current!.append(other);
        try {
          await until(
            () =>
              other.contentDocument?.querySelector<HTMLInputElement>(
                '#board-title',
              )?.value === title,
            'Second app did not open the same board',
          );
          title += ' final';
          input(doc().querySelector<HTMLInputElement>('#board-title')!, title);
          await saved();
          await until(
            () => other.contentDocument?.querySelector('.readonly-banner'),
            'Second app did not show its stale revision',
          );
          assert(
            other.contentDocument?.querySelector<HTMLInputElement>(
              '#board-title',
            )?.disabled,
            'Stale title remained editable',
          );
        } finally {
          other.remove();
        }
      },
    );
    await record(
      'Mobile and tablet controls stay named, in bounds and separate',
      async () => {
        for (const size of [320, 390, 768, 1100]) {
          setWidth(size);
          await until(
            () => frame.current!.clientWidth === size,
            'Preview width did not change',
          );
          await pause(250);
          const controls = [
            ...doc().querySelectorAll<HTMLElement>(
              '.tool-dock button,.canvas-utilities button,.mobile-zoom button,.header-actions button',
            ),
          ].filter((el) => el.getBoundingClientRect().width > 0);
          for (const control of controls) {
            const r = control.getBoundingClientRect();
            assert(
              r.left >= 0 && r.right <= size && r.top >= 0 && r.bottom <= 740,
              `Control outside ${size}px viewport`,
            );
            assert(r.width >= 24 && r.height >= 24, 'Small control target');
            assert(
              control.getAttribute('aria-label') ||
                control.innerText.trim() ||
                control.title,
              'Unnamed control',
            );
          }
          if (size <= 600) {
            const nativeZoom = doc().querySelector('.zoom-actions');
            assert(
              !nativeZoom ||
                win().getComputedStyle(nativeZoom).display === 'none',
              'Duplicate mobile zoom',
            );
            const history = doc()
              .querySelector('.undo-redo-buttons')
              ?.getBoundingClientRect();
            const utilities = doc()
              .querySelector('.canvas-utilities')!
              .getBoundingClientRect();
            if (history && history.width > 0)
              assert(
                history.bottom <= utilities.top,
                'Mobile history overlaps navigation',
              );
          }
        }
      },
    );
    const summary = {
      kind: 'application-journeys',
      time: new Date().toISOString(),
      userAgent: navigator.userAgent,
      results: log,
    };
    setResults(JSON.stringify(summary, null, 2));
    setRunning(false);
  }
  return (
    <div
      style={{
        height: '100dvh',
        overflow: 'auto',
        padding: 12,
        background: '#eef2e9',
      }}
    >
      <header
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <strong>FreeBoard application journeys</strong>
        <button
          className="button secondary"
          disabled={running || !ready}
          onClick={() => void run()}
        >
          Run app journeys
        </button>
        {[1100, 768, 390].map((w) => (
          <button
            key={w}
            className="button secondary small"
            disabled={running}
            onClick={() => setWidth(w)}
          >
            Width {w}
          </button>
        ))}
      </header>
      <iframe
        ref={frame}
        title="FreeBoard app under test"
        src="/"
        onLoad={() => setReady(true)}
        style={{
          width,
          boxSizing: 'content-box',
          height: 740,
          display: 'block',
          border: '1px solid #ccd9c4',
          maxWidth: '100%',
        }}
      />
      <pre
        aria-label="Journey results"
        style={{
          font: '12px/1.6 monospace',
          whiteSpace: 'pre-wrap',
          padding: 16,
          background: '#fff',
        }}
      >
        {results}
      </pre>
      <div ref={second} />
    </div>
  );
}
createRoot(document.getElementById('journey-root')!).render(<Journeys />);
