import { create } from 'zustand';
import {
  DEFAULT_CAMERA,
  DEFAULT_SELECTION,
  STORAGE_KEY,
  clampZoom,
  createId,
  getCircleGeometry,
  makeEmptyDocument,
} from '@shared/index';
import { publishBoardRenamed, publishShapeCreated, publishShapeDeleted, publishShapeUpdated, publishTextUpdated } from '../collaboration';
import type {
  AttachmentPoint,
  Camera,
  BoardRecord,
  DiagramDocument,
  DiagramShape,
  DraftShape,
  EditingTextState,
  Point,
  ResizeHandle,
  ResizeState,
  SelectionState,
  ShapeKind,
  ToolId,
} from '@shared/index';

type HistoryEntry = {
  version: 1;
  shapes: DiagramShape[];
};

type CanvasStore = {
  shapes: DiagramShape[];
  camera: Camera;
  selection: SelectionState;
  activeTool: ToolId;
  draftShape: DraftShape | null;
  resizeState: ResizeState | null;
  dragState: { ids: string[]; origin: Record<string, DiagramShape>; anchor: Point } | null;
  editingText: EditingTextState | null;
  historyPast: HistoryEntry[];
  historyFuture: HistoryEntry[];
  initialized: boolean;
  boardId: string | null;
  boardName: string;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  presence: { clientId: string; label: string; cursor: Point | null }[];
  saveStatus: 'idle' | 'saving' | 'saved' | 'offline' | 'error';
  setInitialized: () => void;
  setBoardFromServer: (board: BoardRecord) => void;
  setConnectionStatus: (status: 'disconnected' | 'connecting' | 'connected') => void;
  setPresence: (presence: { clientId: string; label: string; cursor: Point | null }[]) => void;
  setSaveStatus: (status: 'idle' | 'saving' | 'saved' | 'offline' | 'error') => void;
  setBoardName: (name: string) => void;
  renameBoard: (name: string) => void;
  applyRemoteMessage: (message: import('@shared/index').ServerToClientMessage) => void;
  setTool: (tool: ToolId) => void;
  setCamera: (camera: Camera) => void;
  panCamera: (dx: number, dy: number) => void;
  zoomCameraAt: (factor: number, focus: Point) => void;
  selectShapes: (ids: string[], primaryId?: string | null) => void;
  clearSelection: () => void;
  startDraft: (draft: DraftShape) => void;
  updateDraft: (draft: DraftShape) => void;
  cancelDraft: () => void;
  commitDraft: () => DiagramShape | null;
  beginDrag: (ids: string[], anchor: Point) => void;
  updateDrag: (point: Point) => void;
  endDrag: () => void;
  beginResize: (shapeId: string, handle: ResizeHandle) => void;
  updateResize: (point: Point) => void;
  endResize: () => void;
  addTextDraft: (point: Point) => void;
  updateTextDraft: (text: string) => void;
  commitTextDraft: () => DiagramShape | null;
  openTextEditor: (shapeId: string) => void;
  commitTextEdit: () => void;
  updateShapeText: (shapeId: string, text: string, commit?: boolean) => void;
  deleteSelected: () => void;
  moveShapes: (ids: string[], delta: Point, commit?: boolean) => void;
  resizeShape: (shapeId: string, handle: ResizeHandle, point: Point, commit?: boolean) => void;
  updateShape: (shapeId: string, updater: (shape: DiagramShape) => DiagramShape, commit?: boolean) => void;
  undo: () => void;
  redo: () => void;
  hydrate: () => void;
  persist: () => void;
  resetToDefault: () => void;
  getShapeById: (shapeId: string) => DiagramShape | undefined;
  replaceShapes: (shapes: DiagramShape[], commit?: boolean) => void;
};

const starterDocument = makeEmptyDocument();

function createHistoryEntry(state: CanvasStore): HistoryEntry {
  return {
    version: 1,
    shapes: structuredClone(state.shapes),
  };
}

