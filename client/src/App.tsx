import { useMemo } from 'react';
import { CanvasEditor } from './components/CanvasEditor';
import { Toolbar } from './components/Toolbar';
import { useCanvasStore } from './store/canvasStore';
import { exportCanvasToPng, exportCanvasToSvg } from './exporters';

export function App() {
  const shapes = useCanvasStore((state) => state.shapes);
  const camera = useCanvasStore((state) => state.camera);
  const selection = useCanvasStore((state) => state.selection);

  const emptyState = useMemo(() => shapes.length === 0, [shapes.length]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">NodeBoard</p>
          <h1>Diagram editor</h1>
          <p className="subtle-copy">Pan, zoom, draw, connect, and edit diagrams on an infinite canvas.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="header-button" onClick={() => exportCanvasToPng()}>
            Export PNG
          </button>
          <button type="button" className="header-button" onClick={() => exportCanvasToSvg()}>
            Export SVG
          </button>
        </div>
      </header>

      <main className="workspace">
        <Toolbar />
        <section className="editor-pane">
          {emptyState && <div className="empty-state">Choose a tool and draw your first node.</div>}
          <CanvasEditor />
          <footer className="statusbar">
            <span>{selection.ids.length ? `${selection.ids.length} selected` : 'No selection'}</span>
            <span>Zoom {Math.round(camera.zoom * 100)}%</span>
            <span>{shapes.length} objects</span>
          </footer>
        </section>
      </main>
    </div>
  );
}
