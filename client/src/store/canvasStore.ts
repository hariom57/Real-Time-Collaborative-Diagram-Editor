import { create } from 'zustand';
import { getCircleGeometry } from '@shared/index';
import type { DiagramShape, DiagramState, DraftShape, Point, ToolId } from '@shared/index';

type CanvasStore = DiagramState & {
  setTool: (tool: ToolId) => void;
  startDraft: (draft: DraftShape) => void;
  updateDraft: (point: Point) => void;
  finishDraft: () => DiagramShape | null;
  selectShape: (shapeId: string | null) => void;
  moveShape: (shapeId: string, deltaX: number, deltaY: number) => void;
  getShapeById: (shapeId: string) => DiagramShape | undefined;
};

const starterShapes: DiagramShape[] = [
  {
    id: 'shape-1',
    kind: 'rectangle',
    x: 120,
    y: 120,
    width: 180,
    height: 120,
    stroke: '#12355b',
    fill: '#d8ecff',
  },
  {
    id: 'shape-2',
    kind: 'circle',
    cx: 460,
    cy: 220,
    radius: 64,
    stroke: '#8b5a2b',
    fill: '#ffe0bc',
  },
  {
    id: 'shape-3',
    kind: 'line',
    x1: 240,
    y1: 420,
    x2: 520,
    y2: 340,
    stroke: '#234d20',
    fill: '#234d20',
  },
];

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  shapes: starterShapes,
  selectedShapeId: null,
  activeTool: 'select',
  draftShape: null,
  setTool: (tool) =>
    set(() => ({
      activeTool: tool,
      draftShape: null,
    })),
  startDraft: (draft) => set(() => ({ draftShape: draft })),
  updateDraft: (point) =>
    set((state) =>
      state.draftShape === null ? state : { draftShape: { ...state.draftShape, current: point } },
    ),
  finishDraft: () => {
    const { draftShape } = get();

    if (!draftShape) {
      return null;
    }

    const id = `shape-${Math.random().toString(36).slice(2, 9)}`;

    if (draftShape.kind === 'rectangle') {
      const x = Math.min(draftShape.start.x, draftShape.current.x);
      const y = Math.min(draftShape.start.y, draftShape.current.y);
      const width = Math.max(8, Math.abs(draftShape.current.x - draftShape.start.x));
      const height = Math.max(8, Math.abs(draftShape.current.y - draftShape.start.y));
      const shape: DiagramShape = { id, kind: 'rectangle', x, y, width, height, stroke: '#12355b', fill: '#d8ecff' };
      set((state) => ({ shapes: [...state.shapes, shape], draftShape: null, selectedShapeId: id }));
      return shape;
    }

    if (draftShape.kind === 'circle') {
      const { cx, cy, radius } = getCircleGeometry(draftShape.start, draftShape.current);
      const committedRadius = Math.max(8, radius);
      const shape: DiagramShape = {
        id,
        kind: 'circle',
        cx,
        cy,
        radius: committedRadius,
        stroke: '#8b5a2b',
        fill: '#ffe0bc',
      };
      set((state) => ({ shapes: [...state.shapes, shape], draftShape: null, selectedShapeId: id }));
      return shape;
    }

    const shape: DiagramShape = {
      id,
      kind: 'line',
      x1: draftShape.start.x,
      y1: draftShape.start.y,
      x2: draftShape.current.x,
      y2: draftShape.current.y,
      stroke: '#234d20',
      fill: '#234d20',
    };

    set((state) => ({ shapes: [...state.shapes, shape], draftShape: null, selectedShapeId: id }));
    return shape;
  },
  selectShape: (shapeId) => set(() => ({ selectedShapeId: shapeId })),
  moveShape: (shapeId, deltaX, deltaY) =>
    set((state) => ({
      shapes: state.shapes.map((shape) => {
        if (shape.id !== shapeId) {
          return shape;
        }

        if (shape.kind === 'rectangle') {
          return { ...shape, x: shape.x + deltaX, y: shape.y + deltaY };
        }

        if (shape.kind === 'circle') {
          return { ...shape, cx: shape.cx + deltaX, cy: shape.cy + deltaY };
        }

        return {
          ...shape,
          x1: shape.x1 + deltaX,
          y1: shape.y1 + deltaY,
          x2: shape.x2 + deltaX,
          y2: shape.y2 + deltaY,
        };
      }),
    })),
  getShapeById: (shapeId) => get().shapes.find((shape) => shape.id === shapeId),
}));
