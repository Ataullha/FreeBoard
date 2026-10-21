import { useState } from 'react';
import {
  Copy,
  RotateCcw,
  Trash2,
  Upload,
  ArrowUpRight,
  FileClock,
  Search,
} from 'lucide-react';
import type { BoardRecord } from '../model/document';
import type { Draft } from '../storage/repository';
import { templates } from '../editor/templates';
import type { TemplateId } from '../editor/templates';
import { Dialog } from './Dialog';
import { TemplatePreview } from './TemplatePreview';
const edited = (date: number) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
export function BoardLibrary({
  boards,
  drafts,
  currentId,
  loading,
  busy,
  error,
  onBackup,
  onRetry,
  onClose,
  onOpen,
  onCreate,
  onDuplicate,
  onTrash,
  onRestore,
  onImport,
  onRescue,
}: {
  loading: boolean;
  busy: boolean;
  error: string;
  onBackup: () => void;
  onRetry: () => void;
  boards: BoardRecord[];
  drafts: Draft[];
  currentId?: string;
  onClose: () => void;
  onOpen: (id: string) => void;
  onCreate: (template: TemplateId) => void;
  onDuplicate: (id: string) => void;
  onTrash: (board: BoardRecord) => void;
  onRestore: (board: BoardRecord) => void;
  onImport: () => void;
  onRescue: (draft: Draft) => void;
}) {
  const [tab, setTab] = useState<'boards' | 'trash' | 'drafts'>('boards'),
    [search, setSearch] = useState('');
  const shown = boards.filter(
    (b) =>
      (tab === 'trash' ? !!b.deletedAt : !b.deletedAt) &&
      b.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <Dialog title="Your workspace" wide onClose={onClose}>
      {busy && (
        <p role="status" className="subtle">
          Working…
        </p>
      )}
      <fieldset className="library-fields" disabled={busy || loading}>
        <p className="subtle library-intro">
          Your ideas, all in one place. Saved in this browser, ready when you
          are.
        </p>
        {error && (
          <div className="inline-error" role="alert">
            <p>{error}</p>
            <div className="library-error-actions">
              <button className="button secondary small" onClick={onBackup}>
                Download current backup
              </button>
              <button className="button secondary small" onClick={onRetry}>
                Retry
              </button>
            </div>
          </div>
        )}
        <div className="section-label">Start something new</div>
        <div className="template-grid">
          {templates.map((t) => (
            <button
              key={t.id}
              className={`template-card ${t.tone}`}
              onClick={() => onCreate(t.id)}
            >
              <div className="template-art" aria-hidden="true">
                <TemplatePreview kind={t.id} />
              </div>
              <strong>{t.title}</strong>
              <span>{t.description}</span>
            </button>
          ))}
        </div>
        <div className="library-controls">
          <div className="tabs" role="tablist" aria-label="Board folders">
            <button
              role="tab"
              aria-selected={tab === 'boards'}
              onClick={() => setTab('boards')}
            >
              Boards <span>{boards.filter((b) => !b.deletedAt).length}</span>
            </button>
            <button
              role="tab"
              aria-selected={tab === 'trash'}
              onClick={() => setTab('trash')}
            >
              <Trash2 size={15} />
              Trash
            </button>
            <button
              role="tab"
              aria-selected={tab === 'drafts'}
              onClick={() => setTab('drafts')}
            >
              <FileClock size={15} />
              Recovery
            </button>
          </div>
          <button className="button secondary small" onClick={onImport}>
            <Upload size={15} />
            Import backup
          </button>
        </div>
        {tab !== 'drafts' && (
          <div className="search-field">
            <Search size={16} aria-hidden="true" />
            <input
              className="search-input"
              aria-label="Search boards"
              placeholder="Search your boards…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
        {loading ? (
          <p className="folder-empty" role="status">
            Opening your boards…
          </p>
        ) : tab === 'drafts' ? (
          <div className="recovery-list">
            <p className="subtle">
              Interrupted edits stay here until saved. Rescue creates a separate
              board, preserving the original.
            </p>
            {drafts.length ? (
              drafts.map((d) => (
                <div className="recovery-row" key={d.key}>
                  <div>
                    <strong>{d.board.title}</strong>
                    <p>{edited(d.updatedAt)}</p>
                  </div>
                  <button
                    className="button secondary small"
                    onClick={() => onRescue(d)}
                  >
                    Rescue copy
                  </button>
                </div>
              ))
            ) : (
              <div className="folder-empty">No unsaved recovery drafts.</div>
            )}
          </div>
        ) : (
          <div className="board-grid">
            {shown.length ? (
              shown.map((b) => (
                <article
                  className={`board-card ${b.id === currentId ? 'current' : ''}`}
                  key={b.id}
                >
                  <button
                    className="board-open"
                    onClick={() =>
                      tab === 'trash' ? onRestore(b) : onOpen(b.id)
                    }
                    aria-label={
                      tab === 'trash' ? `Restore ${b.title}` : `Open ${b.title}`
                    }
                  >
                    <div className="board-preview">
                      {b.thumbnail ? (
                        <img src={b.thumbnail} alt="" />
                      ) : (
                        <span className="preview-mark" aria-hidden="true">
                          ✦
                        </span>
                      )}
                      {b.id === currentId && (
                        <span className="current-badge">Open now</span>
                      )}
                    </div>
                    <div className="board-caption">
                      <strong>{b.title}</strong>
                      <span>
                        {tab === 'trash' ? 'Moved to trash' : 'Edited'}{' '}
                        {edited(tab === 'trash' ? b.deletedAt! : b.updatedAt)}
                      </span>
                    </div>
                  </button>
                  <div className="board-actions">
                    {tab === 'trash' ? (
                      <button
                        className="text-button"
                        onClick={() => onRestore(b)}
                      >
                        <RotateCcw size={14} />
                        Restore board
                      </button>
                    ) : (
                      <>
                        <button
                          aria-label={`Duplicate ${b.title}`}
                          title="Duplicate board"
                          className="icon-button"
                          onClick={() => onDuplicate(b.id)}
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          aria-label={`Move ${b.title} to trash`}
                          title="Move to trash"
                          className="icon-button"
                          onClick={() => onTrash(b)}
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          className="text-button"
                          onClick={() => onOpen(b.id)}
                        >
                          Open <ArrowUpRight size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="folder-empty">
                {tab === 'trash'
                  ? 'The trash is empty. Deleted boards can be restored here.'
                  : 'No boards match your search.'}
              </div>
            )}
          </div>
        )}
        <div className="privacy-note">
          Browser data can be cleared. Download editable backups of work you
          want to keep.
        </div>
      </fieldset>
    </Dialog>
  );
}
