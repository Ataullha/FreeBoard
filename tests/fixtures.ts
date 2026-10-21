import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from '@excalidraw/excalidraw/element/types';
import { defaultCanvas } from '../src/model/document';
import type { Scene } from '../src/model/document';
export function rect(id = 'shape', x = 0): ExcalidrawElement {
  return {
    id,
    type: 'rectangle',
    x,
    y: 20,
    width: 160,
    height: 100,
    angle: 0,
    strokeColor: '#263d35',
    backgroundColor: '#e4eddf',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roundness: null,
    roughness: 0,
    opacity: 100,
    seed: 1,
    version: 1,
    versionNonce: 1,
    index: null,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
  } as ExcalidrawElement;
}
export function text(): ExcalidrawTextElement {
  return {
    ...rect('text'),
    type: 'text',
    text: 'আমি বাংলায় লিখি\nI teach in English.',
    originalText: 'আমি বাংলায় লিখি\nI teach in English.',
    fontSize: 24,
    fontFamily: 2,
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    lineHeight: 1.4,
    autoResize: true,
  } as ExcalidrawTextElement;
}
export function scene(x = 0): Scene {
  return {
    elements: [rect('shape', x), text()],
    files: {},
    appState: defaultCanvas(),
  };
}
