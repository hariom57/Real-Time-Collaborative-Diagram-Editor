import { useEffect, useRef, useState } from 'react';
import type { Point, DiagramShape, DraftShape } from '@shared/index';
import { useCanvasStore } from '../store/canvasStore';
import { drawScene, getShapeAtPoint, toCanvasPoint } from '../renderer/canvasRenderer';

type DragState = {
  shapeId: string;
  startPoint: Point;
  origin: Point;
};

export function CanvasEditor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [size, setSize] = useState({ width: 1200, height: 800 });

  const shapes = useCanvasStore((state) => state.shapes);
  const activeTool = useCanvasStore((state) => state.activeTool);
  const draftShape = useCanvasStore((state) => state.draftShape);
  const selectShape = useCanvasStore((state) => state.selectShape);
  const startDraft = useCanvasStore((state) => state.startDraft);
  const updateDraft = useCanvasStore((state) => state.updateDraft);
  const finishDraft = useCanvasStore((state) => state.finishDraft);
  const moveShape = useCanvasStore((state) => state.moveShape);
  const getShapeById = useCanvasStore((state) => state.getShapeById);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const { width, height } = entry.contentRect;
      setSize({ width: Math.max(800, Math.floor(width)), height: Math.max(600, Math.floor(height)) });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    drawScene(context, size, shapes, draftShape);
  }, [draftShape, shapes, size]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const point = toCanvasPoint(canvas, event.nativeEvent);

    if (activeTool === 'select') {
      const hitShape = getShapeAtPoint(shapes, point);
      selectShape(hitShape?.id ?? null);

      if (hitShape) {
        dragStateRef.current = {
          shapeId: hitShape.id,
          startPoint: point,
          origin: getShapeOrigin(hitShape),
        };
      }

      return;
    }

    const draft: DraftShape = {
      kind: activeTool as Exclude<DraftShape['kind'], never>,
      start: point,
      current: point,
    };

    startDraft(draft);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const point = toCanvasPoint(canvas, event.nativeEvent);

    if (dragStateRef.current) {
      const dragState = dragStateRef.current;
      const deltaX = point.x - dragState.startPoint.x;
      const deltaY = point.y - dragState.startPoint.y;

      if (getShapeById(dragState.shapeId)) {
        moveShape(dragState.shapeId, deltaX, deltaY);
        dragStateRef.current = {
          ...dragState,
          startPoint: point,
          origin: {
            x: dragState.origin.x + deltaX,
            y: dragState.origin.y + deltaY,
          },
        };
      }

      return;
    }

    updateDraft(point);
  };

  const handlePointerUp = () => {
    if (dragStateRef.current) {
      dragStateRef.current = null;
      return;
    }

    const createdShape = finishDraft();
    if (createdShape) {
      selectShape(createdShape.id);
    }
  };

  return (
    <section className="canvas-shell" ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={size.width}
        height={size.height}
        className="diagram-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </section>
  );
}

function getShapeOrigin(shape: DiagramShape): Point {
  if (shape.kind === 'rectangle') {
    return { x: shape.x, y: shape.y };
  }

  if (shape.kind === 'circle') {
    return { x: shape.cx, y: shape.cy };
  }

  return { x: shape.x1, y: shape.y1 };
}
