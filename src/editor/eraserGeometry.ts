import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { Point } from '../model/coordinates';
export const ERASER_BASE_RADIUS = 9;
export const ERASER_MAX_RADIUS = 64;
export function eraserRadius(elapsed: number) {
  return Math.min(
    ERASER_MAX_RADIUS,
    ERASER_BASE_RADIUS + Math.max(0, elapsed - 400) * 0.035,
  );
}
function pointDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    d = dx * dx + dy * dy,
    t = d
      ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / d))
      : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function cross(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function distance(a: Point, b: Point, c: Point, d: Point) {
  const u = cross(a, b, c),
    v = cross(a, b, d),
    w = cross(c, d, a),
    x = cross(c, d, b);
  if (
    u * v <= 0 &&
    w * x <= 0 &&
    Math.max(a.x, b.x) >= Math.min(c.x, d.x) &&
    Math.max(c.x, d.x) >= Math.min(a.x, b.x) &&
    Math.max(a.y, b.y) >= Math.min(c.y, d.y) &&
    Math.max(c.y, d.y) >= Math.min(a.y, b.y)
  )
    return 0;
  return Math.min(
    pointDistance(a, c, d),
    pointDistance(b, c, d),
    pointDistance(c, a, b),
    pointDistance(d, a, b),
  );
}
export function eraserHit(
  e: ExcalidrawElement,
  from: Point,
  to: Point,
  radius: number,
): boolean {
  if (e.isDeleted || e.locked) return false;
  let minX = 0,
    minY = 0,
    maxX = e.width,
    maxY = e.height;
  const path = e.type === 'freedraw' || e.type === 'line' || e.type === 'arrow';
  if (path && e.points.length) {
    minX = maxX = e.points[0][0];
    minY = maxY = e.points[0][1];
    for (const [x, y] of e.points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const centerX = (minX + maxX) / 2,
    centerY = (minY + maxY) / 2,
    cx = e.x + centerX,
    cy = e.y + centerY,
    cos = Math.cos(-e.angle),
    sin = Math.sin(-e.angle);
  const local = (p: Point) => ({
    x: (p.x - cx) * cos - (p.y - cy) * sin + centerX,
    y: (p.x - cx) * sin + (p.y - cy) * cos + centerY,
  });
  const a = local(from),
    b = local(to),
    pad = radius + e.strokeWidth * (e.type === 'freedraw' ? 2.125 : 0.5);
  if (
    Math.max(a.x, b.x) < minX - pad ||
    Math.min(a.x, b.x) > maxX + pad ||
    Math.max(a.y, b.y) < minY - pad ||
    Math.min(a.y, b.y) > maxY + pad
  )
    return false;
  if (e.type === 'freedraw' || e.type === 'line' || e.type === 'arrow') {
    for (let i = 1; i < e.points.length; i++)
      if (
        distance(
          a,
          b,
          { x: e.points[i - 1][0], y: e.points[i - 1][1] },
          { x: e.points[i][0], y: e.points[i][1] },
        ) <= pad
      )
        return true;
    return (
      e.points.length === 1 &&
      pointDistance({ x: e.points[0][0], y: e.points[0][1] }, a, b) <= pad
    );
  }
  const inside = (p: Point) => {
    if (e.type === 'ellipse') {
      const rx = e.width / 2,
        ry = e.height / 2;
      return (
        rx > 0 && ry > 0 && ((p.x - rx) / rx) ** 2 + ((p.y - ry) / ry) ** 2 <= 1
      );
    }
    if (e.type === 'diamond')
      return (
        e.width > 0 &&
        e.height > 0 &&
        Math.abs(p.x - e.width / 2) / (e.width / 2) +
          Math.abs(p.y - e.height / 2) / (e.height / 2) <=
          1
      );
    return p.x >= 0 && p.x <= e.width && p.y >= 0 && p.y <= e.height;
  };
  if (
    (e.type === 'text' ||
      e.type === 'image' ||
      e.backgroundColor !== 'transparent') &&
    (inside(a) || inside(b))
  )
    return true;
  let outline: Point[];
  if (e.type === 'ellipse')
    outline = Array.from({ length: 128 }, (_, i) => ({
      x: (e.width / 2) * (1 + Math.cos((i * Math.PI) / 64)),
      y: (e.height / 2) * (1 + Math.sin((i * Math.PI) / 64)),
    }));
  else if (e.type === 'diamond')
    outline = [
      { x: e.width / 2, y: 0 },
      { x: e.width, y: e.height / 2 },
      { x: e.width / 2, y: e.height },
      { x: 0, y: e.height / 2 },
    ];
  else
    outline = [
      { x: 0, y: 0 },
      { x: e.width, y: 0 },
      { x: e.width, y: e.height },
      { x: 0, y: e.height },
    ];
  return outline.some(
    (p, i) => distance(a, b, p, outline[(i + 1) % outline.length]) <= pad,
  );
}
