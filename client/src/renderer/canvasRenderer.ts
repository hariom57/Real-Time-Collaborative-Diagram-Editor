import type {
  AttachmentPoint,
  Camera,
  DiagramShape,
  DraftShape,
  Point,
  ResizeHandle,
  SelectionState,
  ShapeKind,
  Size,
  TextShape,
} from '@shared/index';

type SceneOptions = {
  selection: SelectionState;
  camera: Camera;
};

export function worldToScreen(point: Point, camera: Camera) {
  return {
    x: point.x * camera.zoom + camera.x,
    y: point.y * camera.zoom + camera.y,
  };
}

export function screenToWorld(point: Point, camera: Camera) {
  return {
    x: (point.x - camera.x) / camera.zoom,
    y: (point.y - camera.y) / camera.zoom,
  };
}

type CanvasPointerLikeEvent = Pick<PointerEvent, 'clientX' | 'clientY'>;

export function toCanvasPoint(canvas: HTMLCanvasElement, event: CanvasPointerLikeEvent): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

export function drawScene(
  context: CanvasRenderingContext2D,
  size: Size,
  shapes: DiagramShape[],
  draft: DraftShape | null,
  options: SceneOptions,
) {
  context.clearRect(0, 0, size.width, size.height);
  paintBackground(context, size, options.camera);
  paintGrid(context, size, options.camera);
  const orderedShapes = [...shapes];
  orderedShapes.forEach((shape) => drawShape(context, shape, options.camera, options.selection));
  if (draft) drawDraft(context, draft, options.camera);
  if (options.selection.ids.length) {
    drawSelection(context, shapes, options);
  }
}

function paintBackground(context: CanvasRenderingContext2D, size: Size, camera: Camera) {
  const gradient = context.createLinearGradient(0, 0, size.width, size.height);
  gradient.addColorStop(0, '#f8fafc');
  gradient.addColorStop(1, '#edf2ff');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size.width, size.height);
  context.fillStyle = 'rgba(255,255,255,0.35)';
  context.fillRect(0, 0, size.width, size.height);
}

function paintGrid(context: CanvasRenderingContext2D, size: Size, camera: Camera) {
  const gridSize = 40 * camera.zoom;
  context.save();
  context.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  context.lineWidth = 1;
  const offsetX = ((camera.x % gridSize) + gridSize) % gridSize;
  const offsetY = ((camera.y % gridSize) + gridSize) % gridSize;
  for (let x = offsetX; x < size.width; x += gridSize) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, size.height);
    context.stroke();
  }
  for (let y = offsetY; y < size.height; y += gridSize) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(size.width, y);
    context.stroke();
  }
  context.restore();
}

function drawShape(context: CanvasRenderingContext2D, shape: DiagramShape, camera: Camera, selection: SelectionState) {
  context.save();
  context.lineWidth = shape.strokeWidth * camera.zoom;
  context.strokeStyle = shape.stroke;
  context.fillStyle = shape.fill;
  context.scale(camera.zoom, camera.zoom);
  context.translate(camera.x / camera.zoom, camera.y / camera.zoom);
  if (shape.kind === 'rectangle') {
    context.beginPath();
    context.roundRect(shape.x, shape.y, shape.width, shape.height, shape.radius ?? 12);
    context.fill();
    context.stroke();
  } else if (shape.kind === 'circle') {
    context.beginPath();
    context.arc(shape.cx, shape.cy, shape.radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else if (shape.kind === 'line' || shape.kind === 'arrow') {
    drawConnector(context, shape.kind, shape.start, shape.end);
  } else if (shape.kind === 'freehand') {
    drawFreehand(context, shape.points);
  } else if (shape.kind === 'text') {
    drawText(context, shape);
  }
  context.restore();
}

function drawConnector(
  context: CanvasRenderingContext2D,
  kind: 'line' | 'arrow',
  start: AttachmentPoint,
  end: AttachmentPoint,
) {
  context.beginPath();
  context.moveTo(start.point.x, start.point.y);
  context.lineTo(end.point.x, end.point.y);
  context.stroke();
  if (kind === 'arrow') {
    drawArrowhead(context, start.point, end.point);
  }
}

function drawArrowhead(context: CanvasRenderingContext2D, start: Point, end: Point) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const size = 12;
  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(end.x - size * Math.cos(angle - Math.PI / 6), end.y - size * Math.sin(angle - Math.PI / 6));
  context.lineTo(end.x - size * Math.cos(angle + Math.PI / 6), end.y - size * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fill();
}

function drawFreehand(context: CanvasRenderingContext2D, points: Point[]) {
  if (points.length < 2) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const point = points[i];
    const midX = (prev.x + point.x) / 2;
    const midY = (prev.y + point.y) / 2;
    context.quadraticCurveTo(prev.x, prev.y, midX, midY);
  }
  context.stroke();
}

function drawText(context: CanvasRenderingContext2D, shape: TextShape) {
  context.font = `${shape.fontSize}px ${shape.fontFamily}`;
  context.textBaseline = 'top';
  context.fillStyle = '#0f172a';
  wrapText(context, shape.text || '', shape.x, shape.y, Math.max(120, Math.max(1, shape.text.length) * shape.fontSize * 0.5), shape.fontSize * 1.35);
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  let line = '';
  let cursorY = y;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) context.fillText(line, x, cursorY);
}