function snapshotFromState(state: CanvasStore): HistoryEntry {
  return createHistoryEntry(state);
}

function pushHistory(set: (updater: (state: CanvasStore) => Partial<CanvasStore>) => void, getState: () => CanvasStore) {
  const current = snapshotFromState(getState());
  set((state) => ({
    historyPast: [...state.historyPast, current],
    historyFuture: [],
  }));
}

function normalizeSelection(ids: string[], primaryId?: string | null): SelectionState {
  const uniqueIds = Array.from(new Set(ids));
  return {
    ids: uniqueIds,
    primaryId: primaryId ?? uniqueIds.at(-1) ?? null,
  };
}

function getBoundingBox(shape: DiagramShape) {
  if (shape.kind === 'rectangle') {
    return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  }

  if (shape.kind === 'circle') {
    return { x: shape.cx - shape.radius, y: shape.cy - shape.radius, width: shape.radius * 2, height: shape.radius * 2 };
  }

  if (shape.kind === 'text') {
    return { x: shape.x, y: shape.y - shape.fontSize, width: Math.max(60, shape.text.length * shape.fontSize * 0.55), height: shape.fontSize * 1.4 };
  }

  if (shape.kind === 'freehand') {
    const xs = shape.points.map((point) => point.x);
    const ys = shape.points.map((point) => point.y);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  }

  const xs = [resolveAttachment(shape.start).x, resolveAttachment(shape.end).x];
  const ys = [resolveAttachment(shape.start).y, resolveAttachment(shape.end).y];
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.abs(xs[1] - xs[0]), height: Math.abs(ys[1] - ys[0]) };
}

function resolveAttachment(attachment: AttachmentPoint): Point {
  return attachment.point;
}

function applyMovement(shape: DiagramShape, delta: Point): DiagramShape {
  switch (shape.kind) {
    case 'rectangle':
      return { ...shape, x: shape.x + delta.x, y: shape.y + delta.y };
    case 'circle':
      return { ...shape, cx: shape.cx + delta.x, cy: shape.cy + delta.y };
    case 'text':
      return { ...shape, x: shape.x + delta.x, y: shape.y + delta.y };
    case 'freehand':
      return { ...shape, points: shape.points.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y })) };
    case 'line':
    case 'arrow':
      return {
        ...shape,
        start: { ...shape.start, point: { x: shape.start.point.x + delta.x, y: shape.start.point.y + delta.y } },
        end: { ...shape.end, point: { x: shape.end.point.x + delta.x, y: shape.end.point.y + delta.y } },
      };
  }
}

function moveAnchor(shape: DiagramShape, delta: Point, handle: ResizeHandle): DiagramShape {
  if (shape.kind === 'rectangle') {
    const box = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
    let { x, y, width, height } = box;
    if (handle.includes('w')) {
      x += delta.x;
      width -= delta.x;
    }
    if (handle.includes('e')) {
      width += delta.x;
    }
    if (handle.includes('n')) {
      y += delta.y;
      height -= delta.y;
    }
    if (handle.includes('s')) {
      height += delta.y;
    }
    return { ...shape, x, y, width: Math.max(16, width), height: Math.max(16, height) };
  }

  if (shape.kind === 'circle') {
    const radius = Math.max(16, shape.radius + Math.max(delta.x, delta.y) / 2);
    return { ...shape, radius };
  }

  return shape;
}

