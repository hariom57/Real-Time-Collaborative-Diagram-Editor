export type ToolId =
  | 'select'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'freehand'
  | 'text'
  | 'pan';

export type Point = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export type Camera = {
  x: number;
  y: number;
  zoom: number;
};

type ShapeBase = {
  id: string;
  stroke: string;
  fill: string;
  strokeWidth: number;
};

export type RectangleShape = ShapeBase & {
  kind: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
};

export type CircleShape = ShapeBase & {
  kind: 'circle';
  cx: number;
  cy: number;
  radius: number;
};

export type AttachmentPoint = {
  shapeId: string | null;
  point: Point;
};

export type LineShape = ShapeBase & {
  kind: 'line';
  start: AttachmentPoint;
  end: AttachmentPoint;
};

export type ArrowShape = ShapeBase & {
  kind: 'arrow';
  start: AttachmentPoint;
  end: AttachmentPoint;
};

export type FreehandShape = ShapeBase & {
  kind: 'freehand';
  points: Point[];
};

export type TextShape = ShapeBase & {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
};

export type DiagramShape =
  | RectangleShape
  | CircleShape
  | LineShape
  | ArrowShape
  | FreehandShape
  | TextShape;

export type ShapeKind = DiagramShape['kind'];

export type ResizeHandle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w';

export type SelectionState = {
  ids: string[];
  primaryId: string | null;
};

export type DraftShape =
  | { kind: 'rectangle'; start: Point; current: Point }
  | { kind: 'circle'; start: Point; current: Point }
  | { kind: 'line'; start: Point; current: Point; endAttachment: AttachmentPoint | null }
  | { kind: 'arrow'; start: Point; current: Point; endAttachment: AttachmentPoint | null }
  | { kind: 'freehand'; points: Point[] }
  | { kind: 'text'; point: Point };

export type ResizeState = {
  shapeId: string;
  handle: ResizeHandle;
  origin: DiagramShape;
};

export type DragState = {
  ids: string[];
  origin: Record<string, DiagramShape>;
  anchor: Point;
};

export type EditingTextState = {
  shapeId: string;
  draft: string;
};

export type DiagramDocument = {
  version: 1;
  shapes: DiagramShape[];
  camera: Camera;
};

export type BoardId = string;

export type BoardRecord = {
  id: BoardId;
  name: string;
  document: DiagramDocument;
  createdAt: string;
  updatedAt: string;
};

export type PresenceUser = {
  clientId: string;
  label: string;
  cursor: Point | null;
};

export type BoardSnapshotMessage = {
  type: 'board:snapshot';
  board: BoardRecord;
  presence: PresenceUser[];
};

export type BoardPresenceMessage = {
  type: 'board:presence';
  boardId: BoardId;
  users: PresenceUser[];
};

export type BoardStateMessage = {
  type: 'board:state';
  board: BoardRecord;
};

export type BoardJoinMessage = {
  type: 'board:join';
  boardId: BoardId;
  clientId: string;
  label?: string;
};

export type BoardLeaveMessage = {
  type: 'board:leave';
  boardId: BoardId;
  clientId: string;
};

export type BoardRequestMessage = {
  type: 'board:request';
  boardId: BoardId;
};

export type ShapeCreatedEvent = {
  type: 'shape:created';
  boardId: BoardId;
  shape: DiagramShape;
};

export type ShapeUpdatedEvent = {
  type: 'shape:updated';
  boardId: BoardId;
  shape: DiagramShape;
};

export type ShapeDeletedEvent = {
  type: 'shape:deleted';
  boardId: BoardId;
  shapeId: string;
};

export type TextUpdatedEvent = {
  type: 'text:updated';
  boardId: BoardId;
  shapeId: string;
  text: string;
};

export type BoardRenamedEvent = {
  type: 'board:renamed';
  boardId: BoardId;
  name: string;
};

export type BoardOperationMessage =
  | ShapeCreatedEvent
  | ShapeUpdatedEvent
  | ShapeDeletedEvent
  | TextUpdatedEvent
  | BoardRenamedEvent;

export type ClientToServerMessage = BoardJoinMessage | BoardLeaveMessage | BoardRequestMessage | BoardOperationMessage;

export type ServerToClientMessage = BoardStateMessage | BoardPresenceMessage | BoardOperationMessage;

export function isBoardId(value: string) {
  return /^[a-zA-Z0-9_-]{6,64}$/.test(value);
}

export type DiagramState = {
  shapes: DiagramShape[];
  camera: Camera;
  selection: SelectionState;
  activeTool: ToolId;
  draftShape: DraftShape | null;
  resizeState: ResizeState | null;
  dragState: DragState | null;
  editingText: EditingTextState | null;
};

export const DEFAULT_CAMERA: Camera = { x: 0, y: 0, zoom: 1 };

export const DEFAULT_SELECTION: SelectionState = { ids: [], primaryId: null };

export const STORAGE_KEY = 'nodeboard.diagram.v1';

export function makeEmptyDocument(): DiagramDocument {
  return {
    version: 1,
    shapes: [],
    camera: { ...DEFAULT_CAMERA },
  };
}

export function createId(prefix = 'shape') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

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

export function clampZoom(value: number) {
  return Math.min(2.5, Math.max(0.25, value));
}

export function cloneShape<T extends DiagramShape>(shape: T): T {
  return structuredClone(shape);
}
