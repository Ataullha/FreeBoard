import { afterEach, describe, it, expect, vi } from 'vitest';
import { Autosave } from '../src/storage/autosave';
import { BoardRepository } from '../src/storage/repository';
import { makeBoard } from '../src/model/document';
import { scene } from './fixtures';
afterEach(() => vi.restoreAllMocks());
describe('autosave truthfulness and recovery', () => {
  it('never reports Saved when the storage write fails', async () => {
    const repo = new BoardRepository(),
      statuses: string[] = [];
    vi.spyOn(repo, 'save').mockRejectedValue(
      new DOMException('Full', 'QuotaExceededError'),
    );
    const a = new Autosave(
      repo,
      { ...makeBoard(), revision: 1 },
      'writer',
      (s) => statuses.push(s),
    );
    a.capture(scene());
    expect(await a.flush()).toBe(false);
    expect(statuses).toEqual(['pending', 'saving', 'error']);
    expect(a.dirty).toBe(true);
    await a.dispose();
  });
  it('does not mark a later edit Saved when an earlier write completes', async () => {
    const repo = new BoardRepository(),
      statuses: string[] = [],
      base = { ...makeBoard(), revision: 1 };
    let release: (value: typeof base) => void = () => {};
    vi.spyOn(repo, 'save')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      )
      .mockImplementation(async (b) => ({ ...b, revision: b.revision + 1 }));
    const a = new Autosave(repo, base, 'writer', (s) => statuses.push(s));
    a.capture(scene(1));
    const pending = a.flush();
    await Promise.resolve();
    await Promise.resolve();
    a.capture(scene(2));
    release({ ...base, revision: 2 });
    await pending;
    expect(a.dirty).toBe(true);
    expect(statuses.at(-1)).toBe('pending');
    await a.flush();
    expect(a.dirty).toBe(false);
    expect(statuses.at(-1)).toBe('saved');
    await a.dispose();
  });
  it('preserves a rename made while an earlier write is in flight', async () => {
    const repo = new BoardRepository(),
      base = { ...makeBoard('Before'), revision: 1 };
    let release: (value: typeof base) => void = () => {};
    vi.spyOn(repo, 'save')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      )
      .mockImplementation(async (b) => ({ ...b, revision: b.revision + 1 }));
    const a = new Autosave(repo, base, 'w', () => {});
    a.capture(scene());
    const pending = a.flush();
    await Promise.resolve();
    await Promise.resolve();
    a.rename('After');
    release({ ...base, revision: 2 });
    await pending;
    expect(a.board.title).toBe('After');
    await a.flush();
    expect(a.board.title).toBe('After');
    await a.dispose();
  });
  it('can create a fresh board after initial storage becomes available', async () => {
    const repo = new BoardRepository(`retry-${crypto.randomUUID()}`),
      a = new Autosave(repo, makeBoard('Retry'), 'w', () => {});
    a.capture(scene(21));
    expect(await a.flush()).toBe(true);
    expect(a.board.revision).toBe(1);
    expect((await repo.load(a.board.id)).board.elements[0].x).toBe(21);
    await a.dispose();
    await repo.close();
  });
});

describe('handwriting save scheduling', () => {
  it('defers background writes while a pen is down, then saves after idle', async () => {
    vi.useFakeTimers();
    const repo = new BoardRepository(),
      base = { ...makeBoard(), revision: 1 };
    const checkpoint = vi.spyOn(repo, 'checkpoint').mockResolvedValue();
    const save = vi
      .spyOn(repo, 'save')
      .mockImplementation(async (b) => ({ ...b, revision: b.revision + 1 }));
    const a = new Autosave(repo, base, 'w', () => {});
    a.capture(scene());
    a.beginInteraction();
    await vi.advanceTimersByTimeAsync(2000);
    expect(checkpoint).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    a.capture(scene(5));
    a.endInteraction();
    await vi.advanceTimersByTimeAsync(700);
    expect(checkpoint).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(a.dirty).toBe(false);
    await a.dispose();
    vi.useRealTimers();
  });
  it('coalesces queued checkpoints and skips an already recovered generation', async () => {
    const repo = new BoardRepository(),
      a = new Autosave(repo, { ...makeBoard(), revision: 1 }, 'w', () => {});
    const checkpoint = vi.spyOn(repo, 'checkpoint').mockResolvedValue();
    a.capture(scene());
    await Promise.all(Array.from({ length: 30 }, () => a.checkpoint()));
    expect(checkpoint).toHaveBeenCalledTimes(1);
    await a.checkpoint();
    expect(checkpoint).toHaveBeenCalledTimes(1);
    a.capture(scene(2));
    await a.checkpoint();
    expect(checkpoint).toHaveBeenCalledTimes(2);
    await a.dispose();
  });
});
