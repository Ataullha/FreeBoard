import { Dialog } from './Dialog';
export function Help({
  onClose,
  privacy = false,
}: {
  onClose: () => void;
  privacy?: boolean;
}) {
  return (
    <Dialog
      title={privacy ? 'Your ideas stay yours' : 'A few helpful things'}
      onClose={onClose}
    >
      {privacy ? (
        <div className="help-content">
          <p>
            FreeBoard stores your boards and image assets in this browser using
            IndexedDB. It does not send your board contents to a server. No
            accounts, analytics, trackers, or AI services are included.
          </p>
          <p>
            Your hosting provider receives ordinary website requests, such as
            your IP address and the files requested. Its privacy policy applies
            to those requests.
          </p>
          <h3>Keep a copy that lasts</h3>
          <p>
            Private browsing, browser cleanup, low disk space, or changing to a
            different website address can make local boards unavailable. Use{' '}
            <strong>Export → Editable backup</strong> to download a file
            containing your editable objects and images. Import it from Your
            workspace.
          </p>
          <h3>Offline and updates</h3>
          <p>
            When “Available offline” appears, the app assets are cached on this
            device. Updates wait for you to save and restart. Boards are stored
            separately from the app cache.
          </p>
          <h3>A shared computer</h3>
          <p>
            Anyone using this browser profile can open these boards. FreeBoard
            does not encrypt them or synchronize between devices. Move boards to
            Trash to hide them from the main list; they remain recoverable
            there.
          </p>
          <h3>Open source, thoughtfully used</h3>
          <p>
            The drawing engine is Excalidraw, under the MIT license. FreeBoard
            is MIT licensed. Dependency and font notices are included with the
            source.
          </p>
        </div>
      ) : (
        <div className="help-content">
          <p>
            Pick a tool and make your mark. Double-click a shape or sticky note
            to edit its text. English and বাংলা can share the same line.
          </p>
          <div className="shortcut-grid">
            {[
              ['V / 1', 'Select'],
              ['P / 7', 'Pen'],
              ['M', 'Highlighter'],
              ['H', 'Hand'],
              ['R / 2', 'Rectangle'],
              ['O / 4', 'Ellipse'],
              ['A / 5', 'Arrow'],
              ['L / 6', 'Line'],
              ['T / 8', 'Text'],
              ['N', 'Sticky note'],
              ['I', 'Insert local image'],
              ['E', 'Object eraser'],
              ['Space + drag', 'Pan temporarily'],
              ['Shift + click', 'Multiple selection'],
              ['⌘ / Ctrl + Z', 'Undo'],
              ['⌘ / Ctrl + Shift + Z', 'Redo'],
              ['⌘ / Ctrl + C / X / V', 'Copy / cut / paste'],
              ['⌘ / Ctrl + A', 'Select all'],
              ['⌘ / Ctrl + D', 'Duplicate selection'],
              ['⌘ / Ctrl + G', 'Group'],
              ['⌘ / Ctrl + Shift + G', 'Ungroup'],
              ['⌘ / Ctrl + Shift + L', 'Lock / unlock'],
              ['⌘ / Ctrl + ] / [', 'Forward / backward'],
              ['Shift + 1', 'Fit content'],
              ['Shift + 0', 'Reset zoom'],
              ['⌘ / Ctrl + S', 'Save now'],
              ['⌘ / Ctrl + O', 'Import backup'],
              ['Escape', 'Finish editing / exit presentation'],
            ].map(([key, action]) => (
              <div key={key}>
                <span>{action}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
          <h3>Draw and navigate</h3>
          <p>
            The eraser removes whole objects that it touches and skips locked
            objects. It does not erase pixels. A highlighter stroke uses a
            constant 30% opacity; separate overlapping strokes build up color.
          </p>
          <p>
            Drag selection handles to resize; use the round handle above the
            selection to rotate. Images keep their aspect ratio by default;
            Shift permits free resizing. Connect an arrow by drawing its
            endpoint near the edge of a shape. Move the shape and its connector
            follows.
          </p>
          <p>
            Touch: draw with one finger, use two fingers to pan and pinch.
            Choose Hand to pan with one finger. In pen mode, stylus pressure
            changes the stroke width where the device supplies it.
          </p>
          <h3>Backups and recovery</h3>
          <p>
            “Saved on this device” appears only after IndexedDB finishes
            writing. Download backups for important work. Interrupted drafts can
            be rescued from Your workspace → Recovery. Deleted boards stay in
            Trash.
          </p>
          <p>
            One tab holds the editing lock for each board when Web Locks is
            supported. Other tabs can view or duplicate it. Revision checks also
            prevent stale writes on browsers without Web Locks.
          </p>
        </div>
      )}
    </Dialog>
  );
}
