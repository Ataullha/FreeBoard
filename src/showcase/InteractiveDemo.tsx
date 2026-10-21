import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CaptureUpdateAction,
  Excalidraw,
  Footer,
  MainMenu,
} from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { Scene } from '../model/document';
import { backupFor, canvasState, makeBoard } from '../model/document';
import { templateElements } from '../editor/templates';
import type { TemplateId } from '../editor/templates';
import { attachPenInput } from '../editor/penInput';
import { attachGrowingEraser } from '../editor/growingEraser';
import { LocalClock } from '../ui/LocalClock';
import { backupBlob, download } from '../io/export';
import { validateElements, validateFiles } from '../io/validation';
import { imageDimensions } from '../io/images';
import {
  ArrowUpRight,
  Download,
  Eraser,
  Hand,
  Highlighter,
  MousePointer2,
  Pencil,
  RotateCcw,
  Square,
  Type,
  MoveUpRight,
} from 'lucide-react';
import '@excalidraw/excalidraw/index.css';
import './demo.css';

window.EXCALIDRAW_ASSET_PATH = new URL(
  `${import.meta.env.BASE_URL}excalidraw/`,
  window.location.href,
).href;
await Promise.all([
  document.fonts.load('20px Helvetica', 'FreeBoard'),
  document.fonts.load('20px "FreeBoard Bengali"', 'বাংলা'),
]).catch(() => {});
const tools = [
  { id: 'selection', label: 'Select objects', icon: MousePointer2 },
  { id: 'hand', label: 'Pan canvas', icon: Hand },
  { id: 'freedraw', label: 'Pen', icon: Pencil },
  { id: 'highlighter', label: 'Highlighter', icon: Highlighter },
  { id: 'eraser', label: 'Object eraser — hold to grow', icon: Eraser },
  { id: 'rectangle', label: 'Rectangle', icon: Square },
  { id: 'arrow', label: 'Arrow', icon: MoveUpRight },
  { id: 'text', label: 'Text', icon: Type },
] as const;
type Tool = (typeof tools)[number]['id'];
const titleFor = (template: TemplateId) =>
  template === 'lesson'
    ? 'Lesson preview'
    : template === 'brainstorm'
      ? 'Brainstorm preview'
      : 'Flowchart preview';

/** A memory-only instance of the production engine. Never opens the board repository. */
export default function InteractiveDemo({
  template,
}: {
  template: Exclude<TemplateId, 'blank'>;
}) {
  const scenes = useRef(new Map<TemplateId, Scene>());
  const [version, setVersion] = useState(0);
  return (
    <DemoCanvas
      key={`${template}:${version}`}
      template={template}
      scenes={scenes.current}
      reset={() => {
        scenes.current.delete(template);
        setVersion((n) => n + 1);
      }}
    />
  );
}

