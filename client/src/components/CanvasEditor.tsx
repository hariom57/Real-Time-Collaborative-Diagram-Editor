import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { DiagramShape, Point, ResizeHandle } from '@shared/index';
import { useCanvasStore } from '../store/canvasStore';
import { drawScene, hitHandle, hitTest, screenToWorld, toCanvasPoint, worldToScreen } from '../renderer/canvasRenderer';

type InteractionMode = 'idle' | 'drawing' | 'dragging' | 'resizing' | 'panning' | 'editing-text';

export function CanvasEditor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<{
    mode: InteractionMode;
    pointerId: number | null;
    start: Point | null;
    last: Point | null;
    handle: ResizeHandle | null;
    selectedIds: string[];
  }>({ mode: 'idle', pointerId: null, start: null, last: null, handle: null, selectedIds: [] });
  const [size, setSize] = useState({ width: 1200, height: 800 });
  const [spacePressed, setSpacePressed] = useState(false);

  const shapes = useCanvasStore((state) => state.shapes);
  const camera = useCanvasStore((state) => state.camera);
  const selection = useCanvasStore((state) => state.selection);
  const activeTool = useCanvasStore((state) => state.activeTool);
  const draftShape = useCanvasStore((state) => state.draftShape);
  const editingText = useCanvasStore((state) => state.editingText);
  const setTool = useCanvasStore((state) => state.setTool);
  const selectShapes = useCanvasStore((state) => state.selectShapes);
  const clearSelection = useCanvasStore((state) => state.clearSelection);
  const startDraft = useCanvasStore((state) => state.startDraft);
  const updateDraft = useCanvasStore((state) => state.updateDraft);
  const commitDraft = useCanvasStore((state) => state.commitDraft);
  const addTextDraft = useCanvasStore((state) => state.addTextDraft);
  const commitTextDraft = useCanvasStore((state) => state.commitTextDraft);
  const cancelDraft = useCanvasStore((state) => state.cancelDraft);
  const beginDrag = useCanvasStore((state) => state.beginDrag);
  const updateDrag = useCanvasStore((state) => state.updateDrag);
  const endDrag = useCanvasStore((state) => state.endDrag);
  const beginResize = useCanvasStore((state) => state.beginResize);
  const updateResize = useCanvasStore((state) => state.updateResize);
  const endResize = useCanvasStore((state) => state.endResize);
  const openTextEditor = useCanvasStore((state) => state.openTextEditor);
  const commitTextEdit = useCanvasStore((state) => state.commitTextEdit);
  const updateShapeText = useCanvasStore((state) => state.updateShapeText);
  const deleteSelected = useCanvasStore((state) => state.deleteSelected);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const panCamera = useCanvasStore((state) => state.panCamera);
  const zoomCameraAt = useCanvasStore((state) => state.zoomCameraAt);
  const persist = useCanvasStore((state) => state.persist);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ width: Math.max(800, Math.floor(entry.contentRect.width)), height: Math.max(560, Math.floor(entry.contentRect.height)) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    drawScene(context, size, shapes, draftShape, { selection, camera });
  }, [camera, draftShape, selection, shapes, size]);

  useEffect(() => {
    persist();
  }, [camera, persist, shapes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (event: WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      const insideCanvas =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!insideCanvas) return;

      event.preventDefault();
      const screenPoint = toCanvasPoint(canvas, event);

      if (event.ctrlKey || event.metaKey) {
        const zoomFactor = Math.exp(-event.deltaY * 0.0015);
        zoomCameraAt(zoomFactor, screenPoint);
        return;
      }

      panCamera(-event.deltaX, -event.deltaY);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [panCamera, zoomCameraAt]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.code === 'Space') setSpacePressed(true);
      if (event.key === 'Escape') {
        cancelDraft();
        clearSelection();
        if (editingText) commitTextEdit();
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        deleteSelected();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpacePressed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [cancelDraft, clearSelection, commitTextEdit, deleteSelected, editingText, redo, undo]);

  useEffect(() => {
    const handler = () => {
      if (editingText) commitTextEdit();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [commitTextEdit, editingText]);

  const cursor = useMemo(() => {
    if (interactionRef.current.mode === 'panning' || spacePressed || activeTool === 'pan') return 'grab';
    if (interactionRef.current.mode === 'resizing') return 'nwse-resize';
    if (activeTool === 'text') return 'text';
    if (activeTool === 'select') return 'default';
    return 'crosshair';
  }, [activeTool, spacePressed]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    const screenPoint = toCanvasPoint(canvas, event.nativeEvent);
    const worldPoint = screenToWorld(screenPoint, camera);
    const hitShape = getTopHit(shapes, worldPoint);
    const existingHandle = hitShape ? hitHandle(hitShape, worldPoint, camera.zoom) : null;
    interactionRef.current = { mode: 'idle', pointerId: event.pointerId, start: worldPoint, last: worldPoint, handle: existingHandle, selectedIds: selection.ids };

    if (activeTool === 'pan' || spacePressed || event.button === 1) {
      interactionRef.current.mode = 'panning';
      return;
    }

    if (activeTool === 'select') {
      if (hitShape && existingHandle) {
        interactionRef.current.mode = 'resizing';
        beginResize(hitShape.id, existingHandle);
        selectShapes([hitShape.id], hitShape.id);
        return;
      }
      if (hitShape) {
        const nextSelection = event.shiftKey ? toggleSelection(selection.ids, hitShape.id) : [hitShape.id];
        selectShapes(nextSelection, hitShape.id);
        interactionRef.current.mode = 'dragging';
        beginDrag(nextSelection, worldPoint);
        return;
      }
      clearSelection();
      return;
    }

    if (activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'line' || activeTool === 'arrow') {
      startDraft({ kind: activeTool, start: worldPoint, current: worldPoint, endAttachment: null });
      interactionRef.current.mode = 'drawing';
      return;
    }

    if (activeTool === 'freehand') {
      startDraft({ kind: 'freehand', points: [worldPoint] });
      interactionRef.current.mode = 'drawing';
      return;
    }

    if (activeTool === 'text') {
      addTextDraft(worldPoint);
      const shape = commitTextDraft();
      if (shape) {
        selectShapes([shape.id], shape.id);
        openTextEditor(shape.id);
        interactionRef.current.mode = 'editing-text';
      }
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const screenPoint = toCanvasPoint(canvas, event.nativeEvent as PointerEvent);
    const worldPoint = screenToWorld(screenPoint, camera);
    const interaction = interactionRef.current;
    interaction.last = worldPoint;

    if (interaction.mode === 'panning' && interaction.start) {
      const delta = { x: worldPoint.x - interaction.start.x, y: worldPoint.y - interaction.start.y };
      panCamera(delta.x * camera.zoom, delta.y * camera.zoom);
      interaction.start = worldPoint;
      return;
    }

    if (interaction.mode === 'dragging') {
      updateDrag(worldPoint);
      return;
    }

    if (interaction.mode === 'resizing') {
      updateResize(worldPoint);
      return;
    }

    if (interaction.mode === 'drawing') {
      const draft = draftShape;
      if (!draft) return;
      if (draft.kind === 'freehand') {
        const nextPoints = [...draft.points, worldPoint];
        updateDraft({ kind: 'freehand', points: smoothPoints(nextPoints) });
        return;
      }
      if (draft.kind === 'rectangle' || draft.kind === 'circle' || draft.kind === 'line' || draft.kind === 'arrow') {
        updateDraft({ ...draft, current: worldPoint });
      }
    }
  };

  const handlePointerUp = () => {
    const interaction = interactionRef.current;
    if (interaction.mode === 'panning') {
      interactionRef.current = { mode: 'idle', pointerId: null, start: null, last: null, handle: null, selectedIds: [] };
      return;
    }
    if (interaction.mode === 'dragging') endDrag();
    if (interaction.mode === 'resizing') endResize();
    if (interaction.mode === 'drawing') {
      if (draftShape?.kind === 'text') {
        const shape = commitDraft();
        if (shape) openTextEditor(shape.id);
      } else if (draftShape?.kind === 'freehand') {
        const shape = commitDraft();
        if (shape) selectShapes([shape.id], shape.id);
      } else {
        const created = commitDraft();
        if (created) selectShapes([created.id], created.id);
      }
    }
    if (interaction.mode === 'editing-text') {
      interactionRef.current = { mode: 'idle', pointerId: null, start: null, last: null, handle: null, selectedIds: [] };
      return;
    }
    interactionRef.current = { mode: 'idle', pointerId: null, start: null, last: null, handle: null, selectedIds: [] };
  };

  const handleDoubleClick = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = screenToWorld(toCanvasPoint(canvas, event.nativeEvent as PointerEvent), camera);
    const shape = getTopHit(shapes, point);
    if (shape?.kind === 'text') {
      selectShapes([shape.id], shape.id);
      openTextEditor(shape.id);
    }
  };

  useEffect(() => {
    if (!editingText) return;
    window.setTimeout(() => overlayRef.current?.focus(), 0);
  }, [editingText]);

  const overlayPosition = useMemo(() => {
    if (!editingText) return null;
    const shape = shapes.find((item) => item.id === editingText.shapeId);
    if (!shape || shape.kind !== 'text') return null;
    const screen = worldToScreen({ x: shape.x, y: shape.y }, camera);
    return { left: screen.x, top: screen.y - 6, width: 280 };
  }, [camera, editingText, shapes]);

  return (
    <section className="canvas-shell" ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={size.width}
        height={size.height}
        className="diagram-canvas"
        style={{ cursor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={(event) => {
          if (interactionRef.current.mode === 'drawing' && event.buttons === 0) handlePointerUp();
        }}
        onDoubleClick={handleDoubleClick}
      />
      {overlayPosition && editingText && (
        <textarea
          ref={overlayRef}
          className="text-editor"
          style={overlayPosition}
          value={editingText.draft}
          onChange={(event) => updateShapeText(editingText.shapeId, event.target.value)}
          onBlur={commitTextEdit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              commitTextEdit();
            }
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              commitTextEdit();
            }
          }}
        />
      )}
    </section>
  );
}

function getTopHit(shapes: DiagramShape[], point: Point) {
  for (let index = shapes.length - 1; index >= 0; index -= 1) {
    const shape = shapes[index];
    if (hitTest(shape, point)) return shape;
  }
  return undefined;
}

function toggleSelection(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function smoothPoints(points: Point[]) {
  if (points.length < 3) return points;
  const result: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const current = points[i];
    const next = points[i + 1];
    result.push({ x: (prev.x + current.x + next.x) / 3, y: (prev.y + current.y + next.y) / 3 });
  }
  result.push(points[points.length - 1]);
  return result;
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLElement && target.isContentEditable;
}
