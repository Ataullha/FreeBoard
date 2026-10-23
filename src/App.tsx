import { createId } from './model/id';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Excalidraw,
  MainMenu,
  Footer,
  CaptureUpdateAction,
  convertToExcalidrawElements,
  getSceneVersion,
} from '@excalidraw/excalidraw';
import type { ActionName } from '@excalidraw/excalidraw/actions/types';
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import {
  ArrowDownToLine,
  ArrowUpRight,
  ArrowUpRight as ArrowTool,
  Check,
  ChevronDown,
  Circle,
  CloudOff,
  Columns2,
  Expand,
  FolderOpen,
  Grid2X2,
  GripHorizontal,
  GripVertical,
  Hand,
  Highlighter,
  ImagePlus,
  LoaderCircle,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  Presentation,
  RectangleHorizontal,
  Rows2,
  ShieldCheck,
  StickyNote,
  Type,
  Undo2,
  X,
  AlertCircle,
  Eraser,
  HelpCircle,
  Trash2,
} from 'lucide-react';
import { BoardRepository, ConflictError } from './storage/repository';
import type { Draft } from './storage/repository';
import { Autosave } from './storage/autosave';
import type { SaveStatus } from './storage/autosave';
import { BoardLease } from './storage/lease';
import {
  makeBoard,
  canvasState,
  backupFor,
  selectedScene,
  sceneFiles,
} from './model/document';
import type { BoardRecord, Scene } from './model/document';
import { toScene, zoomAt } from './model/coordinates';
import { parseBackup, validateElements, validateFiles } from './io/validation';
import { imageDimensions, readImage } from './io/images';
import {
  backupBlob,
  download,
  exportArtwork,
  filename,
  thumbnail,
} from './io/export';
import { attachPenInput } from './editor/penInput';
import { attachGrowingEraser } from './editor/growingEraser';
import { deleteObjects } from './editor/boardEditing';
import { LocalClock } from './ui/LocalClock';
import { Dialog } from './ui/Dialog';
import { stickyElements, templateElements } from './editor/templates';
import type { TemplateId } from './editor/templates';
import { BoardLibrary } from './ui/BoardLibrary';
import { ExportDialog } from './ui/ExportDialog';
import { Help } from './ui/Help';
import { TemplatePreview } from './ui/TemplatePreview';
import { setupPwa } from './pwa';
import type { OfflineState } from './pwa';

type Modal = 'library' | 'export' | 'help' | 'privacy' | 'clear' | null;
type Tool =
  | 'selection'
  | 'freedraw'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'arrow'
  | 'rectangle'
  | 'ellipse'
  | 'text'
  | 'hand';
