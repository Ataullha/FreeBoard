import { createId } from './id';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';

export const DOCUMENT_VERSION = 2;
export const MAX_IMPORT_BYTES = 40 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 20_000_000;
export const MAX_OBJECTS = 10_000;
export type CanvasState = Pick<
  AppState,
  | 'viewBackgroundColor'
  | 'gridSize'
  | 'gridModeEnabled'
  | 'scrollX'
  | 'scrollY'
  | 'zoom'
>;
export interface Scene {
  elements: readonly ExcalidrawElement[];
  appState: CanvasState;
  files: BinaryFiles;
}
export interface BoardRecord {
  id: string;
  title: string;
  schemaVersion: 2;
  createdAt: number;
  updatedAt: number;
  revision: number;
  elements: readonly ExcalidrawElement[];
  appState: CanvasState;
  assetIds: string[];
  thumbnail?: string;
  deletedAt: number | null;
}
export interface BoardBackup extends Scene {
  format: 'freeboard';
  version: 2;
  title: string;
  createdAt: number;
  updatedAt: number;
}
export const defaultCanvas = (): CanvasState => ({
  viewBackgroundColor: '#ffffff',
  gridSize: 20,
  gridModeEnabled: false,
  scrollX: 0,
  scrollY: 0,
  zoom: { value: 1 as AppState['zoom']['value'] },
});
export function canvasState(state: Partial<AppState>): CanvasState {
  return {
    ...defaultCanvas(),
    ...Object.fromEntries(
      [
        'viewBackgroundColor',
        'gridSize',
        'gridModeEnabled',
        'scrollX',
        'scrollY',
        'zoom',
      ]
        .filter((k) => state[k as keyof AppState] !== undefined)
        .map((k) => [k, state[k as keyof AppState]]),
    ),
  };
}
export function makeBoard(
  title = 'Untitled board',
  scene?: Partial<Scene>,
): BoardRecord {
  const now = Date.now();
  return {
    id: createId(),
    title: title.trim().slice(0, 120) || 'Untitled board',
    schemaVersion: DOCUMENT_VERSION,
    createdAt: now,
    updatedAt: now,
    revision: 0,
    elements: scene?.elements ?? [],
    appState: scene?.appState ?? defaultCanvas(),
    assetIds: Object.keys(scene?.files ?? {}),
    deletedAt: null,
  };
}
export function backupFor(board: BoardRecord, scene: Scene): BoardBackup {
  return {
    format: 'freeboard',
    version: DOCUMENT_VERSION,
    title: board.title,
    createdAt: board.createdAt,
    updatedAt: Date.now(),
    ...scene,
  };
}
export function sceneFiles(
  elements: readonly ExcalidrawElement[],
  files: BinaryFiles,
): BinaryFiles {
  const ids = new Set<string>(
    elements.flatMap((e) => (e.type === 'image' && e.fileId ? [e.fileId] : [])),
  );
  return Object.fromEntries(
    Object.entries(files).filter(([id]) => ids.has(id)),
  );
}
export function selectedScene(
  elements: readonly ExcalidrawElement[],
  selected: Record<string, boolean>,
): readonly ExcalidrawElement[] {
  const ids = new Set(Object.keys(selected).filter((id) => selected[id]));
  const groups = new Set(
    elements.filter((e) => ids.has(e.id)).flatMap((e) => e.groupIds),
  );
  for (const e of elements)
    if (e.groupIds.some((g) => groups.has(g))) ids.add(e.id);
  for (const e of elements)
    if (e.type === 'text' && e.containerId && ids.has(e.containerId))
      ids.add(e.id);
  return elements
    .filter((e) => !e.isDeleted && ids.has(e.id))
    .map((e) => ({
      ...e,
      boundElements: e.boundElements?.filter((b) => ids.has(b.id)) ?? null,
      ...(e.type === 'text'
        ? {
            containerId:
              e.containerId && ids.has(e.containerId) ? e.containerId : null,
          }
        : {}),
      ...(e.type === 'arrow'
        ? {
            startBinding:
              e.startBinding && ids.has(e.startBinding.elementId)
                ? e.startBinding
                : null,
            endBinding:
              e.endBinding && ids.has(e.endBinding.elementId)
                ? e.endBinding
                : null,
          }
        : {}),
    })) as ExcalidrawElement[];
}
