import type { BoardRecord, Scene } from '../model/document';
import { BoardRepository } from './repository';
export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';
/** Serial writes; a newer edit can never be marked saved by an older completion. */
export class Autosave {
  private latest?: Scene;
  private generation = 0;
  private savedGeneration = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private draftTimer?: ReturnType<typeof setTimeout>;
  private queue: Promise<void> = Promise.resolve();
  private disposed = false;
  private interacting = false;
  private checkpointGeneration = 0;
  private checkpointPending?: Promise<void>;
  private lastStatus?: SaveStatus;
  constructor(
    private repo: BoardRepository,
    public board: BoardRecord,
    public writerId: string,
    private status: (status: SaveStatus, error?: unknown) => void,
    private committed?: (board: BoardRecord) => void,
  ) {}
  get dirty() {
    return this.generation !== this.savedGeneration;
  }
  capture(scene: Scene) {
    if (this.disposed) return;
    this.latest = scene;
    this.generation++;
    this.notify('pending');
    this.schedule();
  }
  beginInteraction() {
    this.interacting = true;
    clearTimeout(this.timer);
    clearTimeout(this.draftTimer);
  }
  endInteraction() {
    this.interacting = false;
    if (this.dirty) this.schedule();
  }
  private notify(status: SaveStatus, error?: unknown) {
    if (status !== this.lastStatus || error) {
      this.lastStatus = status;
      this.status(status, error);
    }
  }
  private schedule() {
    clearTimeout(this.timer);
    clearTimeout(this.draftTimer);
    if (this.interacting || this.disposed) return;
    this.draftTimer = setTimeout(() => {
      void this.checkpoint();
    }, 180);
    this.timer = setTimeout(() => {
      void this.flush();
    }, 650);
  }
  rename(title: string) {
    this.board = {
      ...this.board,
      title: title.trim().slice(0, 120) || 'Untitled board',
    };
    if (this.latest) this.capture(this.latest);
  }
  private enqueue(work: () => Promise<void>) {
    const task = this.queue.then(work);
    this.queue = task.catch(() => {});
    return task;
  }
  checkpoint() {
    if (this.checkpointPending) return this.checkpointPending;
    const pending = this.enqueue(async () => {
      if (
        !this.latest ||
        !this.dirty ||
        this.board.revision === 0 ||
        this.checkpointGeneration === this.generation
      )
        return;
      const generation = this.generation;
      try {
        await this.repo.checkpoint(this.board, this.latest, this.writerId);
        this.checkpointGeneration = generation;
      } catch (e) {
        this.notify('error', e);
      }
    });
    this.checkpointPending = pending;
    void pending.finally(() => {
      this.checkpointPending = undefined;
    });
    return pending;
  }
  flush(thumbnail?: string): Promise<boolean> {
    clearTimeout(this.timer);
    clearTimeout(this.draftTimer);
    let success = true;
    return this.enqueue(async () => {
      if (!this.latest || !this.dirty) return;
      const generation = this.generation,
        scene = structuredClone(this.latest),
        written = this.board;
      this.notify('saving');
      try {
        const next =
          written.revision === 0
            ? await this.repo.create(
                {
                  ...written,
                  elements: scene.elements,
                  appState: scene.appState,
                  assetIds: Object.keys(scene.files),
                },
                scene.files,
              )
            : await this.repo.save(written, scene, this.writerId, thumbnail);
        this.board = { ...next, title: this.board.title };
        this.savedGeneration = generation;
        this.committed?.(this.board);
        this.notify(this.dirty ? 'pending' : 'saved');
      } catch (e) {
        success = false;
        this.notify('error', e);
      }
    }).then(() => success);
  }
  async dispose() {
    clearTimeout(this.timer);
    clearTimeout(this.draftTimer);
    this.disposed = true;
    await this.queue;
  }
}
