import { useCanvasStore } from '../store/canvasStore';

const tools = [
  { id: 'select', label: 'Select' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'circle', label: 'Circle' },
  { id: 'line', label: 'Line' },
] as const;

export function Toolbar() {
  const activeTool = useCanvasStore((state) => state.activeTool);
  const setTool = useCanvasStore((state) => state.setTool);

  return (
    <aside className="toolbar" aria-label="Drawing tools">
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
    </aside>
  );
}