function shapeFromTool(draft: DraftShape): DiagramShape | null {
  const base = {
    id: createId(),
    stroke: '#1f2937',
    fill: 'rgba(255,255,255,0.92)',
    strokeWidth: 2,
  };

  if (draft.kind === 'rectangle') {
    const x = Math.min(draft.start.x, draft.current.x);
    const y = Math.min(draft.start.y, draft.current.y);
    const width = Math.max(24, Math.abs(draft.current.x - draft.start.x));
    const height = Math.max(24, Math.abs(draft.current.y - draft.start.y));
    return { ...base, kind: 'rectangle', x, y, width, height, fill: 'rgba(219,234,254,0.9)', stroke: '#1d4ed8', radius: 14 };
  }

  if (draft.kind === 'circle') {
    const { cx, cy, radius } = getCircleGeometry(draft.start, draft.current);
    return { ...base, kind: 'circle', cx, cy, radius: Math.max(14, radius), fill: 'rgba(254,215,170,0.9)', stroke: '#c2410c' };
  }

  if (draft.kind === 'line' || draft.kind === 'arrow') {
    return {
      ...base,
      kind: draft.kind,
      stroke: '#374151',
      fill: '#374151',
      start: { shapeId: null, point: draft.start },
      end: { shapeId: draft.endAttachment?.shapeId ?? null, point: draft.current },
    };
  }

  if (draft.kind === 'freehand') {
    return {
      ...base,
      kind: 'freehand',
      stroke: '#111827',
      fill: 'transparent',
      points: draft.points.length > 1 ? draft.points : [...draft.points, { x: draft.points[0].x + 0.1, y: draft.points[0].y + 0.1 }],
    };
  }

  return {
    ...base,
    kind: 'text',
    stroke: 'transparent',
    fill: 'transparent',
    x: draft.point.x,
    y: draft.point.y,
    text: '',
    fontSize: 18,
    fontFamily: 'Inter, Segoe UI, sans-serif',
  };
}