const tools = [
  { id: 'selection', name: 'Select', key: 'V', icon: MousePointer2 },
  { id: 'hand', name: 'Hand', key: 'H', icon: Hand },
  { id: 'freedraw', name: 'Pen', key: 'P', icon: PenLine },
  { id: 'highlighter', name: 'Highlighter', key: 'M', icon: Highlighter },
  { id: 'eraser', name: 'Object eraser', key: 'E', icon: Eraser },
  { id: 'line', name: 'Line', key: 'L', icon: Minus },
  { id: 'arrow', name: 'Arrow', key: 'A', icon: ArrowTool },
  { id: 'rectangle', name: 'Rectangle', key: 'R', icon: RectangleHorizontal },
  { id: 'ellipse', name: 'Ellipse', key: 'O', icon: Circle },
  { id: 'text', name: 'Text', key: 'T', icon: Type },
] as const;
function editable(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el?.closest(
    'input,textarea,select,[contenteditable="true"],[role="dialog"],dialog',
  );
}
// Legacy namespace intentionally shared with earlier releases.
function pref(key: string, value?: string) {
  try {
    if (value !== undefined) localStorage.setItem(`boardpilot:${key}`, value);
    return localStorage.getItem(`boardpilot:${key}`);
  } catch {
    return null;
  }
}
const INK_SCALE = 4.25;
function savedWidth(key: string, fallback: number) {
  const raw = pref(key),
    value = raw === null ? fallback : Number(raw);
  return Number.isFinite(value) && value >= 0.1 && value <= 20
    ? value
    : fallback;
}
export default function App() {
  const [repo] = useState(() => new BoardRepository()),
    [lease] = useState(() => new BoardLease());
  const [board, setBoard] = useState<BoardRecord | null>(null),
    [initial, setInitial] = useState<{
      board: BoardRecord;
      files: BinaryFiles;
      epoch: number;
    } | null>(null);
  const [modal, setModal] = useState<Modal>(null),
    [boards, setBoards] = useState<BoardRecord[]>([]),
    [drafts, setDrafts] = useState<Draft[]>([]),
    [libraryLoading, setLibraryLoading] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('saving'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [readOnly, setReadOnly] = useState(false),
    [presentation, setPresentation] = useState(false);
  const brushWidths = useRef<{ pen: number; highlighter: number } | null>(null);
  if (!brushWidths.current)
    brushWidths.current = {
      pen: savedWidth('pen-width', 2 / INK_SCALE),
      highlighter: savedWidth('marker-width', 16),
    };
  const [strokeWidth, setStrokeWidth] = useState(brushWidths.current.pen);
  const [tool, setTool] = useState<Tool>('selection'),
    [empty, setEmpty] = useState(true),
    [selected, setSelected] = useState(false),
    [grid, setGrid] = useState(false),
    [zoom, setZoom] = useState(1),
    [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine),
    [offline, setOffline] = useState<OfflineState>('preparing'),
    [update, setUpdate] = useState<(() => void) | null>(null),
    [install, setInstall] = useState<Event | null>(null);
  const api = useRef<ExcalidrawImperativeAPI | null>(null),
    autosave = useRef<Autosave | null>(null),
    writerId = useRef(createId()),
    readonlyRef = useRef(false),
    marker = useRef(false),
    signature = useRef('');
  const canvasHost = useRef<HTMLElement>(null),
    inkCanvas = useRef<HTMLCanvasElement>(null),
    eraserCursor = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null),
    imageInput = useRef<HTMLInputElement>(null),
    switching = useRef(false),
    channel = useRef<BroadcastChannel | null>(null),
    boardRef = useRef<BoardRecord | null>(null);
  const [dockOrientation, setDockOrientation] = useState<
    'horizontal' | 'vertical'
  >(() =>
    pref('toolbar-orientation') === 'vertical' ? 'vertical' : 'horizontal',
  );
  const [dockPosition, setDockPosition] = useState<{
    x: number;
    y: number;
  } | null>(() => {
    try {
      const saved = pref('toolbar-position');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          return parsed;
        }
      }
    } catch {}
    return null;
  });
  const [isDragging, setIsDragging] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const dockEl = dockRef.current;
    const hostEl = canvasHost.current;
    if (!dockEl || !hostEl) return;

    const hostRect = hostEl.getBoundingClientRect();
    const dockRect = dockEl.getBoundingClientRect();

    const startDockX = dockRect.left - hostRect.left;
    const startDockY = dockRect.top - hostRect.top;
    const startPointerX = e.clientX;
    const startPointerY = e.clientY;

    setIsDragging(true);

    let latestX = startDockX;
    let latestY = startDockY;

    const onMove = (ev: MouseEvent | PointerEvent) => {
      const currentHostRect = hostEl.getBoundingClientRect();
      const currentDockRect = dockEl.getBoundingClientRect();

      const dx = ev.clientX - startPointerX;
      const dy = ev.clientY - startPointerY;

      const minX = 8;
      const minY = 8;
      const maxX = Math.max(
        minX,
        currentHostRect.width - currentDockRect.width - 8,
      );
      const maxY = Math.max(
        minY,
        currentHostRect.height - currentDockRect.height - 8,
      );

      latestX = Math.round(Math.max(minX, Math.min(startDockX + dx, maxX)));
      latestY = Math.round(Math.max(minY, Math.min(startDockY + dy, maxY)));

      setDockPosition({ x: latestX, y: latestY });
    };

    const onEnd = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('pointercancel', onEnd);

      pref('toolbar-position', JSON.stringify({ x: latestX, y: latestY }));
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  }, []);

  const toggleOrientation = useCallback(() => {
    setDockOrientation((prev) => {
      const next = prev === 'horizontal' ? 'vertical' : 'horizontal';
      pref('toolbar-orientation', next);

      const hostEl = canvasHost.current;
      if (hostEl) {
        const hostRect = hostEl.getBoundingClientRect();
        if (dockPosition === null) {
          if (next === 'vertical') {
            const verticalPos = { x: 18, y: 18 };
            setDockPosition(verticalPos);
            pref('toolbar-position', JSON.stringify(verticalPos));
          }
        } else {
          const estWidth = next === 'vertical' ? 52 : 620;
          const estHeight = next === 'vertical' ? 564 : 56;
          const maxX = Math.max(8, hostRect.width - estWidth - 8);
          const maxY = Math.max(8, hostRect.height - estHeight - 8);
          const clamped = {
            x: Math.round(Math.max(8, Math.min(dockPosition.x, maxX))),
            y: Math.round(Math.max(8, Math.min(dockPosition.y, maxY))),
          };
          setDockPosition(clamped);
          pref('toolbar-position', JSON.stringify(clamped));
        }
      }
      return next;
    });
  }, [dockPosition]);

  const resetDockPosition = useCallback(() => {
    setDockPosition(null);
    try {
      localStorage.removeItem('boardpilot:toolbar-position');
    } catch {}
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (!dockPosition || !canvasHost.current || !dockRef.current) return;
      const hostRect = canvasHost.current.getBoundingClientRect();
      const dockRect = dockRef.current.getBoundingClientRect();
      const maxX = Math.max(8, hostRect.width - dockRect.width - 8);
      const maxY = Math.max(8, hostRect.height - dockRect.height - 8);
      const clampedX = Math.round(Math.max(8, Math.min(dockPosition.x, maxX)));
      const clampedY = Math.round(Math.max(8, Math.min(dockPosition.y, maxY)));
      if (clampedX !== dockPosition.x || clampedY !== dockPosition.y) {
        const newPos = { x: clampedX, y: clampedY };
        setDockPosition(newPos);
        pref('toolbar-position', JSON.stringify(newPos));
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [dockPosition]);
  const closeModal = useCallback(() => setModal(null), []);
  const scene = useCallback(
    (): Scene =>
      api.current
        ? {
            elements: api.current.getSceneElementsIncludingDeleted(),
            appState: canvasState(api.current.getAppState()),
            files: api.current.getFiles(),
          }
        : {
            elements: initial?.board.elements ?? [],
            appState: canvasState(initial?.board.appState ?? {}),
            files: initial?.files ?? {},
          },
    [initial],
  );
  useEffect(() => {
    if (!initial || !canvasHost.current || !inkCanvas.current) return;
    const stopPen = attachPenInput(canvasHost.current, inkCanvas.current, {
      editor: () => api.current,
      highlighter: () => marker.current,
      start: (element) => {
        autosave.current?.beginInteraction();
        autosave.current?.capture({
          ...scene(),
          elements: [
            ...(api.current?.getSceneElementsIncludingDeleted() ?? []),
            element,
          ],
        });
        setEmpty(false);
      },
      finish: (element) => {
        autosave.current?.capture({
          ...scene(),
          elements: [
            ...(api.current?.getSceneElementsIncludingDeleted() ?? []),
            element,
          ],
        });
        autosave.current?.endInteraction();
      },
    });
    const stopEraser = eraserCursor.current
      ? attachGrowingEraser(canvasHost.current, eraserCursor.current, {
          editor: () => api.current,
          start: () => autosave.current?.beginInteraction(),
          finish: () => autosave.current?.endInteraction(),
        })
      : () => {};
    return () => {
      stopPen();
      stopEraser();
    };
  }, [initial, scene]);
  const refreshLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const [all, d] = await Promise.all([repo.list(), repo.drafts()]);
      setBoards(all);
      setDrafts(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open your boards.');
    } finally {
      setLibraryLoading(false);
    }
  }, [repo]);
  const reportError = useCallback((e: unknown) => {
    setError(
      e instanceof Error
        ? e.message
        : 'Something went wrong. Download a backup and retry.',
    );
    if (e instanceof ConflictError) {
      readonlyRef.current = true;
      setReadOnly(true);
      void autosave.current?.dispose();
    }
  }, []);
  const load = useCallback(
    async (next: BoardRecord, files: BinaryFiles, recovered = false) => {
      await autosave.current?.dispose();
      api.current = null;
      const owns = await lease.acquire(next.id);
      // Read again after acquiring the lock; an older tab may have saved in between.
      if (next.revision > 0) {
        const fresh = await repo.load(next.id, owns);
        next = fresh.board;
        files = fresh.files;
        recovered ||= fresh.recovered;
      }
      readonlyRef.current = !owns;
      setReadOnly(!owns);
      marker.current = false;
      setTool('selection');
      setPresentation(false);
      setError('');
      setStatus(next.revision === 0 ? 'error' : 'saved');
      boardRef.current = next;
      setBoard(next);
      signature.current = '';
      setInitial({ board: next, files, epoch: Date.now() });
      pref('last-board', next.id);
      document.title = `${next.title} — FreeBoard`;
      autosave.current = new Autosave(
        repo,
        next,
        writerId.current,
        (s, e) => {
          setStatus(s);
          if (e) reportError(e);
          else if (s === 'saved') setError('');
        },
        (b) => {
          boardRef.current = b;
          setBoard(b);
          channel.current?.postMessage({
            id: b.id,
            revision: b.revision,
            writer: writerId.current,
          });
        },
      );
      if (recovered && owns)
        autosave.current.capture({
          elements: next.elements,
          appState: next.appState,
          files,
        });
      if (recovered)
        setNotice(
          'Recovered your interrupted session. Your next edit will save it to this board.',
        );
      if (!owns)
        setNotice(
          'This board is open in another tab. Make a copy to edit here.',
        );
    },
    [lease, repo, reportError],
  );
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const all = await repo.list();
        if (cancelled) return;
        let next =
          all.find((b) => b.id === pref('last-board') && !b.deletedAt) ??
          all.find((b) => !b.deletedAt);
        if (!next) next = await repo.create(makeBoard());
        if (cancelled) return;
        const loaded = await repo.load(next.id);
        await load(loaded.board, loaded.files, loaded.recovered);
      } catch (e) {
        if (cancelled) return;
        await load(makeBoard('Unsaved board'), {});
        reportError(e);
      }
    })();
    return () => {
      cancelled = true;
      lease.release();
      void autosave.current?.dispose();
    };
  }, [load, repo, lease, reportError]);
  useEffect(() => {
    const onlineChange = () => setOnline(navigator.onLine);
    window.addEventListener('online', onlineChange);
    window.addEventListener('offline', onlineChange);
    const stop = setupPwa(setOffline, (apply) => setUpdate(() => apply));
    const installPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e);
    };
    window.addEventListener('beforeinstallprompt', installPrompt);
    return () => {
      window.removeEventListener('online', onlineChange);
      window.removeEventListener('offline', onlineChange);
      window.removeEventListener('beforeinstallprompt', installPrompt);
      stop?.();
    };
  }, []);
  useEffect(() => {
    if (!('BroadcastChannel' in window)) return;
    const c = new BroadcastChannel('boardpilot:changes');
    channel.current = c;
    c.onmessage = (
      event: MessageEvent<{ id: string; revision: number; writer: string }>,
    ) => {
      const data = event.data,
        current = autosave.current;
      if (
        data.writer !== writerId.current &&
        data.id === current?.board.id &&
        data.revision > current.board.revision
      ) {
        reportError(new ConflictError());
      }
    };
    return () => {
      c.close();
      channel.current = null;
    };
  }, [reportError]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden && !readonlyRef.current)
        void autosave.current?.flush();
    };
    const leaving = (e: BeforeUnloadEvent) => {
      if (autosave.current?.dirty) {
        if (!readonlyRef.current) void autosave.current.checkpoint();
        e.preventDefault();
        e.returnValue = '';
      }
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('beforeunload', leaving);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('beforeunload', leaving);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  const flush = useCallback(async () => {
    if (readonlyRef.current) {
      if (autosave.current?.dirty) {
        setError(
          'Make a copy of your unsaved edits before switching boards. The original changed in another tab.',
        );
        return false;
      }
      return true;
    }
    return (await autosave.current?.flush()) ?? true;
  }, []);
  const openLibrary = useCallback(async () => {
    setLibraryLoading(true);
    setModal('library');
    try {
      if (api.current && !readonlyRef.current && autosave.current) {
        const current = scene();
        const preview = await thumbnail(current);
        autosave.current.capture(current);
        await autosave.current.flush(preview);
      }
    } catch (e) {
      reportError(e);
    }
    await refreshLibrary();
  }, [refreshLibrary, reportError, scene]);
  async function open(id: string) {
    if (switching.current) return;
    switching.current = true;
    setBusy(true);
    try {
      if (!(await flush())) return;
      const next = await repo.load(id);
      await load(next.board, next.files, next.recovered);
      setModal(null);
    } catch (e) {
      reportError(e);
    } finally {
      switching.current = false;
      setBusy(false);
    }
  }
  async function create(template: TemplateId) {
    if (switching.current) return;
    switching.current = true;
    setBusy(true);
    try {
      if (!(await flush())) return;
      const elements = templateElements(template),
        next = makeBoard(
          template === 'blank'
            ? 'Untitled board'
            : template === 'lesson'
              ? 'Today’s lesson'
              : template === 'brainstorm'
                ? 'Room for ideas'
                : 'A clear process',
          { elements },
        );
      if (elements.length)
        next.thumbnail = await thumbnail({
          elements,
          appState: next.appState,
          files: {},
        });
      const saved = await repo.create(next);
      await load(saved, {});
      setModal(null);
    } catch (e) {
      reportError(e);
    } finally {
      switching.current = false;
      setBusy(false);
    }
  }
  async function copyCurrent() {
    try {
      setBusy(true);
      const s = scene(),
        b = makeBoard(`${boardRef.current?.title ?? 'Board'} (copy)`, s);
      b.thumbnail = await thumbnail(s);
      const next = await repo.create(b, s.files);
      await load(next, s.files);
      setModal(null);
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  }
  async function duplicate(id: string) {
    if (id === boardRef.current?.id) {
      await copyCurrent();
      return;
    }
    try {
      setBusy(true);
      if (!(await flush())) return;
      const copy = await repo.duplicate(id);
      await load(copy, (await repo.load(copy.id)).files);
      setModal(null);
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  }
  async function trash(b: BoardRecord, restore = false) {
    try {
      if (b.id === boardRef.current?.id) {
        if (!(await flush())) return;
        b = autosave.current!.board;
      }
      await repo.trash(b, restore);
      channel.current?.postMessage({
        id: b.id,
        revision: b.revision + 1,
        writer: writerId.current,
      });
      if (!restore && b.id === boardRef.current?.id) {
        await autosave.current?.dispose();
        lease.release();
        const remaining = (await repo.list()).find((x) => !x.deletedAt);
        if (remaining) {
          const next = await repo.load(remaining.id);
          await load(next.board, next.files);
        } else {
          const next = await repo.create(makeBoard());
          await load(next, {});
        }
      }
      await refreshLibrary();
      setNotice(
        restore
          ? 'Board restored.'
          : 'Board moved to Trash. You can restore it any time.',
      );
    } catch (e) {
      reportError(e);
    }
  }
  async function rescue(draft: Draft) {
    try {
      if (!(await flush())) return;
      const next = await repo.rescue(draft);
      const saved = await repo.load(next.id);
      await load(saved.board, saved.files);
      setModal(null);
      setNotice('Recovery draft rescued as a separate board.');
    } catch (e) {
      reportError(e);
    }
  }
  const chooseTool = useCallback((next: Tool) => {
    if (!api.current || readonlyRef.current) return;
    marker.current = next === 'highlighter';
    setTool(next);
    if (next === 'highlighter')
      api.current.updateScene({
        appState: {
          currentItemOpacity: 30,
          currentItemStrokeWidth: brushWidths.current!.highlighter,
          currentItemStrokeColor: '#777777',
          currentItemRoughness: 0,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    else if (next === 'freedraw')
      api.current.updateScene({
        appState: {
          currentItemOpacity: 100,
          currentItemStrokeWidth: brushWidths.current!.pen,
          currentItemStrokeColor: '#171717',
          currentItemRoughness: 0,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    else if (next !== 'selection' && next !== 'hand' && next !== 'eraser')
      api.current.updateScene({
        appState: {
          currentItemOpacity: 100,
          currentItemStrokeWidth: 2,
          currentItemStrokeColor: '#171717',
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    api.current.setActiveTool({
      type: next === 'highlighter' ? 'freedraw' : next,
    });
  }, []);
  const addSticky = useCallback(() => {
    const editor = api.current;
    if (!editor || readonlyRef.current) return;
    const a = editor.getAppState(),
      center = toScene(
        { x: a.offsetLeft + a.width * 0.5, y: a.offsetTop + a.height * 0.43 },
        a,
      ),
      elements = stickyElements(center.x - 120, center.y - 95);
    marker.current = false;
    editor.setActiveTool({ type: 'selection' });
    editor.updateScene({
      elements: [...editor.getSceneElementsIncludingDeleted(), ...elements],
      appState: { selectedElementIds: { [elements[0].id]: true } },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    setNotice(
      'Double-click the note to write. Use Background to change its color.',
    );
  }, []);
  const insertImage = useCallback(
    async (file: File) => {
      if (!api.current || readonlyRef.current) return;
      setBusy(true);
      try {
        const { file: asset, width, height } = await readImage(file),
          editor = api.current!;
        const a = editor.getAppState(),
          center = toScene(
            { x: a.offsetLeft + a.width / 2, y: a.offsetTop + a.height / 2 },
            a,
          ),
          scale = Math.min(1, 640 / width, 480 / height);
        editor.addFiles([asset]);
        const elements = convertToExcalidrawElements([
          {
            type: 'image',
            x: center.x - (width * scale) / 2,
            y: center.y - (height * scale) / 2,
            width: width * scale,
            height: height * scale,
            fileId: asset.id,
            status: 'saved',
          },
        ]);
        marker.current = false;
        editor.setActiveTool({ type: 'selection' });
        editor.updateScene({
          elements: [...editor.getSceneElementsIncludingDeleted(), ...elements],
          appState: { selectedElementIds: { [elements[0].id]: true } },
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        setNotice('Image added. Corner handles preserve its proportions.');
      } catch (e) {
        reportError(e);
      } finally {
        setBusy(false);
      }
    },
    [reportError],
  );
  const importBackup = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        if (file.size > 40 * 1024 * 1024)
          throw new Error('Backups must be smaller than 40 MB.');
        const parsed = parseBackup(await file.text());
        for (const asset of Object.values(parsed.files))
          await imageDimensions(asset.dataURL);
        if (!(await flush())) return;
        const s = {
            elements: parsed.elements,
            appState: parsed.appState,
            files: parsed.files,
          },
          next = makeBoard(parsed.title, s);
        next.createdAt = parsed.createdAt;
        next.thumbnail = await thumbnail(s);
        const saved = await repo.create(next, parsed.files);
        await load(saved, parsed.files);
        setModal(null);
        setNotice('Editable backup imported as a new board.');
      } catch (e) {
        reportError(e);
      } finally {
        setBusy(false);
      }
    },
    [flush, load, repo, reportError],
  );
  const receiveFile = useCallback(
    (file: File) => {
      if (/\.json$/i.test(file.name)) void importBackup(file);
      else void insertImage(file);
    },
    [importBackup, insertImage],
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      // Escape cancels an IME candidate before it should finish the text editor.
      if (editable(e.target) && (e.isComposing || e.keyCode === 229)) {
        if (e.key === 'Escape') e.stopImmediatePropagation();
        return;
      }
      if (e.key === 'Escape' && presentation) {
        setPresentation(false);
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's' && !e.isComposing) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        queueMicrotask(() => void flush());
        return;
      }
      if (editable(e.target) || modal || e.isComposing || busy) return;
      if (mod && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        e.stopImmediatePropagation();
        fileInput.current?.click();
        return;
      }
      if (readonlyRef.current || presentation) return;
      if (!mod && e.altKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggleOrientation();
        return;
      }
      if (!mod && !e.altKey && !e.shiftKey) {
        const k = e.key.toLowerCase();
        const aliases: Record<string, Tool> = {
          '1': 'selection',
          '2': 'rectangle',
          '4': 'ellipse',
          '5': 'arrow',
          '6': 'line',
          '7': 'freedraw',
          '8': 'text',
        };
        const requested =
          tools.find((t) => t.key.toLowerCase() === k)?.id ?? aliases[k];
        if (requested || k === 'n' || k === 'i') {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (requested) chooseTool(requested);
          if (k === 'n') addSticky();
          if (k === 'i') imageInput.current?.click();
        }
      }
      // The product deliberately supports drawing objects only, not frames or embedded websites.
      if (!mod && !e.altKey && ['f', '9', '0'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    const paste = (e: ClipboardEvent) => {
      if (editable(e.target) || modal || readonlyRef.current) return;
      const files = e.clipboardData?.files;
      if (files?.length) {
        e.preventDefault();
        e.stopImmediatePropagation();
        void insertImage(files[0]);
      }
    };
    document.addEventListener('keydown', key, true);
    document.addEventListener('paste', paste, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('paste', paste, true);
    };
  }, [
    addSticky,
    chooseTool,
    flush,
    insertImage,
    modal,
    presentation,
    busy,
    toggleOrientation,
  ]);
  const bindEditor = useCallback((editor: ExcalidrawImperativeAPI) => {
    api.current = editor;
    for (const name of [
      'changeArrowType',
      'hyperlink',
      'addToLibrary',
      'wrapSelectionInFrame',
      'setFrameAsActiveTool',
      'setEmbeddableAsActiveTool',
      'copyElementLink',
      'linkToElement',
    ] as ActionName[])
      editor.registerAction({
        name,
        label: 'Unavailable',
        perform: () => false,
        predicate: () => false,
        keyTest: () => false,
        trackEvent: false,
      });
  }, []);
  const onChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      a: AppState,
      files: BinaryFiles,
    ) => {
      const t = a.activeTool.type;
      if (t !== 'freedraw') marker.current = false;
      if (
        [
          'selection',
          'freedraw',
          'eraser',
          'line',
          'arrow',
          'rectangle',
          'ellipse',
          'text',
          'hand',
        ].includes(t)
      )
        setTool(
          t === 'freedraw' && marker.current ? 'highlighter' : (t as Tool),
        );
      setEmpty(!elements.some((e) => !e.isDeleted));
      setSelected(Object.values(a.selectedElementIds).some(Boolean));
      setGrid(a.gridModeEnabled);
      setZoom(a.zoom.value);
      if (t === 'freedraw') setStrokeWidth(a.currentItemStrokeWidth);
      const state = canvasState(a),
        sig = `${getSceneVersion(elements)}:${elements.length}:${JSON.stringify(state)}`;
      if (sig === signature.current) return;
      const first = signature.current === '';
      signature.current = sig;
      if (!readonlyRef.current && (!first || initial?.board.revision === 0))
        autosave.current?.capture({ elements, appState: state, files });
    },
    [initial],
  );
  function changeWidth(pixels: number) {
    if (!api.current || readonlyRef.current) return;
    const width = pixels / INK_SCALE;
    if (marker.current) {
      brushWidths.current!.highlighter = width;
      pref('marker-width', String(width));
    } else {
      brushWidths.current!.pen = width;
      pref('pen-width', String(width));
    }
    setStrokeWidth(width);
    api.current.updateScene({
      appState: { currentItemStrokeWidth: width },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }
  function clearBoard() {
    const editor = api.current;
    if (!editor || readonlyRef.current) return;
    const elements = editor.getSceneElementsIncludingDeleted();
    editor.updateScene({
      elements: deleteObjects(
        elements,
        new Set(elements.map((e) => e.id)),
        false,
      ),
      appState: {
        selectedElementIds: {},
        selectedGroupIds: {},
        editingGroupId: null,
        editingTextElement: null,
        newElement: null,
        elementsToHighlight: null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    setModal(null);
    setNotice('Board cleared. Use Undo to bring everything back.');
  }
  function rename(value: string) {
    if (!board || readonlyRef.current) return;
    setBoard({ ...board, title: value });
    boardRef.current = { ...board, title: value };
    if (autosave.current) {
      autosave.current.board = {
        ...autosave.current.board,
        title: value.trim() || 'Untitled board',
      };
      autosave.current.capture(scene());
    }
    document.title = `${value || 'Untitled board'} — FreeBoard`;
  }
  function zoomBy(factor: number) {
    const editor = api.current;
    if (!editor) return;
    const a = editor.getAppState(),
      next = zoomAt(
        { x: a.offsetLeft + a.width / 2, y: a.offsetTop + a.height / 2 },
        a.zoom.value * factor,
        a,
      );
    editor.updateScene({
      appState: {
        scrollX: next.scrollX,
        scrollY: next.scrollY,
        zoom: { value: next.zoom.value as AppState['zoom']['value'] },
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }
  async function performExport(
    format: 'json' | 'png' | 'svg',
    selection: boolean,
    background: boolean,
  ) {
    if (!boardRef.current) throw new Error('The board is still opening.');
    const s = scene(),
      elements = selection
        ? selectedScene(
            s.elements,
            api.current?.getAppState().selectedElementIds ?? {},
          )
        : s.elements.filter((e) => !e.isDeleted),
      exportScene = { ...s, elements, files: sceneFiles(elements, s.files) };
    const blob =
      format === 'json'
        ? backupBlob(backupFor(boardRef.current, exportScene))
        : await exportArtwork(exportScene, format, background);
    return {
      blob,
      name: `${filename(boardRef.current.title)}${selection ? '-selection' : ''}.${format === 'json' ? 'freeboard.json' : format}`,
    };
  }
  async function quickBackup() {
    try {
      const prepared = await performExport('json', false, true);
      download(prepared.blob, prepared.name);
      setNotice('Your editable backup is ready.');
    } catch (e) {
      reportError(e);
    }
  }
  async function applyUpdate() {
    if (!(await flush())) return;
    if (autosave.current?.dirty) return;
    const apply = update;
    if (!apply) return;
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => window.location.reload(),
      { once: true },
    );
    apply();
  }
  async function persistStorage() {
    if (navigator.storage?.persist) {
      const granted = await navigator.storage.persist();
      setNotice(
        granted
          ? 'This browser granted persistent storage. Keep downloading backups.'
          : 'This browser manages storage automatically. Download backups for important work.',
      );
    } else
      setNotice(
        'Download backups for important work; this browser manages storage automatically.',
      );
  }
  async function tryEditing() {
    if (!boardRef.current) return;
    if (autosave.current?.dirty) {
      setError(
        'Make a copy to keep your unsaved edits before reopening the saved board.',
      );
      return;
    }
    try {
      const next = await repo.load(boardRef.current.id);
      await load(next.board, next.files, next.recovered);
    } catch (e) {
      reportError(e);
    }
  }
  const activeStatus =
    status === 'saved'
      ? 'Saved on this device'
      : status === 'saving'
        ? 'Saving…'
        : status === 'pending'
          ? 'Unsaved changes'
          : 'Not saved · backup now';
  const isVertical = dockOrientation === 'vertical';
  const dockStyle: React.CSSProperties | undefined = dockPosition
    ? {
        left: `${dockPosition.x}px`,
        top: `${dockPosition.y}px`,
        transform: 'none',
        right: 'auto',
        bottom: 'auto',
      }
    : isVertical
      ? {
          left: '18px',
          top: '18px',
          transform: 'none',
        }
      : undefined;

  const floatingPanelStyle: React.CSSProperties | undefined = (() => {
    if (!dockPosition && !isVertical) return undefined;
    const host = canvasHost.current?.getBoundingClientRect();
    const dock = dockRef.current?.getBoundingClientRect();
    if (!host || !dock) return undefined;

    const dockLeft = dock.left - host.left;
    const dockTop = dock.top - host.top;

    if (isVertical) {
      const panelWidth = 240;
      const placeRight = dockLeft + dock.width + 10;
      const left =
        placeRight + panelWidth > host.width - 10
          ? Math.max(10, dockLeft - panelWidth - 10)
          : placeRight;
      const top = Math.max(10, Math.min(dockTop + 54, host.height - 60));
      return {
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        transform: 'none',
      };
    } else {
      const centerX = dockLeft + dock.width / 2;
      let top = dockTop + dock.height + 10;
      if (top + 50 > host.height) {
        top = Math.max(10, dockTop - 52);
      }
      return {
        left: `${Math.round(centerX)}px`,
        top: `${Math.round(top)}px`,
        transform: 'translateX(-50%)',
      };
    }
  })();
  return (
    <div
      className={`app-shell ${presentation ? 'is-presenting' : ''}`}
      aria-busy={busy}
    >
      <header className="app-header">
        <button
          className="brand"
          onClick={() => void openLibrary()}
          aria-label="FreeBoard workspace"
        >
          <img src={`${import.meta.env.BASE_URL}icons/freeboard.svg`} alt="" />
          <span>FreeBoard</span>
        </button>
        <div className="header-divider" />
        <div className="document-meta">
          <label className="sr-only" htmlFor="board-title">
            Board title
          </label>
          <input
            id="board-title"
            value={board?.title ?? 'Opening workspace…'}
            maxLength={120}
            disabled={!board || readOnly}
            onChange={(e) => rename(e.target.value)}
            onBlur={() => {
              if (board && !board.title.trim()) rename('Untitled board');
            }}
          />
          <span className={`save-state ${status}`} role="status">
            {status === 'saved' ? (
              <Check size={12} />
            ) : status === 'saving' ? (
              <LoaderCircle size={12} className="spin" />
            ) : status === 'error' ? (
              <AlertCircle size={12} />
            ) : (
              <span className="pending-dot" />
            )}
            {readOnly ? 'Viewing · open in another tab' : activeStatus}
          </span>
        </div>
        <div className="header-actions">
          <button
            className="icon-button clear-board"
            aria-label="Clear board"
            title="Clear board"
            disabled={!initial || empty || readOnly || busy}
            onClick={() => setModal('clear')}
          >
            <Trash2 size={17} />
          </button>
          <button
            className="button secondary boards-button"
            aria-label="Your boards"
            onClick={() => void openLibrary()}
          >
            <FolderOpen size={17} />
            <span>Your boards</span>
            <ChevronDown size={13} />
          </button>
          <button
            className="button primary export-button"
            disabled={!board}
            onClick={() => setModal('export')}
          >
            <ArrowDownToLine size={17} />
            <span>Export</span>
          </button>
        </div>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => void quickBackup()}>Download backup</button>
          {!readOnly && (
            <button onClick={() => void flush()}>Retry save</button>
          )}
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setError('')}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {readOnly && (
        <div className="readonly-banner">
          <span>
            This board is open elsewhere. Your saved work is protected.
          </span>
          <button onClick={() => void copyCurrent()}>
            Make a copy to edit
          </button>
          <button onClick={() => void tryEditing()}>Try editing again</button>
        </div>
      )}
      <main
        ref={canvasHost}
        className={`canvas-area ${tool === 'freedraw' || tool === 'highlighter' ? 'is-inking' : ''}`}
        aria-label="Whiteboard workspace"
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDropCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const file = e.dataTransfer.files[0];
          if (file && !readOnly && !busy) receiveFile(file);
        }}
      >
        {initial ? (
          <Excalidraw
            key={`${initial.board.id}:${initial.epoch}`}
            excalidrawAPI={bindEditor}
            initialData={{
              elements: initial.board.elements,
              files: initial.files,
              appState: {
                ...initial.board.appState,
                currentItemFontFamily: 2,
                currentItemStrokeColor: '#171717',
                currentItemRoughness: 0,
                currentItemFillStyle: 'solid',
                currentItemRoundness: 'round',
                currentItemOpacity: 100,
                currentItemStrokeWidth: brushWidths.current!.pen,
              },
              scrollToContent:
                initial.board.elements.length > 0 &&
                initial.board.revision <= 1,
            }}
            onChange={onChange}
            viewModeEnabled={readOnly || presentation || busy}
            zenModeEnabled={presentation}
            theme="light"
            name={board?.title}
            handleKeyboardGlobally={modal === null}
            autoFocus
            langCode="en"
            aiEnabled={false}
            validateEmbeddable={false}
            onLinkOpen={(_e, event) => event.preventDefault()}
            onPaste={async (data) => {
              try {
                if (data.mixedContent?.some((c) => c.type === 'imageUrl'))
                  throw new Error(
                    'Insert a local PNG, JPEG, or WebP image instead of a remote image link.',
                  );
                if (data.elements)
                  data.elements = validateElements(data.elements);
                if (data.files) {
                  data.files = validateFiles(data.files);
                  for (const f of Object.values(data.files))
                    await imageDimensions(f.dataURL);
                }
                return true;
              } catch (e) {
                reportError(e);
                return false;
              }
            }}
            onPointerDown={() => {
              if (marker.current)
                api.current?.updateScene({
                  appState: { currentItemOpacity: 30 },
                  captureUpdate: CaptureUpdateAction.NEVER,
                });
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
              {!presentation && (
                <div className="desktop-clock">
                  <LocalClock />
                </div>
              )}
            </Footer>
          </Excalidraw>
        ) : (
          <div className="opening-state">
            <LoaderCircle className="spin" size={25} />
            <span>Opening your workspace…</span>
          </div>
        )}
        <canvas ref={inkCanvas} className="pen-ink-layer" aria-hidden="true" />
        <div
          ref={eraserCursor}
          className="eraser-cursor"
          hidden
          aria-hidden="true"
        >
          <span>Release to erase</span>
        </div>
        {!presentation &&
          !readOnly &&
          !busy &&
          (tool === 'freedraw' || tool === 'highlighter') && (
            <div className="ink-properties" style={floatingPanelStyle}>
              <label htmlFor="ink-width">
                {tool === 'highlighter' ? 'Marker width' : 'Pen width'}
              </label>
              <span className="width-preview" aria-hidden="true">
                <i
                  style={{
                    height: Math.min(12, strokeWidth * INK_SCALE),
                    opacity: tool === 'highlighter' ? 0.3 : 1,
                  }}
                />
              </span>
              <input
                id="ink-width"
                aria-label={
                  tool === 'highlighter' ? 'Marker width' : 'Pen width'
                }
                type="range"
                min={tool === 'highlighter' ? 8 : 0.5}
                max={tool === 'highlighter' ? 80 : 12}
                step={tool === 'highlighter' ? 1 : 0.25}
                value={strokeWidth * INK_SCALE}
                aria-valuetext={`${Number((strokeWidth * INK_SCALE).toFixed(2))} pixels`}
                title="Width at 100% zoom; stylus pressure can vary it"
                onChange={(e) => changeWidth(Number(e.target.value))}
              />
              <output htmlFor="ink-width">
                {Number((strokeWidth * INK_SCALE).toFixed(2))}
                <small> px</small>
              </output>
            </div>
          )}
        {!presentation && !readOnly && tool === 'eraser' && (
          <div className="eraser-hint" style={floatingPanelStyle}>
            Hold to grow · Release to erase · Undo to restore
          </div>
        )}
        {!presentation && !readOnly && initial && (
          <div
            ref={dockRef}
            className={`tool-dock ${dockOrientation === 'vertical' ? 'is-vertical' : ''} ${isDragging ? 'is-dragging' : ''}`}
            role="toolbar"
            aria-label="Drawing tools"
            style={dockStyle}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest('button, input, textarea'))
                return;
              startDrag(e);
            }}
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).closest('button, input, textarea'))
                return;
              startDrag(e);
            }}
            onDoubleClick={(e) => {
              if ((e.target as HTMLElement).closest('button, input, textarea'))
                return;
              resetDockPosition();
            }}
          >
            <div
              className="tool-drag-handle"
              role="button"
              tabIndex={0}
              aria-label="Drag toolbar to move. Double-click to reset."
              title="Drag to move · Double-click to reset"
              onPointerDown={startDrag}
              onMouseDown={startDrag}
              onDoubleClick={resetDockPosition}
            >
              {dockOrientation === 'vertical' ? (
                <GripHorizontal size={15} />
              ) : (
                <GripVertical size={15} />
              )}
            </div>
            {tools.map((t) => (
              <button
                key={t.id}
                aria-label={`${t.name} (${t.key})`}
                aria-pressed={tool === t.id}
                title={`${t.name} · ${t.key}`}
                className={`tool ${tool === t.id ? 'active' : ''} ${t.id === 'line' ? 'tool-break' : ''}`}
                onClick={() => chooseTool(t.id)}
              >
                <t.icon size={19} />
                <span className="tool-key">{t.key}</span>
              </button>
            ))}
            <span className="tool-separator" />
            <button
              className="tool"
              aria-label="Sticky note (N)"
              title="Sticky note · N"
              onClick={addSticky}
            >
              <StickyNote size={19} />
              <span className="tool-key">N</span>
            </button>
            <button
              className="tool"
              aria-label="Insert image (I)"
              title="Insert image · I"
              onClick={() => imageInput.current?.click()}
            >
              <ImagePlus size={19} />
              <span className="tool-key">I</span>
            </button>
            <span className="tool-separator" />
            <button
              type="button"
              className="tool tool-orientation"
              aria-label={
                dockOrientation === 'vertical'
                  ? 'Switch to horizontal toolbar (Alt+O)'
                  : 'Switch to vertical toolbar (Alt+O)'
              }
              title={
                dockOrientation === 'vertical'
                  ? 'Switch to horizontal toolbar · Alt+O'
                  : 'Switch to vertical toolbar · Alt+O'
              }
              onClick={toggleOrientation}
            >
              {dockOrientation === 'vertical' ? (
                <Rows2 size={18} />
              ) : (
                <Columns2 size={18} />
              )}
              <span className="tool-key">⌥O</span>
            </button>
          </div>
        )}
        {empty && !presentation && initial && (
          <div className="empty-guide">
            <div className="empty-visual">
              <TemplatePreview kind="welcome" />
            </div>
            <span className="eyebrow">A CLEAR SPACE. A FRESH START.</span>
            <h1>Make space for ideas.</h1>
            <p>
              Sketch a thought. Connect the dots.
              <br />
              Bring your next idea into focus.
            </p>
            <div className="empty-templates">
              <button onClick={() => void create('lesson')}>
                Lesson board <ArrowUpRight size={13} />
              </button>
              <button onClick={() => void create('brainstorm')}>
                Brainstorm <ArrowUpRight size={13} />
              </button>
              <button onClick={() => void create('flowchart')}>
                Flowchart <ArrowUpRight size={13} />
              </button>
            </div>
            <span className="empty-tip">
              Pick a tool above, or press <kbd>P</kbd> to start drawing
            </span>
          </div>
        )}
        {!presentation && (
          <div className="canvas-utilities">
            <button
              className={`utility ${grid ? 'active' : ''}`}
              aria-label="Toggle grid"
              aria-pressed={grid}
              title="Toggle grid"
              onClick={() =>
                api.current?.updateScene({
                  appState: { gridModeEnabled: !grid },
                  captureUpdate: CaptureUpdateAction.NEVER,
                })
              }
            >
              <Grid2X2 size={17} />
            </button>
            <button
              className="utility"
              aria-label="Fit content"
              title="Fit content · Shift+1"
              onClick={() =>
                api.current?.scrollToContent(undefined, {
                  fitToContent: true,
                  animate: true,
                  viewportZoomFactor: 0.8,
                })
              }
            >
              <Expand size={17} />
            </button>
            <button
              className="utility"
              aria-label="Reset view"
              title="Reset view"
              onClick={() =>
                api.current?.updateScene({
                  appState: {
                    scrollX: 0,
                    scrollY: 0,
                    zoom: { value: 1 as AppState['zoom']['value'] },
                  },
                  captureUpdate: CaptureUpdateAction.NEVER,
                })
              }
            >
              <Undo2 size={17} />
            </button>
            <span />
            <button
              className="utility"
              aria-label="Presentation mode"
              title="Presentation mode"
              onClick={() => setPresentation(true)}
            >
              <Presentation size={18} />
            </button>
            <button
              className="utility"
              aria-label="Help and shortcuts"
              title="Help and shortcuts"
              onClick={() => setModal('help')}
            >
              <HelpCircle size={18} />
            </button>
          </div>
        )}
        {presentation && (
          <button
            className="presentation-exit button secondary"
            onClick={() => setPresentation(false)}
          >
            <X size={16} />
            Exit presentation <kbd>Esc</kbd>
          </button>
        )}
        {!presentation && (
          <div className="mobile-zoom" aria-label="Canvas zoom">
            <button
              className="utility"
              aria-label="Zoom out"
              onClick={() => zoomBy(1 / 1.2)}
            >
              <Minus size={16} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              className="utility"
              aria-label="Zoom in"
              onClick={() => zoomBy(1.2)}
            >
              <Plus size={16} />
            </button>
            <LocalClock />
          </div>
        )}
        {busy && <div className="busy-shield" aria-hidden="true" />}
        {busy && (
          <div className="busy-indicator" role="status">
            <LoaderCircle size={16} className="spin" />
            Working…
          </div>
        )}
      </main>
      <footer className="workspace-footer">
        <div className="footer-left">
          <span className={`device-state ${!online ? 'is-offline' : ''}`}>
            {!online ? <CloudOff size={13} /> : <span className="online-dot" />}
            {!online
              ? 'Offline · keep creating'
              : offline === 'ready'
                ? 'Available offline'
                : offline === 'preparing'
                  ? 'Preparing offline access…'
                  : 'Local workspace'}
          </span>
          <span className="footer-separator">/</span>
          <button onClick={() => setModal('privacy')}>
            <ShieldCheck size={13} />
            Private by design
          </button>
        </div>
        <span className="footer-hint">
          Space to pan <span>·</span> Scroll to explore <span>·</span> Pinch to
          zoom
        </span>
        <div className="footer-right">
          {install && (
            <button
              onClick={() => {
                void (
                  install as Event & { prompt: () => Promise<void> }
                ).prompt();
                setInstall(null);
              }}
            >
              <ArrowDownToLine size={13} />
              Install app
            </button>
          )}
          <button
            onClick={() => void persistStorage()}
            title="Ask this browser to protect local storage"
          >
            <ShieldCheck size={13} />
            <span>Protect storage</span>
          </button>
        </div>
      </footer>
      {update && (
        <div className="update-toast" role="status">
          <span>A fresh version is ready.</span>
          <button onClick={() => void applyUpdate()}>Save & restart</button>
          <button aria-label="Dismiss update" onClick={() => setUpdate(null)}>
            <X size={14} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={15} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {modal === 'library' && (
        <BoardLibrary
          boards={boards}
          drafts={drafts}
          currentId={board?.id}
          loading={libraryLoading}
          busy={busy}
          error={error}
          onBackup={() => void quickBackup()}
          onRetry={() => {
            setError('');
            void refreshLibrary();
          }}
          onClose={closeModal}
          onOpen={(id) => void open(id)}
          onCreate={(id) => void create(id)}
          onDuplicate={(id) => void duplicate(id)}
          onTrash={(b) => void trash(b)}
          onRestore={(b) => void trash(b, true)}
          onImport={() => fileInput.current?.click()}
          onRescue={(d) => void rescue(d)}
        />
      )}
      {modal === 'clear' && (
        <Dialog title="Clear this board?" onClose={closeModal}>
          <p className="clear-description">
            Remove every object from{' '}
            <strong>{board?.title || 'this board'}</strong>, including locked
            objects. You can use Undo to restore them during this session.
          </p>
          <div className="dialog-footer">
            <button className="button secondary" onClick={closeModal}>
              Keep board
            </button>
            <button className="button primary" onClick={clearBoard}>
              Clear everything
            </button>
          </div>
        </Dialog>
      )}
      {modal === 'export' && (
        <ExportDialog
          onClose={closeModal}
          selected={selected}
          onExport={performExport}
        />
      )}
      {(modal === 'help' || modal === 'privacy') && (
        <Help onClose={closeModal} privacy={modal === 'privacy'} />
      )}
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        aria-label="Import editable backup"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importBackup(f);
          e.target.value = '';
        }}
      />
      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Insert local image"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void insertImage(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
