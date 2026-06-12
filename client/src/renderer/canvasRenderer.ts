import { getCircleGeometry } from '@shared/index';
import type { DiagramShape, DraftShape, Point } from '@shared/index';

export function drawScene(
  context: CanvasRenderingContext2D,
  size: { width: number; height: number },
  shapes: DiagramShape[],
  draft: DraftShape | null,
) {
  context.clearRect(0, 0, size.width, size.height);
  paintBackground(context, size.width, size.height);
  paintGrid(context, size.width, size.height);

  shapes.forEach((shape) => drawShape(context, shape));

  if (draft) {
    drawDraft(context, draft);
  }
}

function paintBackground(context: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#f8fafc');
  gradient.addColorStop(1, '#e2e8f0');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function paintGrid(context: CanvasRenderingContext2D, width: number, height: number) {
  const gridSize = 32;
  context.save();
  context.strokeStyle = 'rgba(100, 116, 139, 0.16)';
  context.lineWidth = 1;

  for (let x = 0; x <= width; x += gridSize) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  for (let y = 0; y <= height; y += gridSize) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  context.restore();
}

function drawShape(context: CanvasRenderingContext2D, shape: DiagramShape) {
  context.save();
  context.lineWidth = 2;
  context.strokeStyle = shape.stroke;
  context.fillStyle = shape.fill;

  if (shape.kind === 'rectangle') {
    context.beginPath();
    context.roundRect(shape.x, shape.y, shape.width, shape.height, 12);
    context.fill();
    context.stroke();
  } else if (shape.kind === 'circle') {
    context.beginPath();
    context.arc(shape.cx, shape.cy, shape.radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else {
    context.beginPath();
    context.moveTo(shape.x1, shape.y1);
    context.lineTo(shape.x2, shape.y2);
    context.stroke();
  }

  context.restore();
}

function drawDraft(context: CanvasRenderingContext2D, draft: DraftShape) {
  context.save();
  context.setLineDash([8, 6]);
  context.lineWidth = 2;
  context.strokeStyle = '#2563eb';
  context.fillStyle = 'rgba(37, 99, 235, 0.14)';

  if (draft.kind === 'rectangle') {
    const x = Math.min(draft.start.x, draft.current.x);
    const y = Math.min(draft.start.y, draft.current.y);
    const width = Math.abs(draft.current.x - draft.start.x);
    const height = Math.abs(draft.current.y - draft.start.y);
    context.beginPath();
    context.roundRect(x, y, width, height, 12);
    context.fill();
    context.stroke();
  } else if (draft.kind === 'circle') {
    const { cx, cy, radius } = getCircleGeometry(draft.start, draft.current);
    context.beginPath();
    context.arc(cx, cy, Math.max(8, radius), 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else {
    context.beginPath();
    context.moveTo(draft.start.x, draft.start.y);
    context.lineTo(draft.current.x, draft.current.y);
    context.stroke();
  }

  context.restore();
}

export function toCanvasPoint(canvas: HTMLCanvasElement, event: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

export function getShapeAtPoint(shapes: DiagramShape[], point: Point): DiagramShape | undefined {
  for (let index = shapes.length - 1; index >= 0; index -= 1) {
    const shape = shapes[index];

    if (shape.kind === 'rectangle' && point.x >= shape.x && point.x <= shape.x + shape.width && point.y >= shape.y && point.y <= shape.y + shape.height) {
      return shape;
    }

    if (shape.kind === 'circle' && Math.hypot(point.x - shape.cx, point.y - shape.cy) <= shape.radius) {
      return shape;
    }

    if (shape.kind === 'line' && distanceFromPointToSegment(point, { x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 }) <= 8) {
      return shape;
    }
  }

  return undefined;
}

function distanceFromPointToSegment(point: Point, start: Point, end: Point) {
  const vectorX = end.x - start.x;
  const vectorY = end.y - start.y;
  const lengthSquared = vectorX * vectorX + vectorY * vectorY;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const projection = Math.max(0, Math.min(1, ((point.x - start.x) * vectorX + (point.y - start.y) * vectorY) / lengthSquared));
  const closestPoint = {
    x: start.x + projection * vectorX,
    y: start.y + projection * vectorY,
  };

  return Math.hypot(point.x - closestPoint.x, point.y - closestPoint.y);
}
