import { createId } from '../model/id';
import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
export type TemplateId = 'blank' | 'lesson' | 'brainstorm' | 'flowchart';
const ink = '#171717';
const title = (
  text: string,
  x: number,
  y: number,
): ExcalidrawElementSkeleton => ({
  type: 'text',
  text,
  x,
  y,
  fontFamily: 2,
  fontSize: 32,
  strokeColor: ink,
});
const box = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  text: string,
): ExcalidrawElementSkeleton => ({
  id,
  type: 'rectangle',
  x,
  y,
  width,
  height,
  roughness: 0,
  fillStyle: 'solid',
  backgroundColor: color,
  strokeColor: color,
  roundness: { type: 3 },
  customData: { freeboard: 'sticky' },
  label: {
    text,
    fontFamily: 2,
    fontSize: 22,
    strokeColor: ink,
    textAlign: 'left',
    verticalAlign: 'middle',
  },
});
export const templates = [
  {
    id: 'blank' as const,
    title: 'A clean slate',
    description: 'Make room for your next idea.',
    tone: 'blank',
  },
  {
    id: 'lesson' as const,
    title: 'Lesson canvas',
    description: 'Explain, explore, then reflect.',
    tone: 'lesson',
  },
  {
    id: 'brainstorm' as const,
    title: 'Room for ideas',
    description: 'A small spark. A new direction.',
    tone: 'brainstorm',
  },
  {
    id: 'flowchart' as const,
    title: 'A clear process',
    description: 'Connect the steps that matter.',
    tone: 'flowchart',
  },
];
export function templateElements(template: TemplateId) {
  let shapes: ExcalidrawElementSkeleton[] = [];
  if (template === 'lesson')
    shapes = [
      title('A little learning, a bigger world.', 80, 40),
      {
        type: 'text',
        text: 'আজকের পাঠ / Today’s lesson',
        x: 80,
        y: 100,
        fontFamily: 2,
        fontSize: 22,
        strokeColor: '#757575',
      },
      box(
        'goal',
        80,
        180,
        320,
        200,
        '#e7e7e7',
        '01  Learning goal\nWhat will we understand?',
      ),
      box(
        'explore',
        440,
        180,
        440,
        310,
        '#e7e7e7',
        '02  Let’s explore\nAdd examples, sketches, and questions.',
      ),
      box(
        'reflect',
        80,
        420,
        320,
        200,
        '#e7e7e7',
        '03  A moment to reflect\nWhat clicked? What is still unclear?',
      ),
    ];
  if (template === 'brainstorm')
    shapes = [
      title('Good ideas begin with a question.', 60, 40),
      {
        type: 'text',
        text: 'Write the question here. Give every idea a little space.',
        x: 60,
        y: 100,
        fontFamily: 2,
        fontSize: 20,
        strokeColor: '#757575',
      },
      box(
        'seed',
        330,
        220,
        260,
        190,
        '#e7e7e7',
        'The big question\nWhat if we…?',
      ),
      box('idea1', 40, 200, 220, 180, '#e8e8e8', 'A small spark'),
      box('idea2', 660, 200, 220, 180, '#e2e2e2', 'A different angle'),
      box('idea3', 180, 490, 250, 160, '#e6e6e6', 'Something to try'),
      box('idea4', 500, 490, 250, 160, '#e4e4e4', 'An open question'),
    ];
  if (template === 'flowchart')
    shapes = [
      title('Make the next step clear.', 80, 40),
      {
        type: 'text',
        text: 'Drag a step. Its connectors follow.',
        x: 80,
        y: 100,
        fontFamily: 2,
        fontSize: 20,
        strokeColor: '#757575',
      },
      box('start', 80, 230, 220, 100, '#e7e7e7', 'Start with an idea'),
      box('work', 410, 230, 220, 100, '#e7e7e7', 'Try it out'),
      box('learn', 740, 230, 220, 100, '#e7e7e7', 'Learn & improve'),
      {
        type: 'arrow',
        x: 305,
        y: 280,
        width: 100,
        height: 0,
        points: [
          [0, 0],
          [100, 0],
        ],
        start: { id: 'start' },
        end: { id: 'work' },
        strokeColor: ink,
        strokeWidth: 2,
        roughness: 0,
      },
      {
        type: 'arrow',
        x: 635,
        y: 280,
        width: 100,
        height: 0,
        points: [
          [0, 0],
          [100, 0],
        ],
        start: { id: 'work' },
        end: { id: 'learn' },
        strokeColor: ink,
        strokeWidth: 2,
        roughness: 0,
      },
    ];
  return convertToExcalidrawElements(shapes, { regenerateIds: false });
}
export function stickyElements(x: number, y: number, color = '#e8e8e8') {
  const id = createId();
  return convertToExcalidrawElements(
    [box(id, x, y, 240, 190, color, 'Your idea goes here')],
    { regenerateIds: false },
  );
}
