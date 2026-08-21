import { useMemo } from 'react';
import { useEffect, useState } from 'react';
import { CanvasEditor } from './components/CanvasEditor';
import { Toolbar } from './components/Toolbar';
import { useCanvasStore } from './store/canvasStore';
import { exportCanvasToPng, exportCanvasToSvg } from './exporters';
import { connectBoard, disconnectBoard, getBoardId, loadBoard } from './collaboration';
import { isBoardId, createId } from '@shared/index';

export function App() {
  const shapes = useCanvasStore((state) => state.shapes);
  const camera = useCanvasStore((state) => state.camera);
  const selection = useCanvasStore((state) => state.selection);
  const boardId = useCanvasStore((state) => state.boardId);
  const connectionStatus = useCanvasStore((state) => state.connectionStatus);
  const presence = useCanvasStore((state) => state.presence);
  const setBoardFromServer = useCanvasStore((state) => state.setBoardFromServer);
  const setConnectionStatus = useCanvasStore((state) => state.setConnectionStatus);
  const setPresence = useCanvasStore((state) => state.setPresence);
  const [ready, setReady] = useState(false);

  const emptyState = useMemo(() => shapes.length === 0, [shapes.length]);

  useEffect(() => {
    const run = async () => {
      let id = getBoardId();
      if (!id) {
        const segments = location.pathname.split('/').filter(Boolean);
        const candidate = segments[0] === 'board' ? segments[1] : null;
        id = candidate && isBoardId(candidate) ? candidate : createId('board');
        if (location.pathname !== `/board/${id}`) {
          history.replaceState(null, '', `/board/${id}`);
        }
      }
      try {
        const board = await loadBoard(id);
        setBoardFromServer(board);
        connectBoard(id);
        setReady(true);
      } catch {
        useCanvasStore.getState().hydrate();
        setConnectionStatus('disconnected');
        setReady(true);
      }
    };
    void run();
    return () => disconnectBoard();
  }, [setBoardFromServer, setConnectionStatus, setPresence]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">NodeBoard</p>
          <h1>Diagram editor</h1>
          <p className="subtle-copy">Pan, zoom, draw, connect, and edit diagrams on an infinite canvas.</p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="header-button"
            onClick={() => navigator.clipboard.writeText(location.href)}
          >
            Copy board URL
          </button>
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
          {!ready && <div className="empty-state">Loading board...</div>}
          {ready && emptyState && <div className="empty-state">Choose a tool and draw your first node.</div>}
          <CanvasEditor />
          <footer className="statusbar">
            <span>{selection.ids.length ? `${selection.ids.length} selected` : 'No selection'}</span>
            <span>Zoom {Math.round(camera.zoom * 100)}%</span>
            <span>{shapes.length} objects</span>
            <span>{connectionStatus}</span>
            <span>{boardId ? `Board ${boardId}` : ''}</span>
            <span>{presence.length} online</span>
          </footer>
        </section>
      </main>
    </div>
  );
}
