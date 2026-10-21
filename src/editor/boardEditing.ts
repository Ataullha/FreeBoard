import { newElementWith } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
/** Delete as tombstones, preserving native undo, images, and connector endpoints. */
export function deleteObjects(
  elements: readonly ExcalidrawElement[],
  ids: ReadonlySet<string>,
  protectLocked = true,
) {
  const map = new Map(elements.map((e) => [e.id, e]));
  const protectedObject = (e: ExcalidrawElement) =>
    protectLocked &&
    (e.locked ||
      (e.type === 'text' &&
        !!e.containerId &&
        map.get(e.containerId)?.locked) ||
      !!e.boundElements?.some(
        (b) => b.type === 'text' && map.get(b.id)?.locked,
      ));
  const remove = new Set<string>(),
    visited = new Set<string>(),
    processedGroups = new Set<string>();
  const groups = new Map<string, string[]>(),
    labels = new Map<string, string[]>();
  for (const e of elements) {
    const group = e.groupIds.at(-1);
    if (group) {
      const members = groups.get(group);
      if (members) members.push(e.id);
      else groups.set(group, [e.id]);
    }
    if (e.type === 'text' && e.containerId) {
      const members = labels.get(e.containerId);
      if (members) members.push(e.id);
      else labels.set(e.containerId, [e.id]);
    }
  }
  const queue = [...ids];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (visited.has(id)) continue;
    visited.add(id);
    const e = map.get(id);
    if (!e || e.isDeleted || protectedObject(e)) continue;
    remove.add(id);
    const group = e.groupIds.at(-1);
    if (group && !processedGroups.has(group)) {
      processedGroups.add(group);
      queue.push(...(groups.get(group) ?? []));
    }
    if (e.type === 'text' && e.containerId) queue.push(e.containerId);
    queue.push(...(labels.get(id) ?? []));
  }
  return elements.map((e) => {
    if (remove.has(e.id)) return newElementWith(e, { isDeleted: true });
    if (e.isDeleted) return e;
    if (e.type === 'arrow') {
      const start = !!e.startBinding && remove.has(e.startBinding.elementId),
        end = !!e.endBinding && remove.has(e.endBinding.elementId);
      if (start || end)
        return newElementWith(e, {
          startBinding: start ? null : e.startBinding,
          endBinding: end ? null : e.endBinding,
        });
    }
    if (e.boundElements?.some((b) => remove.has(b.id)))
      return newElementWith(e, {
        boundElements: e.boundElements.filter((b) => !remove.has(b.id)),
      });
    return e;
  });
}
