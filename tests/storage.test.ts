import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { openDB } from 'idb';
import { BoardRepository, ConflictError } from '../src/storage/repository';
import { makeBoard } from '../src/model/document';
import { scene } from './fixtures';
let repo: BoardRepository;
beforeEach(() => {
  repo = new BoardRepository(`freeboard-test-${crypto.randomUUID()}`);
});
afterEach(() => repo.close());
describe('transactional browser storage', () => {
  it('creates, saves, reopens, duplicates, trashes, and restores a board', async () => {
    const b = await repo.create(makeBoard('Lesson', scene()));
    const saved = await repo.save(b, scene(60), 'writer');
    expect(saved.revision).toBe(2);
    const loaded = await repo.load(b.id);
    expect(loaded.board.elements[0].x).toBe(60);
    const copy = await repo.duplicate(b.id);
    expect(copy.id).not.toBe(b.id);
    expect(copy.elements).toEqual(saved.elements);
    await repo.trash(saved);
    expect((await repo.load(b.id)).board.deletedAt).toBeTypeOf('number');
    await repo.trash((await repo.load(b.id)).board, true);
    expect((await repo.load(b.id)).board.deletedAt).toBeNull();
  });
  it('recovers an interrupted draft before the debounced full save', async () => {
    const b = await repo.create(makeBoard('Interrupted', scene()));
    await repo.checkpoint(b, scene(222), 'crashed-writer');
    const loaded = await repo.load(b.id);
    expect(loaded.recovered).toBe(true);
    expect(loaded.board.elements[0].x).toBe(222);
    expect((await repo.load(b.id, false)).board.elements[0].x).toBe(0);
    await repo.save(
      loaded.board,
      { ...scene(), elements: loaded.board.elements },
      'crashed-writer',
    );
    expect((await repo.drafts()).length).toBe(0);
  });
  it('retains stale drafts as rescue copies when another tab saves', async () => {
    const b = await repo.create(makeBoard('Lesson', scene()));
    await repo.checkpoint(b, scene(100), 'old');
    await repo.save(b, scene(200), 'new');
    expect((await repo.load(b.id)).board.elements[0].x).toBe(200);
    const [draft] = await repo.drafts();
    const rescued = await repo.rescue(draft);
    expect(rescued.elements[0].x).toBe(100);
    expect(rescued.id).not.toBe(b.id);
  });
  it('rejects stale saves and checkpoints without overwriting a newer revision', async () => {
    const b = await repo.create(makeBoard('Shared', scene()));
    await repo.save(b, scene(50), 'first');
    await expect(repo.save(b, scene(999), 'stale')).rejects.toBeInstanceOf(
      ConflictError,
    );
    await expect(
      repo.checkpoint(b, scene(999), 'stale'),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await repo.load(b.id)).board.elements[0].x).toBe(50);
  });
  it('allows only one of two concurrent writes at the same revision to commit', async () => {
    const b = await repo.create(makeBoard('Race', scene()));
    const results = await Promise.allSettled([
      repo.save(b, scene(1), 'a'),
      repo.save(b, scene(2), 'b'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await repo.load(b.id)).board.revision).toBe(2);
  });
  it('migrates a v1 IndexedDB database and keeps its boards', async () => {
    const name = `freeboard-v1-${crypto.randomUUID()}`,
      old = await openDB(name, 1, {
        upgrade(db) {
          db.createObjectStore('boards', { keyPath: 'id' });
        },
      });
    const b = makeBoard('Old board', scene());
    await old.put('boards', {
      ...b,
      schemaVersion: 1,
      revision: undefined,
      assetIds: undefined,
    });
    old.close();
    const migrated = new BoardRepository(name);
    try {
      const loaded = await migrated.load(b.id);
      expect(loaded.board.schemaVersion).toBe(2);
      expect(loaded.board.revision).toBe(0);
      expect(loaded.board.elements).toEqual(b.elements);
    } finally {
      await migrated.close();
    }
  });
});
it('isolates imported image identifiers between boards', async () => {
  const first = {
    id: 'asset',
    mimeType: 'image/png',
    dataURL: 'data:image/png;base64,first',
    created: 1,
  } as never;
  const second = {
    id: 'asset',
    mimeType: 'image/png',
    dataURL: 'data:image/png;base64,second',
    created: 1,
  } as never;
  const a = await repo.create(
    { ...makeBoard('First', scene()), assetIds: ['asset'] },
    { asset: first },
  );
  const b = await repo.create(
    { ...makeBoard('Second', scene()), assetIds: ['asset'] },
    { asset: second },
  );
  expect((await repo.load(a.id)).files.asset.dataURL).toBe(
    'data:image/png;base64,first',
  );
  expect((await repo.load(b.id)).files.asset.dataURL).toBe(
    'data:image/png;base64,second',
  );
});
