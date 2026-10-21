import { exportToBlob, exportToSvg } from '@excalidraw/excalidraw';
import type { NonDeletedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { BoardBackup, Scene } from '../model/document';
import { sceneFiles } from '../model/document';
import bengaliFont from '@fontsource/noto-sans-bengali/files/noto-sans-bengali-bengali-400-normal.woff2?url';
import latinFont from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export const filename = (title: string) =>
  title
    .replace(/[^\p{L}\p{N}\-_ ]/gu, '')
    .trim()
    .slice(0, 80) || 'FreeBoard';
export function backupBlob(backup: BoardBackup) {
  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}
const embeddedFonts = new Map<string, Promise<string>>();
async function embedded(url: string): Promise<string> {
  if (!embeddedFonts.has(url))
    embeddedFonts.set(
      url,
      fetch(url)
        .then((r) => {
          if (!r.ok)
            throw new Error(
              'A local font could not be loaded. Reopen the app online once and try again.',
            );
          return r.blob();
        })
        .then(
          (blob) =>
            new Promise<string>((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => resolve(r.result as string);
              r.onerror = reject;
              r.readAsDataURL(blob);
            }),
        )
        .catch((e) => {
          embeddedFonts.delete(url);
          throw e;
        }),
    );
  return embeddedFonts.get(url)!;
}
export async function exportArtwork(
  scene: Scene,
  format: 'png' | 'svg',
  background: boolean,
): Promise<Blob> {
  const elements = scene.elements.filter(
    (e) => !e.isDeleted,
  ) as NonDeletedExcalidrawElement[];
  if (!elements.length)
    throw new Error('Add something to the board before exporting.');
  await Promise.all([
    document.fonts.load('20px Helvetica', 'FreeBoard'),
    document.fonts.load('20px "FreeBoard Bengali"', 'বাংলা'),
  ]);
  const options = {
    elements,
    files: sceneFiles(elements, scene.files),
    appState: {
      ...scene.appState,
      exportBackground: background,
      exportWithDarkMode: false,
      exportEmbedScene: false,
    },
    exportPadding: 24,
  };
  if (format === 'png')
    return exportToBlob({
      ...options,
      maxWidthOrHeight: 8192,
      getDimensions: (w: number, h: number) => {
        // Cap total pixels as well as the longest side to avoid mobile canvas exhaustion.
        const scale = Math.min(
          2,
          8192 / Math.max(w, h),
          Math.sqrt(16_000_000 / (w * h)),
        );
        return {
          width: Math.max(1, Math.ceil(w * scale)),
          height: Math.max(1, Math.ceil(h * scale)),
          scale,
        };
      },
    });
  const svg = await exportToSvg(options);
  const [bn, en] = await Promise.all([
    embedded(bengaliFont),
    embedded(latinFont),
  ]);
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `@font-face{font-family:'FreeBoard Bengali';src:url('${bn}') format('woff2');unicode-range:U+0980-09FF,U+200C-200D,U+25CC;}@font-face{font-family:'Helvetica';src:url('${en}') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}`;
  svg.querySelector('defs')?.append(style);
  for (const text of svg.querySelectorAll('text'))
    text.setAttribute(
      'font-family',
      `${text.getAttribute('font-family')}, 'FreeBoard Bengali'`,
    );
  return new Blob([new XMLSerializer().serializeToString(svg)], {
    type: 'image/svg+xml;charset=utf-8',
  });
}
export async function thumbnail(scene: Scene): Promise<string | undefined> {
  if (!scene.elements.some((e) => !e.isDeleted)) return undefined;
  const blob = await exportToBlob({
    elements: scene.elements.filter(
      (e) => !e.isDeleted,
    ) as NonDeletedExcalidrawElement[],
    files: scene.files,
    appState: {
      ...scene.appState,
      exportBackground: true,
      exportWithDarkMode: false,
    },
    maxWidthOrHeight: 360,
    exportPadding: 24,
  });
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