function drawDraft(context: CanvasRenderingContext2D, draft: DraftShape, camera: Camera) {
  context.save();
  context.scale(camera.zoom, camera.zoom);
  context.translate(camera.x / camera.zoom, camera.y / camera.zoom);
  context.setLineDash([8, 6]);
  context.lineWidth = 2;
  context.strokeStyle = '#2563eb';
  context.fillStyle = 'rgba(37, 99, 235, 0.12)';
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
    const { cx, cy, radius } = requireCircleGeometry(draft.start, draft.current);
    context.beginPath();
    context.arc(cx, cy, Math.max(14, radius), 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else if (draft.kind === 'line' || draft.kind === 'arrow') {
    context.beginPath();
    context.moveTo(draft.start.x, draft.start.y);
    context.lineTo(draft.current.x, draft.current.y);
    context.stroke();
  } else if (draft.kind === 'freehand') {
    drawFreehand(context, draft.points);
  } else if (draft.kind === 'text') {
    context.strokeRect(draft.point.x, draft.point.y - 20, 180, 40);
  }
  context.restore();
}

function drawSelection(context: CanvasRenderingContext2D, shapes: DiagramShape[], options: SceneOptions) {
  const selected = shapes.filter((shape) => options.selection.ids.includes(shape.id));
  if (!selected.length) return;
  context.save();
  context.scale(options.camera.zoom, options.camera.zoom);
  context.translate(options.camera.x / options.camera.zoom, options.camera.y / options.camera.zoom);
  context.setLineDash([6, 4]);
  context.lineWidth = 1.5 / options.camera.zoom;
  context.strokeStyle = '#2563eb';
  context.fillStyle = '#ffffff';
  for (const shape of selected) {
    const box = getBoundingBox(shape);
    context.strokeRect(box.x - 6, box.y - 6, box.width + 12, box.height + 12);
    for (const handle of handlesForBox(box)) {
      context.beginPath();
      context.arc(handle.x, handle.y, 5 / options.camera.zoom, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
  }
  context.restore();
}

function getBoundingBox(shape: DiagramShape) {
  if (shape.kind === 'rectangle') return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  if (shape.kind === 'circle') return { x: shape.cx - shape.radius, y: shape.cy - shape.radius, width: shape.radius * 2, height: shape.radius * 2 };
  if (shape.kind === 'text') return { x: shape.x, y: shape.y - shape.fontSize, width: Math.max(120, shape.text.length * shape.fontSize * 0.55), height: shape.fontSize * 1.4 };
  const points = shape.kind === 'freehand' ? shape.points : [shape.start.point, shape.end.point];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

function handlesForBox(box: { x: number; y: number; width: number; height: number }) {
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.width / 2, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height / 2 },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x + box.width / 2, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
    { x: box.x, y: box.y + box.height / 2 },
  ];
}

function requireCircleGeometry(start: Point, current: Point) {
  const left = Math.min(start.x, current.x);
  const top = Math.min(start.y, current.y);
  const size = Math.min(Math.abs(current.x - start.x), Math.abs(current.y - start.y));
  const radius = size / 2;
  return { cx: left + radius, cy: top + radius, radius };
}

export function hitTest(shape: DiagramShape, point: Point) {
  if (shape.kind === 'rectangle') return point.x >= shape.x && point.x <= shape.x + shape.width && point.y >= shape.y && point.y <= shape.y + shape.height;
  if (shape.kind === 'circle') return Math.hypot(point.x - shape.cx, point.y - shape.cy) <= shape.radius;
  if (shape.kind === 'text') return point.x >= shape.x && point.x <= shape.x + Math.max(120, shape.text.length * shape.fontSize * 0.55) && point.y >= shape.y - shape.fontSize && point.y <= shape.y + shape.fontSize;
  if (shape.kind === 'freehand') return distanceToPolyline(point, shape.points) <= 8;
  return distanceToSegment(point, shape.start.point, shape.end.point) <= 8;
}

export function hitHandle(shape: DiagramShape, point: Point, zoom: number): ResizeHandle | null {
  const box = getBoundingBox(shape);
  const size = 8 / zoom;
  const handles = handlesForBox(box);
  const ids: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  for (let i = 0; i < handles.length; i += 1) {
    const handle = handles[i];
    if (Math.abs(point.x - handle.x) <= size && Math.abs(point.y - handle.y) <= size) {
      return ids[i];
    }
  }
  return null;
}

export function distanceToSegment(point: Point, start: Point, end: Point) {
  const vx = end.x - start.x;
  const vy = end.y - start.y;
  const lengthSq = vx * vx + vy * vy;
  if (lengthSq === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * vx + (point.y - start.y) * vy) / lengthSq));
  const closest = { x: start.x + t * vx, y: start.y + t * vy };
  return Math.hypot(point.x - closest.x, point.y - closest.y);
}

function distanceToPolyline(point: Point, points: Point[]) {
  let min = Infinity;
  for (let i = 1; i < points.length; i += 1) {
    min = Math.min(min, distanceToSegment(point, points[i - 1], points[i]));
  }
  return min;
}
