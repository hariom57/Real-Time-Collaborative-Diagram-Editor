import { useCanvasStore } from '../store/canvasStore';

const tools = [
  { id: 'select', label: 'Select' },
  { id: 'pan', label: 'Pan' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'circle', label: 'Circle' },
  { id: 'line', label: 'Line' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'freehand', label: 'Freehand' },
  { id: 'text', label: 'Text' },
] as const;

export function Toolbar() {
  const activeTool = useCanvasStore((state) => state.activeTool);
  const setTool = useCanvasStore((state) => state.setTool);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const deleteSelected = useCanvasStore((state) => state.deleteSelected);
  const shapes = useCanvasStore((state) => state.shapes);

  return (
    <aside className="toolbar" aria-label="Drawing tools">
      <div className="toolbar-group">
        <p className="toolbar-label">Tools</p>
        {tools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={tool.id === activeTool ? 'toolbar-button active' : 'toolbar-button'}
            onClick={() => setTool(tool.id)}
          >
            {tool.label}
          </button>
        ))}
      </div>
      <div className="toolbar-group">
        <p className="toolbar-label">Edit</p>
        <button type="button" className="toolbar-button" onClick={undo}>
          Undo
        </button>
        <button type="button" className="toolbar-button" onClick={redo}>
          Redo
        </button>
        <button type="button" className="toolbar-button" onClick={deleteSelected} disabled={!shapes.length}>
          Delete
        </button>
      </div>
    </aside>
  );
}
