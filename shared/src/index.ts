export type ToolId = 'select' | 'rectangle' | 'circle' | 'line';

export type Point = {
  x: number;
  y: number;
};

export type RectangleShape = {
  id: string;
  kind: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  fill: string;
};

export type CircleShape = {
  id: string;
  kind: 'circle';
  cx: number;
  cy: number;
  radius: number;
  stroke: string;
  fill: string;
};

export type LineShape = {
  id: string;
  kind: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  fill: string;
};

export type DiagramShape = RectangleShape | CircleShape | LineShape;

export type DraftShape =
  | { kind: 'rectangle'; start: Point; current: Point }
  | { kind: 'circle'; start: Point; current: Point }
  | { kind: 'line'; start: Point; current: Point };

export type DiagramState = {
  shapes: DiagramShape[];
  selectedShapeId: string | null;
  activeTool: ToolId;
  draftShape: DraftShape | null;
};

export function getCircleGeometry(start: Point, current: Point) {
  const left = Math.min(start.x, current.x);
  const top = Math.min(start.y, current.y);
  const size = Math.min(Math.abs(current.x - start.x), Math.abs(current.y - start.y));
  const radius = size / 2;

  return {
    cx: left + radius,
    cy: top + radius,
    radius,
  };
}
