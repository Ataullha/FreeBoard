import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { BinaryFileData, BinaryFiles } from '@excalidraw/excalidraw/types';
import { defaultCanvas, makeBoard, sceneFiles } from '../model/document';
import type { BoardRecord, Scene } from '../model/document';

export class ConflictError extends Error {
  constructor() {
    super('This board changed in another tab. Make a copy to keep your edits.');
    this.name = 'ConflictError';
  }
}
export class StorageError extends Error {
  constructor(cause?: unknown) {
    super(
      cause instanceof DOMException && cause.name === 'QuotaExceededError'
        ? 'Browser storage is full. Download a backup now, then free space and retry.'
        : 'FreeBoard could not save to this browser. Download a backup now and retry.',
    );
    this.name = 'StorageError';
  }
}
export interface Draft {
  key: string;
  boardId: string;
  writerId: string;
  baseRevision: number;
  board: BoardRecord;
  files: BinaryFiles;
  updatedAt: number;
}
function migrateBoard(raw: BoardRecord): BoardRecord {
  if (raw.schemaVersion > 2)
    throw new Error(
      'This board was saved by a newer version of FreeBoard. Please update the app.',
    );
  return {
    ...raw,
    schemaVersion: 2,
    appState: {
      ...defaultCanvas(),
      ...raw.appState,
      gridSize: raw.appState?.gridSize ?? 20,
    },
    assetIds: raw.assetIds ?? [],
    deletedAt: raw.deletedAt ?? null,
    revision: raw.revision ?? 0,
  };
}
export class BoardRepository {
  private database?: Promise<IDBPDatabase>;
  // Retain the original database so the FreeBoard rename preserves saved boards.
  constructor(private name = 'boardpilot') {}
  private db() {
    return (this.database ??= openDB(this.name, 3, {
      upgrade(db, _old, _new, tx) {
        if (!db.objectStoreNames.contains('boards'))
          db.createObjectStore('boards', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('assets'))
          db.createObjectStore('assets', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('boardAssets'))
          db.createObjectStore('boardAssets', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('drafts'))
          db.createObjectStore('drafts', { keyPath: 'key' });
        // Storage v1 used the same board store; document fields migrate on read.
        if (tx.objectStore('boards').indexNames.contains('legacy'))
          tx.objectStore('boards').deleteIndex('legacy');
      },
      blocking: () => {
        void this.database?.then((db) => {
          db.close();
          this.database = undefined;
        });
      },
      terminated: () => {
        this.database = undefined;
      },
    }).catch((error) => {
      this.database = undefined;
      throw new StorageError(error);
    }));
  }
  async list(): Promise<BoardRecord[]> {
    try {
      return ((await (await this.db()).getAll('boards')) as BoardRecord[])
        .map(migrateBoard)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (e) {
      if (e instanceof Error && e.message.includes('newer version')) throw e;
      throw new StorageError(e);
    }
  }
  async load(
    id: string,
    recover = true,
  ): Promise<{ board: BoardRecord; files: BinaryFiles; recovered: boolean }> {
    const db = await this.db(),
      raw = (await db.get('boards', id)) as BoardRecord | undefined;
    if (!raw) throw new Error('That board is no longer available.');
    const saved = migrateBoard(raw);
    const drafts = recover
      ? (await this.drafts())
          .filter((d) => d.boardId === id && d.baseRevision === saved.revision)
          .sort((a, b) => b.updatedAt - a.updatedAt)
      : [];
    const draft = drafts[0];
    const board = draft ? { ...draft.board, revision: saved.revision } : saved;
    const files = await this.filesFor(board);
    return { board, files, recovered: !!draft };
  }
  async create(
    board: BoardRecord,
    files: BinaryFiles = {},
  ): Promise<BoardRecord> {
    try {
      const db = await this.db(),
        tx = db.transaction(['boards', 'boardAssets'], 'readwrite');
      await tx.objectStore('boards').add({ ...board, revision: 1 });
      for (const file of Object.values(files))
        await tx
          .objectStore('boardAssets')
          .put({ ...file, key: `${board.id}:${file.id}` });
      await tx.done;
      return { ...board, revision: 1 };
    } catch (e) {
      throw new StorageError(e);
    }
  }
  async checkpoint(
    board: BoardRecord,
    scene: Scene,
    writerId: string,
  ): Promise<void> {
    const db = await this.db(),
      tx = db.transaction(['boards', 'boardAssets', 'drafts'], 'readwrite');
    try {
      const current = (await tx.objectStore('boards').get(board.id)) as
        BoardRecord | undefined;
      if (!current || current.revision !== board.revision || current.deletedAt)
        throw new ConflictError();
      const files = sceneFiles(scene.elements, scene.files);
      for (const file of Object.values(files))
        await tx
          .objectStore('boardAssets')
          .put({ ...file, key: `${board.id}:${file.id}` });
      await tx.objectStore('drafts').put({
        key: `${board.id}:${writerId}`,
        boardId: board.id,
        writerId,
        baseRevision: board.revision,
        board: {
          ...board,
          elements: scene.elements,
          appState: scene.appState,
          assetIds: Object.keys(files),
        },
        files: {},
        updatedAt: Date.now(),
      } satisfies Draft);
      await tx.done;
    } catch (e) {
      try {
        tx.abort();
      } catch {}
      void tx.done.catch(() => {});
      if (e instanceof ConflictError) throw e;
      throw new StorageError(e);
    }
  }
  async save(
    board: BoardRecord,
    scene: Scene,
    writerId: string,
    thumbnail?: string,
  ): Promise<BoardRecord> {
    const db = await this.db(),
      tx = db.transaction(['boards', 'boardAssets', 'drafts'], 'readwrite');
    try {
      const current = (await tx.objectStore('boards').get(board.id)) as
        BoardRecord | undefined;
      if (!current || current.revision !== board.revision || current.deletedAt)
        throw new ConflictError();
      const files = sceneFiles(scene.elements, scene.files);
      const next: BoardRecord = {
        ...board,
        elements: scene.elements,
        appState: scene.appState,
        assetIds: Object.keys(files),
        updatedAt: Date.now(),
        revision: board.revision + 1,
        thumbnail: thumbnail ?? board.thumbnail,
      };
      for (const file of Object.values(files))
        await tx
          .objectStore('boardAssets')
          .put({ ...file, key: `${board.id}:${file.id}` });
      await tx.objectStore('boards').put(next);
      await tx.objectStore('drafts').delete(`${board.id}:${writerId}`);
      await tx.done;
      return next;
    } catch (e) {
      try {
        tx.abort();
      } catch {}
      void tx.done.catch(() => {});
      if (e instanceof ConflictError) throw e;
      throw new StorageError(e);
    }
  }
  async trash(board: BoardRecord, restore = false): Promise<void> {
    const db = await this.db(),
      tx = db.transaction('boards', 'readwrite');
    const current = (await tx.store.get(board.id)) as BoardRecord | undefined;
    if (!current || current.revision !== board.revision) {
      try {
        tx.abort();
      } catch {}
      void tx.done.catch(() => {});
      throw new ConflictError();
    }
    await tx.store.put({
      ...current,
      deletedAt: restore ? null : Date.now(),
      revision: current.revision + 1,
      updatedAt: Date.now(),
    });
    await tx.done;
  }
  async duplicate(id: string): Promise<BoardRecord> {
    const { board, files } = await this.load(id);
    return this.create(
      makeBoard(`${board.title} (copy)`, {
        elements: board.elements,
        appState: board.appState,
        files,
      }),
      files,
    );
  }
  async drafts(): Promise<Draft[]> {
    return (await (await this.db()).getAll('drafts')) as Draft[];
  }
  async rescue(draft: Draft): Promise<BoardRecord> {
    const db = await this.db();
    const files = await this.filesFor(draft.board);
    const board = await this.create(
      makeBoard(`${draft.board.title} (recovered copy)`, {
        elements: draft.board.elements,
        appState: draft.board.appState,
        files,
      }),
      files,
    );
    await db.delete('drafts', draft.key);
    return board;
  }
  private async filesFor(board: BoardRecord): Promise<BinaryFiles> {
    const db = await this.db(),
      files: BinaryFiles = {};
    for (const id of board.assetIds) {
      const asset =
        (await db.get('boardAssets', `${board.id}:${id}`)) ??
        (await db.get('assets', id));
      if (asset) {
        const { key: _key, ...file } = asset;
        files[id] = file as BinaryFileData;
      }
    }
    return files;
  }
  async close() {
    (await this.database)?.close();
    this.database = undefined;
  }
}
