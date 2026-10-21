import { describe, it, expect } from 'vitest';
import { backupFor, makeBoard, selectedScene } from '../src/model/document';
import {
  parseBackup,
  validateElements,
  validateFiles,
} from '../src/io/validation';
import { scene, rect, text } from './fixtures';
const encoded = () =>
  JSON.stringify(backupFor(makeBoard('আজকের পাঠ'), scene()));
describe('editable backup and validation', () => {
  it('round trips Bengali, English, styles, and canvas settings', () => {
    const parsed = parseBackup(encoded());
    expect(parsed.format).toBe('freeboard');
    expect(parsed.version).toBe(2);
    expect(parsed.title).toBe('আজকের পাঠ');
    expect(parsed.elements[1]).toMatchObject(text());
    expect(parsed.appState).toEqual(scene().appState);
  });
  it.each([1, 2])(
    'opens legacy BoardPilot v%s backups without changing artwork',
    (version) => {
      const legacy = JSON.parse(encoded());
      legacy.format = 'boardpilot';
      legacy.version = version;
      legacy.elements[0].customData = {
        boardpilot: 'sticky',
        html: '<script/>',
      };
      const parsed = parseBackup(JSON.stringify(legacy));
      expect(parsed.format).toBe('freeboard');
      expect(parsed.version).toBe(2);
      expect(parsed.elements[0].customData).toEqual({ freeboard: 'sticky' });
      expect(parsed.elements[0].strokeColor).toBe(
        legacy.elements[0].strokeColor,
      );
      expect(parsed.appState).toEqual(legacy.appState);
    },
  );
  it('migrates document v1 without mutating its content', () => {
    const old = JSON.parse(encoded());
    old.version = 1;
    delete old.appState.gridModeEnabled;
    expect(parseBackup(JSON.stringify(old)).version).toBe(2);
    expect(parseBackup(JSON.stringify(old)).appState.gridModeEnabled).toBe(
      false,
    );
  });
  it.each(['{bad', '[]', 'null', '<script>alert(1)</script>'])(
    'rejects malformed imports: %s',
    (s) => {
      expect(() => parseBackup(s)).toThrow();
    },
  );
  it('rejects future documents, duplicate IDs, nonfinite coordinates, and huge strokes', () => {
    const future = JSON.parse(encoded());
    future.version = 99;
    expect(() => parseBackup(JSON.stringify(future))).toThrow(/version/);
    expect(() => validateElements([rect(), rect()])).toThrow(/Duplicate/);
    expect(() => validateElements([{ ...rect(), x: Infinity }])).toThrow(
      /range/,
    );
    expect(() =>
      validateElements([
        { ...rect(), type: 'freedraw', points: new Array(50001).fill([0, 0]) },
      ]),
    ).toThrow(/points/);
  });
  it('rejects active embeds, remote images, disguised SVG, and script identifiers', () => {
    expect(() => validateElements([{ ...rect(), type: 'iframe' }])).toThrow(
      /Unsupported/,
    );
    expect(() => validateElements([{ ...rect(), id: '__proto__' }])).toThrow(
      /identifier/,
    );
    expect(() =>
      validateFiles({
        img: {
          mimeType: 'image/svg+xml',
          dataURL: 'data:image/svg+xml,<svg/>',
        },
      }),
    ).toThrow(/PNG/);
    expect(() =>
      validateFiles({
        img: {
          mimeType: 'image/png',
          dataURL: 'https://example.com/image.png',
        },
      }),
    ).toThrow(/data/);
    expect(() =>
      validateFiles({
        img: {
          mimeType: 'image/png',
          dataURL: 'data:image/png;base64,' + btoa('<svg onload="alert(1)"/>'),
        },
      }),
    ).toThrow(/contents/);
  });
  it('discards arbitrary metadata and links, preserving only inert sticky markers', () => {
    const [e] = validateElements([
      {
        ...rect(),
        link: 'javascript:alert(1)',
        customData: { html: '<script/>' },
      },
    ]);
    expect(e.link).toBeNull();
    expect(e.customData).toBeUndefined();
  });
  it('round trips embedded image bytes and rejects missing images', () => {
    const dataURL =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
    const s = scene();
    s.elements = [
      {
        ...rect('img'),
        type: 'image',
        fileId: 'asset',
        scale: [1, 1],
        status: 'saved',
        crop: null,
      },
    ] as never;
    s.files = {
      asset: { id: 'asset', mimeType: 'image/png', dataURL, created: 1 },
    } as never;
    const parsed = parseBackup(JSON.stringify(backupFor(makeBoard(), s)));
    expect(parsed.files.asset.dataURL).toBe(dataURL);
    s.files = {};
    expect(() =>
      parseBackup(JSON.stringify(backupFor(makeBoard(), s))),
    ).toThrow(/missing/);
  });
  it('keeps connectors attached on full round trips and detaches out-of-selection targets', () => {
    const source = {
        ...rect('a'),
        boundElements: [{ id: 'arrow', type: 'arrow' }],
      },
      target = rect('b', 400);
    const arrow = {
      ...rect('arrow'),
      type: 'arrow',
      points: [
        [0, 0],
        [300, 0],
      ],
      startBinding: { elementId: 'a', focus: 0, gap: 4 },
      endBinding: { elementId: 'b', focus: 0, gap: 4 },
    };
    const all = validateElements([source, target, arrow]);
    expect(all[2]).toMatchObject({
      startBinding: { elementId: 'a' },
      endBinding: { elementId: 'b' },
    });
    const subset = selectedScene(all, { a: true, arrow: true });
    expect(subset).toHaveLength(2);
    expect(subset[1]).toMatchObject({
      startBinding: { elementId: 'a' },
      endBinding: null,
    });
  });
});
