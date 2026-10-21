import { hasRasterSignature, rasterSize } from './raster';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { BinaryFiles } from '@excalidraw/excalidraw/types';
import {
  DOCUMENT_VERSION,
  MAX_IMAGE_BYTES,
  MAX_IMPORT_BYTES,
  MAX_OBJECTS,
  defaultCanvas,
} from '../model/document';
import type { BoardBackup } from '../model/document';

type Obj = Record<string, unknown>;
const allowedTypes = new Set([
  'rectangle',
  'ellipse',
  'diamond',
  'line',
  'arrow',
  'freedraw',
  'text',
  'image',
]);
const fail = (message: string): never => {
  throw new Error(message);
};
function object(value: unknown, label: string): Obj {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail(`${label} must be an object.`);
  return value as Obj;
}
function number(
  value: unknown,
  label: string,
  min = -1_000_000,
  max = 1_000_000,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    return fail(`${label} is outside the supported range.`);
  return value;
}
function str(value: unknown, label: string, max = 160): string {
  if (typeof value !== 'string' || value.length > max)
    return fail(`${label} is invalid or too long.`);
  return value;
}
function id(value: unknown): string {
  const s = str(value, 'Object identifier', 160);
  if (
    !/^[\w-]+$/.test(s) ||
    ['__proto__', 'constructor', 'prototype'].includes(s)
  )
    return fail('Invalid object identifier.');
  return s;
}
function color(value: unknown): string {
  const s = str(value, 'Color', 32);
  if (s !== 'transparent' && !/^#[\da-f]{3,8}$/i.test(s))
    return fail('Only solid colors are supported.');
  return s;
}
function pick(value: unknown, choices: unknown[], fallback: unknown): unknown {
  return choices.includes(value) ? value : fallback;
}
function points(value: unknown): number[][] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50_000)
    return fail('Stroke has an invalid number of points.');
  return value.map((p) => {
    if (!Array.isArray(p) || p.length !== 2)
      return fail('Invalid stroke point.');
    return [number(p[0], 'Point'), number(p[1], 'Point')];
  });
}
function binding(value: unknown): Obj | null {
  if (value == null) return null;
  const b = object(value, 'Connector binding');
  return {
    elementId: id(b.elementId),
    focus: number(b.focus ?? 0, 'Connector focus', -1, 1),
    gap: number(b.gap ?? 1, 'Connector gap', 0, 100000),
    ...(b.fixedPoint == null ? {} : { fixedPoint: points([b.fixedPoint])[0] }),
  };
}
export function validateElements(input: unknown): ExcalidrawElement[] {
  if (!Array.isArray(input) || input.length > MAX_OBJECTS)
    return fail(
      `A board supports up to ${MAX_OBJECTS.toLocaleString()} objects.`,
    );
  const seen = new Set<string>();
  let totalPoints = 0;
  const elements = input.map((raw) => {
    const e = object(raw, 'Drawing object'),
      type = str(e.type, 'Object type'),
      eid = id(e.id);
    if (!allowedTypes.has(type))
      return fail(
        `Unsupported object type: ${type}. Embedded websites and scripts are not allowed.`,
      );
    if (seen.has(eid)) return fail('Duplicate object identifiers.');
    seen.add(eid);
    const groups =
      Array.isArray(e.groupIds) && e.groupIds.length <= 30
        ? e.groupIds.map(id)
        : [];
    const bound = Array.isArray(e.boundElements)
      ? e.boundElements.slice(0, 10000).map((b) => {
          const r = object(b, 'Bound object');
          return {
            id: id(r.id),
            type: pick(r.type, ['arrow', 'text'], 'arrow'),
          };
        })
      : null;
    const roundness = e.roundness ? object(e.roundness, 'Roundness') : null;
    const base: Obj = {
      id: eid,
      type,
      x: number(e.x, 'Object x'),
      y: number(e.y, 'Object y'),
      width: number(e.width, 'Object width', 0),
      height: number(e.height, 'Object height', 0),
      angle: number(e.angle ?? 0, 'Rotation', -1000, 1000),
      strokeColor: color(e.strokeColor ?? '#263d35'),
      backgroundColor: color(e.backgroundColor ?? 'transparent'),
      fillStyle: pick(
        e.fillStyle,
        ['hachure', 'cross-hatch', 'solid', 'zigzag'],
        'solid',
      ),
      strokeWidth: number(e.strokeWidth ?? 2, 'Stroke width', 0.1, 100),
      strokeStyle: pick(e.strokeStyle, ['solid', 'dashed', 'dotted'], 'solid'),
      roughness: number(e.roughness ?? 0, 'Roughness', 0, 5),
      opacity: number(e.opacity ?? 100, 'Opacity', 0, 100),
      seed: number(e.seed ?? 1, 'Seed', 0, 2 ** 32),
      version: number(e.version ?? 1, 'Version', 0, Number.MAX_SAFE_INTEGER),
      versionNonce: number(e.versionNonce ?? 1, 'Version nonce', 0, 2 ** 32),
      index: null,
      isDeleted: e.isDeleted === true,
      groupIds: groups,
      frameId: null,
      boundElements: bound,
      updated: number(e.updated ?? 1, 'Timestamp', 0, Number.MAX_SAFE_INTEGER),
      link: null,
      locked: e.locked === true,
      roundness: roundness
        ? {
            type: pick(roundness.type, [1, 2, 3], 3),
            ...(roundness.value == null
              ? {}
              : { value: number(roundness.value, 'Corner radius', 0, 1000) }),
          }
        : null,
      ...objectMarker(e.customData),
    };
    if (type === 'text')
      Object.assign(base, {
        text: str(e.text, 'Text', 100000),
        originalText: str(e.originalText ?? e.text, 'Original text', 100000),
        fontSize: number(e.fontSize ?? 20, 'Font size', 1, 1000),
        fontFamily: pick(e.fontFamily, [1, 2, 3, 5, 6, 7, 8, 9], 2),
        textAlign: pick(e.textAlign, ['left', 'center', 'right'], 'left'),
        verticalAlign: pick(
          e.verticalAlign,
          ['top', 'middle', 'bottom'],
          'top',
        ),
        containerId: e.containerId == null ? null : id(e.containerId),
        lineHeight: number(e.lineHeight ?? 1.4, 'Line height', 0.5, 4),
        autoResize: e.autoResize !== false,
      });
    if (type === 'line' || type === 'arrow' || type === 'freedraw') {
      const p = points(e.points);
      totalPoints += p.length;
      if (totalPoints > 250000)
        return fail('This board has too many stroke points to import safely.');
      Object.assign(base, { points: p, lastCommittedPoint: null });
      if (type === 'freedraw')
        Object.assign(base, {
          pressures: Array.isArray(e.pressures)
            ? e.pressures
                .slice(0, p.length)
                .map((v) => number(v, 'Pressure', 0, 1))
            : [],
          simulatePressure: e.simulatePressure !== false,
        });
      else
        Object.assign(base, {
          startBinding: binding(e.startBinding),
          endBinding: binding(e.endBinding),
          startArrowhead: pick(
            e.startArrowhead,
            [
              null,
              'arrow',
              'bar',
              'dot',
              'triangle',
              'triangle_outline',
              'circle',
              'circle_outline',
              'diamond',
              'diamond_outline',
              'crowfoot_one',
              'crowfoot_many',
              'crowfoot_one_or_many',
            ],
            null,
          ),
          endArrowhead: pick(
            e.endArrowhead,
            [
              null,
              'arrow',
              'bar',
              'dot',
              'triangle',
              'triangle_outline',
              'circle',
              'circle_outline',
              'diamond',
              'diamond_outline',
              'crowfoot_one',
              'crowfoot_many',
              'crowfoot_one_or_many',
            ],
            type === 'arrow' ? 'arrow' : null,
          ),
          elbowed: false,
        });
    }
    if (type === 'image') {
      const crop = e.crop ? object(e.crop, 'Image crop') : null;
      Object.assign(base, {
        fileId: e.fileId == null ? null : id(e.fileId),
        status: 'saved',
        scale: Array.isArray(e.scale)
          ? e.scale.map((v) => number(v, 'Image scale', -1, 1))
          : [1, 1],
        crop: crop
          ? Object.fromEntries(
              [
                'x',
                'y',
                'width',
                'height',
                'naturalWidth',
                'naturalHeight',
              ].map((k) => [k, number(crop[k], 'Image crop', 0, 100000)]),
            )
          : null,
      });
      if (
        (base.scale as number[]).length !== 2 ||
        (base.scale as number[]).some((v) => Math.abs(v) !== 1)
      )
        return fail('Invalid image aspect transform.');
    }
    return base;
  });
  for (const e of elements) {
    if (e.boundElements)
      e.boundElements = (e.boundElements as { id: string }[]).filter((b) =>
        seen.has(b.id),
      );
    if (
      e.type === 'text' &&
      e.containerId &&
      !seen.has(e.containerId as string)
    )
      e.containerId = null;
    for (const key of ['startBinding', 'endBinding']) {
      const b = e[key] as Obj | undefined;
      if (b && !seen.has(b.elementId as string)) e[key] = null;
    }
  }
  return elements as unknown as ExcalidrawElement[];
}
function objectMarker(value: unknown): Obj {
  // Only FreeBoard's inert sticky-note marker is retained; arbitrary imported metadata is discarded.
  return value &&
    typeof value === 'object' &&
    ((value as Obj).freeboard === 'sticky' ||
      (value as Obj).boardpilot === 'sticky')
    ? { customData: { freeboard: 'sticky' } }
    : {};
}
export function validateFiles(input: unknown): BinaryFiles {
  const source = object(input ?? {}, 'Image assets');
  if (Object.keys(source).length > 1000) return fail('Too many image assets.');
  let total = 0;
  const result: BinaryFiles = {};
  for (const [key, raw] of Object.entries(source)) {
    id(key);
    const file = object(raw, 'Image asset');
    const mimeType = str(file.mimeType, 'Image format', 32);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType))
      return fail('Only PNG, JPEG, and WebP images are allowed.');
    const dataURL = str(
      file.dataURL,
      'Image data',
      Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 100,
    );
    const prefix = `data:${mimeType};base64,`;
    if (
      !dataURL.startsWith(prefix) ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(dataURL.slice(prefix.length)) ||
      dataURL.slice(prefix.length).length % 4
    )
      return fail('Invalid embedded image data.');
    const bytes = atob(dataURL.slice(prefix.length));
    total += bytes.length;
    if (bytes.length > MAX_IMAGE_BYTES || total > 30 * 1024 * 1024)
      return fail('Image assets exceed the 30 MB backup limit.');
    if (!hasRasterSignature(bytes, mimeType))
      return fail('Image contents do not match their format.');
    rasterSize(bytes, mimeType);
    result[key] = {
      id: key,
      dataURL,
      mimeType,
      created: number(
        file.created ?? Date.now(),
        'Image timestamp',
        0,
        Number.MAX_SAFE_INTEGER,
      ),
      lastRetrieved: Date.now(),
    } as BinaryFiles[string];
  }
  return result;
}
export function parseBackup(text: string): BoardBackup {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES)
    return fail('Backup is too large (40 MB maximum).');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail(
      'This file is not valid JSON. Your current board is unchanged.',
    );
  }
  const raw = object(parsed, 'Board backup');
  if (raw.format !== 'freeboard' && raw.format !== 'boardpilot')
    return fail('Choose a FreeBoard .freeboard.json backup.');
  if (raw.version !== 1 && raw.version !== DOCUMENT_VERSION)
    return fail(
      'Unsupported document version. Update FreeBoard before importing this file.',
    );
  const elements = validateElements(raw.elements),
    files = validateFiles(raw.files);
  for (const e of elements)
    if (e.type === 'image' && (!e.fileId || !files[e.fileId]))
      return fail('An image asset is missing from this backup.');
  const a = object(raw.appState ?? {}, 'Canvas settings'),
    defaults = defaultCanvas();
  return {
    format: 'freeboard',
    version: 2,
    title:
      str(raw.title ?? 'Imported board', 'Board title', 120).trim() ||
      'Imported board',
    createdAt: number(
      raw.createdAt ?? Date.now(),
      'Creation date',
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    updatedAt: Date.now(),
    elements,
    files,
    appState: {
      viewBackgroundColor: color(
        a.viewBackgroundColor ?? defaults.viewBackgroundColor,
      ),
      gridSize: a.gridSize == null ? 20 : number(a.gridSize, 'Grid', 5, 100),
      gridModeEnabled: a.gridModeEnabled === true,
      scrollX: number(a.scrollX ?? 0, 'Scroll'),
      scrollY: number(a.scrollY ?? 0, 'Scroll'),
      zoom: {
        value: number(
          a.zoom ? object(a.zoom, 'Zoom').value : 1,
          'Zoom',
          0.1,
          30,
        ) as typeof defaults.zoom.value,
      },
    },
  };
}
