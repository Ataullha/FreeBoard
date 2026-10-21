export type Point = { x: number; y: number };
export type View = {
  scrollX: number;
  scrollY: number;
  zoom: { value: number };
  offsetLeft: number;
  offsetTop: number;
};
export function toScene(p: Point, v: View): Point {
  return {
    x: (p.x - v.offsetLeft) / v.zoom.value - v.scrollX,
    y: (p.y - v.offsetTop) / v.zoom.value - v.scrollY,
  };
}
export function toViewport(p: Point, v: View): Point {
  return {
    x: (p.x + v.scrollX) * v.zoom.value + v.offsetLeft,
    y: (p.y + v.scrollY) * v.zoom.value + v.offsetTop,
  };
}
export function zoomAt(p: Point, value: number, v: View): View {
  const anchor = toScene(p, v),
    z = Math.min(30, Math.max(0.1, value));
  return {
    ...v,
    zoom: { value: z },
    scrollX: (p.x - v.offsetLeft) / z - anchor.x,
    scrollY: (p.y - v.offsetTop) / z - anchor.y,
  };
}
