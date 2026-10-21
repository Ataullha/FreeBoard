import { useState, useEffect, useRef } from 'react';
import { Download, FileJson2, Image, Code2, ArrowRight } from 'lucide-react';
import { Dialog } from './Dialog';
export function ExportDialog({
  onClose,
  selected,
  onExport,
}: {
  onClose: () => void;
  selected: boolean;
  onExport: (
    format: 'json' | 'png' | 'svg',
    selection: boolean,
    background: boolean,
  ) => Promise<{ blob: Blob; name: string }>;
}) {
  const [format, setFormat] = useState<'json' | 'png' | 'svg'>('json'),
    [selection, setSelection] = useState(false),
    [background, setBackground] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [ready, setReady] = useState<{
      url: string;
      name: string;
      bytes: number;
    } | null>(null);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  useEffect(() => {
    setReady(null);
    setError('');
  }, [format, selection, background]);
  useEffect(
    () => () => {
      if (ready) URL.revokeObjectURL(ready.url);
    },
    [ready],
  );
  async function run() {
    setBusy(true);
    setError('');
    try {
      const prepared = await onExport(format, selection, background);
      if (alive.current)
        setReady({
          url: URL.createObjectURL(prepared.blob),
          name: prepared.name,
          bytes: prepared.blob.size,
        });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Export failed. Try an editable backup.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Take your ideas with you" onClose={onClose}>
      <p className="subtle">An editable backup for later. An image to share.</p>
      <div className="export-options">
        {(
          [
            {
              id: 'json',
              icon: FileJson2,
              name: 'Editable backup',
              detail: 'FreeBoard JSON · includes images',
            },
            {
              id: 'png',
              icon: Image,
              name: 'PNG image',
              detail: 'A crisp image for slides and messages',
            },
            {
              id: 'svg',
              icon: Code2,
              name: 'SVG artwork',
              detail: 'Scalable vector · embedded fonts',
            },
          ] as const
        ).map((f) => (
          <button
            aria-pressed={format === f.id}
            disabled={busy}
            className={`export-option ${format === f.id ? 'active' : ''}`}
            key={f.id}
            onClick={() => setFormat(f.id)}
          >
            <f.icon size={21} />
            <span>
              <strong>{f.name}</strong>
              <small>{f.detail}</small>
            </span>
            <ArrowRight size={17} />
          </button>
        ))}
      </div>
      <fieldset className="export-scope">
        <legend>Include</legend>
        <label>
          <input
            type="radio"
            name="scope"
            disabled={busy}
            checked={!selection}
            onChange={() => setSelection(false)}
          />
          Entire board
        </label>
        <label className={!selected ? 'disabled' : ''}>
          <input
            type="radio"
            name="scope"
            checked={selection}
            disabled={busy || !selected}
            onChange={() => setSelection(true)}
          />
          Selected objects
        </label>
      </fieldset>
      {format !== 'json' && (
        <label className="checkbox-row">
          <input
            type="checkbox"
            disabled={busy}
            checked={background}
            onChange={(e) => setBackground(e.target.checked)}
          />
          Include solid board background{' '}
          <span className="subtle">Off = transparent</span>
        </label>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-footer">
        <span className="subtle">
          {ready
            ? `${Math.max(1, Math.round(ready.bytes / 1024)).toLocaleString()} KB · ready to save`
            : 'Create the file, then save it to your device.'}
        </span>
        {ready ? (
          <a
            className="button primary download-link"
            href={ready.url}
            download={ready.name}
          >
            <Download size={17} />
            Download {format === 'json' ? 'backup' : format.toUpperCase()}
          </a>
        ) : (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void run()}
          >
            <Download size={17} />
            {busy ? 'Preparing…' : 'Prepare file'}
          </button>
        )}
      </div>
    </Dialog>
  );
}