function DemoCanvas({
  template,
  scenes,
  reset,
}: {
  template: Exclude<TemplateId, 'blank'>;
  scenes: Map<TemplateId, Scene>;
  reset: () => void;
}) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [ready, setReady] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [tool, setTool] = useState<Tool>('selection');
  const [width, setWidth] = useState(2);
  const [markerWidth, setMarkerWidth] = useState(68);
  const [resetOpen, setResetOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const marker = useRef(false);
  const host = useRef<HTMLDivElement>(null);
  const ink = useRef<HTMLCanvasElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const resetDialog = useRef<HTMLDialogElement>(null);
  const initial = useMemo(
    () =>
      scenes.get(template) ?? {
        elements: templateElements(template),
        appState: canvasState({}),
        files: {},
      },
    [template, scenes],
  );
  const bind = useCallback(
    (editor: ExcalidrawImperativeAPI) => setApi(editor),
    [],
  );
  useEffect(() => {
    if (!api || !host.current || !ink.current || !cursor.current) return;
    const stopPen = attachPenInput(host.current, ink.current, {
      editor: () => api,
      highlighter: () => marker.current,
      start: () => {
        host.current
          ?.querySelector<HTMLElement>('.excalidraw')
          ?.focus({ preventScroll: true });
      },
      finish: () => {},
    });
    const stopEraser = attachGrowingEraser(host.current, cursor.current, {
      editor: () => api,
      start: () => {},
      finish: () => {},
    });
    return () => {
      stopPen();
      stopEraser();
    };
  }, [api]);
  useEffect(() => {
    if (!api || !ready || !viewport.width || !viewport.height) return;
    // Centering alone leaves these full-size starters clipped inside the
    // embedded canvas. Use the engine's committed viewport dimensions so a
    // resize never fits against its previous width. Edits and navigation do
    // not trigger this effect.
    api.scrollToContent(undefined, {
      fitToContent: true,
      animate: false,
      viewportZoomFactor: 0.8,
    });
  }, [api, ready, viewport]);
  useEffect(() => {
    if (resetOpen) resetDialog.current?.showModal();
    else resetDialog.current?.close();
  }, [resetOpen]);
  function choose(next: Tool) {
    marker.current = next === 'highlighter';
    setTool(next);
    api?.setActiveTool({ type: next === 'highlighter' ? 'freedraw' : next });
    api?.updateScene({
      appState: {
        currentItemStrokeWidth:
          (next === 'highlighter' ? markerWidth : width) / 4.25,
        currentItemOpacity: next === 'highlighter' ? 30 : 100,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }
  function changeWidth(value: number) {
    if (marker.current) setMarkerWidth(value);
    else setWidth(value);
    api?.updateScene({
      appState: { currentItemStrokeWidth: value / 4.25 },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }
  function keep() {
    if (!api) return;
    const scene = {
      elements: api.getSceneElementsIncludingDeleted(),
      appState: canvasState(api.getAppState()),
      files: api.getFiles(),
    };
    download(
      backupBlob(backupFor(makeBoard(titleFor(template), scene), scene)),
      `FreeBoard-${template}-preview.freeboard.json`,
    );
    setNotice(
      'Backup downloaded. Open FreeBoard → Import editable backup to continue.',
    );
  }
  const isInk = tool === 'freedraw' || tool === 'highlighter';
  return (
    <div className="interactive-demo">
      <div
        className="demo-controls"
        role="toolbar"
        aria-label="Preview drawing tools"
      >
        {tools.map((t) => (
          <button
            key={t.id}
            aria-label={t.label}
            title={t.label}
            aria-pressed={tool === t.id}
            disabled={!api || !ready}
            onClick={() => choose(t.id)}
          >
            <t.icon size={18} />
          </button>
        ))}
        <span className="demo-divider" />
        <button
          aria-label="Reset preview"
          title="Restore this starter"
          onClick={() => setResetOpen(true)}
        >
          <RotateCcw size={17} />
        </button>
      </div>
      {isInk && (
        <div className="demo-width">
          <label htmlFor="preview-width">
            {tool === 'highlighter' ? 'Marker' : 'Pen'} width
          </label>
          <input
            id="preview-width"
            type="range"
            min={tool === 'highlighter' ? 8 : 0.5}
            max={tool === 'highlighter' ? 80 : 12}
            step={tool === 'highlighter' ? 1 : 0.25}
            value={tool === 'highlighter' ? markerWidth : width}
            onChange={(e) => changeWidth(Number(e.target.value))}
          />
          <output>{tool === 'highlighter' ? markerWidth : width} px</output>
        </div>
      )}
      <div
        className={`demo-canvas ${isInk ? 'is-inking' : ''}`}
        ref={host}
        role="region"
        aria-label="Interactive FreeBoard preview"
      >
        <Excalidraw
          excalidrawAPI={bind}
          initialData={{
            ...initial,
            appState: {
              ...initial.appState,
              currentItemFontFamily: 2,
              currentItemStrokeColor: '#171717',
              currentItemRoughness: 0,
              currentItemFillStyle: 'solid',
              currentItemStrokeWidth: width / 4.25,
            },
            scrollToContent: false,
          }}
          onChange={(elements, state, files) => {
            if (!ready && !elements.length && initial.elements.length) return;
            setReady(true);
            if (
              viewport.width !== state.width ||
              viewport.height !== state.height
            )
              setViewport({ width: state.width, height: state.height });
            scenes.set(template, {
              elements,
              appState: canvasState(state),
              files,
            });
            const type = state.activeTool.type;
            const next =
              type === 'freedraw' && marker.current ? 'highlighter' : type;
            if (tools.some((t) => t.id === next)) setTool(next as Tool);
          }}
          theme="light"
          name={titleFor(template)}
          autoFocus={false}
          handleKeyboardGlobally={false}
          aiEnabled={false}
          validateEmbeddable={false}
          onLinkOpen={(_, event) => event.preventDefault()}
          onPaste={async (data) => {
            try {
              if (data.mixedContent?.some((item) => item.type === 'imageUrl'))
                throw new Error(
                  'Paste a local image or editable objects instead of a remote image link.',
                );
              if (data.elements)
                data.elements = validateElements(data.elements);
              if (data.files) {
                data.files = validateFiles(data.files);
                for (const file of Object.values(data.files))
                  await imageDimensions(file.dataURL);
              }
              return true;
            } catch (error) {
              setNotice(
                error instanceof Error
                  ? error.message
                  : 'This clipboard content could not be pasted.',
              );
              return false;
            }
          }}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              saveAsImage: false,
              export: false,
              clearCanvas: false,
              toggleTheme: false,
            },
            tools: { image: false },
          }}
        >
          <MainMenu />
          <Footer>
            <LocalClock />
          </Footer>
        </Excalidraw>
        <canvas ref={ink} className="demo-ink" aria-hidden="true" />
        <div ref={cursor} className="demo-eraser" hidden aria-hidden="true">
          <span>Release to erase</span>
        </div>
      </div>
      <div className="demo-bottom">
        <span>Preview edits stay in this tab.</span>
        <button onClick={keep} disabled={!api || !ready}>
          <Download size={14} />
          Keep a backup
        </button>
        <a href="./">
          Open full app <ArrowUpRight size={14} />
        </a>
      </div>
      {notice && (
        <p className="demo-notice" role="status">
          {notice}
        </p>
      )}
      <dialog
        ref={resetDialog}
        className="reset-demo-dialog"
        onCancel={() => setResetOpen(false)}
        onClose={() => setResetOpen(false)}
      >
        <h2>Reset this preview?</h2>
        <p>
          This restores the starter and removes edits to this preview. Your
          saved FreeBoard boards are unaffected.
        </p>
        <div>
          <button className="button" onClick={() => setResetOpen(false)}>
            Keep editing
          </button>
          <button
            className="button primary"
            onClick={() => {
              reset();
            }}
          >
            Reset preview
          </button>
        </div>
      </dialog>
    </div>
  );
}