function loadDocument(): DiagramDocument {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return starterDocument;
  try {
    const parsed = JSON.parse(raw) as DiagramDocument;
    if (parsed && parsed.version === 1 && Array.isArray(parsed.shapes) && parsed.camera) {
      return {
        version: 1,
        shapes: parsed.shapes,
        camera: {
          x: Number(parsed.camera.x) || 0,
          y: Number(parsed.camera.y) || 0,
          zoom: clampZoom(Number(parsed.camera.zoom) || 1),
        },
      };
    }
  } catch {
    return starterDocument;
  }
  return starterDocument;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  shapes: [],
  camera: { ...DEFAULT_CAMERA },
  selection: { ...DEFAULT_SELECTION },
  activeTool: 'select',
  draftShape: null,
  resizeState: null,
  dragState: null,
  editingText: null,
  historyPast: [],
  historyFuture: [],
  initialized: false,
  boardId: null,
  boardName: 'Untitled Board',
  connectionStatus: 'disconnected',
  presence: [],
  saveStatus: 'idle',
  setInitialized: () => set({ initialized: true }),
  setBoardFromServer: (board) => set({ shapes: board.document.shapes, camera: board.document.camera, boardId: board.id, boardName: board.name }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setPresence: (presence) => set({ presence }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setBoardName: (name) => set({ boardName: name }),
  applyRemoteMessage: (message) => {
    if (message.type === 'shape:created') {
      set((state) => ({ shapes: [...state.shapes, message.shape] }));
    } else if (message.type === 'shape:updated') {
      set((state) => ({ shapes: state.shapes.map((item) => (item.id === message.shape.id ? message.shape : item)) }));
    } else if (message.type === 'shape:deleted') {
      set((state) => ({ shapes: state.shapes.filter((shape) => shape.id !== message.shapeId) }));
    } else if (message.type === 'text:updated') {
      set((state) => ({ shapes: state.shapes.map((shape) => (shape.id === message.shapeId && shape.kind === 'text' ? { ...shape, text: message.text } : shape)) }));
    } else if (message.type === 'board:renamed') {
      set({ boardName: message.name });
    }
  },
  setTool: (tool) =>
    set((state) => ({
      activeTool: tool,
      draftShape: null,
      resizeState: null,
      dragState: null,
      editingText: tool === 'text' ? state.editingText : null,
    })),
  setCamera: (camera) => set({ camera: { ...camera, zoom: clampZoom(camera.zoom) } }),
  panCamera: (dx, dy) => set((state) => ({ camera: { ...state.camera, x: state.camera.x + dx, y: state.camera.y + dy } })),
  zoomCameraAt: (factor, focus) =>
    set((state) => {
      const nextZoom = clampZoom(state.camera.zoom * factor);
      const worldX = (focus.x - state.camera.x) / state.camera.zoom;
      const worldY = (focus.y - state.camera.y) / state.camera.zoom;
      return {
        camera: {
          zoom: nextZoom,
          x: focus.x - worldX * nextZoom,
          y: focus.y - worldY * nextZoom,
        },
      };
    }),
  selectShapes: (ids, primaryId) => set({ selection: normalizeSelection(ids, primaryId) }),
  clearSelection: () => set({ selection: { ...DEFAULT_SELECTION } }),
  startDraft: (draft) => set({ draftShape: draft }),
  updateDraft: (draft) => set({ draftShape: draft }),
  cancelDraft: () => set({ draftShape: null, resizeState: null, dragState: null, editingText: null }),
  commitDraft: () => {
    const draft = get().draftShape;
    if (!draft) return null;
    const shape = shapeFromTool(draft);
    if (!shape) return null;
    pushHistory(set, get);
    set((state) => ({
      shapes: [...state.shapes, shape],
      draftShape: null,
      selection: { ids: [shape.id], primaryId: shape.id },
    }));
    publishShapeCreated(shape);
    return shape;
  },
  beginDrag: (ids, anchor) => {
    pushHistory(set, get);
    set({
      dragState: {
        ids,
        origin: Object.fromEntries(
          ids.map((id) => [id, structuredClone(get().getShapeById(id)!)]) as Array<[string, DiagramShape]>,
        ),
        anchor,
      },
    });
  },
  updateDrag: (point) =>
    set((state) => {
      if (!state.dragState) return state;
      const delta = { x: point.x - state.dragState.anchor.x, y: point.y - state.dragState.anchor.y };
      return {
        shapes: state.shapes.map((shape) => (state.dragState!.ids.includes(shape.id) ? applyMovement(state.dragState!.origin[shape.id] ?? shape, delta) : shape)),
      };
    }),
  endDrag: () => {
    const dragState = get().dragState;
    if (dragState) {
      for (const id of dragState.ids) {
        const shape = get().getShapeById(id);
        if (shape) publishShapeUpdated(shape);
      }
    }
    set({ dragState: null });
  },
  beginResize: (shapeId, handle) => {
    const origin = get().getShapeById(shapeId);
    if (!origin) return;
    pushHistory(set, get);
    set({ resizeState: { shapeId, handle, origin: structuredClone(origin) } });
  },
  updateResize: (point) =>
    set((state) => {
      if (!state.resizeState) return state;
      const { handle, origin, shapeId } = state.resizeState;
      const delta = { x: point.x - (origin.kind === 'circle' ? origin.cx : origin.kind === 'rectangle' ? origin.x : 0), y: point.y - (origin.kind === 'circle' ? origin.cy : origin.kind === 'rectangle' ? origin.y : 0) };
      const nextShape = moveAnchor(origin, delta, handle);
      return { shapes: state.shapes.map((shape) => (shape.id === shapeId ? nextShape : shape)) };
    }),
  endResize: () => {
    const resizeState = get().resizeState;
    if (resizeState) {
      const shape = get().getShapeById(resizeState.shapeId);
      if (shape) publishShapeUpdated(shape);
    }
    set({ resizeState: null });
  },
  addTextDraft: (point) => set({ draftShape: { kind: 'text', point } }),
  updateTextDraft: (text) =>
    set((state) =>
      state.editingText ? { editingText: { ...state.editingText, draft: text } } : state,
    ),
  commitTextDraft: () => {
    const draft = get().draftShape;
    if (!draft || draft.kind !== 'text') return null;
    pushHistory(set, get);
    const shape = shapeFromTool(draft);
    if (!shape || shape.kind !== 'text') return null;
    set((state) => ({ shapes: [...state.shapes, shape], draftShape: null, selection: { ids: [shape.id], primaryId: shape.id } }));
    publishShapeCreated(shape);
    return shape;
  },
  openTextEditor: (shapeId) => {
    const shape = get().getShapeById(shapeId);
    if (!shape || shape.kind !== 'text') return;
    set({ editingText: { shapeId, draft: shape.text } });
  },
  commitTextEdit: () => {
    const editing = get().editingText;
    if (!editing) return;
    pushHistory(set, get);
    set((state) => ({
      shapes: state.shapes.map((shape) => (shape.id === editing.shapeId && shape.kind === 'text' ? { ...shape, text: editing.draft } : shape)),
      editingText: null,
    }));
    publishTextUpdated(editing.shapeId, editing.draft);
  },
  renameBoard: (name) => set({ boardName: name, saveStatus: 'saving' }),
  updateShapeText: (shapeId, text, commit = false) =>
    set((state) => ({
      shapes: state.shapes.map((shape) => (shape.id === shapeId && shape.kind === 'text' ? { ...shape, text } : shape)),
      editingText: commit
        ? null
        : state.editingText && state.editingText.shapeId === shapeId
          ? { ...state.editingText, draft: text }
          : state.editingText,
    })),
  deleteSelected: () => {
    const { selection } = get();
    if (!selection.ids.length) return;
    pushHistory(set, get);
    set((state) => ({
      shapes: state.shapes.filter((shape) => !selection.ids.includes(shape.id)),
      selection: { ...DEFAULT_SELECTION },
    }));
    for (const id of selection.ids) publishShapeDeleted(id);
  },
  moveShapes: (ids, delta, commit = false) => {
    if (commit) pushHistory(set, get);
    set((state) => ({
      shapes: state.shapes.map((shape) => (ids.includes(shape.id) ? applyMovement(shape, delta) : shape)),
    }));
  },
  resizeShape: (shapeId, handle, point, commit = false) => {
    const shape = get().getShapeById(shapeId);
    if (!shape) return;
    if (commit) pushHistory(set, get);
    const delta = { x: point.x, y: point.y };
    set((state) => ({ shapes: state.shapes.map((item) => (item.id === shapeId ? moveAnchor(shape, delta, handle) : item)) }));
  },
  updateShape: (shapeId, updater, commit = false) => {
    if (commit) pushHistory(set, get);
    set((state) => ({ shapes: state.shapes.map((shape) => (shape.id === shapeId ? updater(shape) : shape)) }));
  },
  undo: () => {
    const state = get();
    if (!state.historyPast.length) return;
    const previous = state.historyPast.at(-1)!;
    set({
      shapes: structuredClone(previous.shapes),
      historyPast: state.historyPast.slice(0, -1),
      historyFuture: [snapshotFromState(state), ...state.historyFuture],
      draftShape: null,
      resizeState: null,
      dragState: null,
      editingText: null,
    });
  },
  redo: () => {
    const state = get();
    if (!state.historyFuture.length) return;
    const [next, ...rest] = state.historyFuture;
    set({
      shapes: structuredClone(next.shapes),
      historyPast: [...state.historyPast, snapshotFromState(state)],
      historyFuture: rest,
      draftShape: null,
      resizeState: null,
      dragState: null,
      editingText: null,
    });
  },
  hydrate: () => {
    const document = loadDocument();
    set({
      shapes: document.shapes,
      camera: document.camera,
      initialized: true,
    });
  },
  persist: () => {
    const state = get();
    const document: DiagramDocument = {
      version: 1,
      shapes: state.shapes,
      camera: state.camera,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
  },
  resetToDefault: () => {
    set({
      shapes: [],
      camera: { ...DEFAULT_CAMERA },
      selection: { ...DEFAULT_SELECTION },
      boardName: 'Untitled Board',
      draftShape: null,
      resizeState: null,
      dragState: null,
      editingText: null,
      historyPast: [],
      historyFuture: [],
    });
  },
  getShapeById: (shapeId) => get().shapes.find((shape) => shape.id === shapeId),
  replaceShapes: (shapes, commit = false) => {
    if (commit) pushHistory(set, get);
    set({ shapes });
  },
}));
