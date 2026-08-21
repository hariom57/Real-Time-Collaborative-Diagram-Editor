import { useEffect, useMemo, useState } from 'react';
import { CanvasEditor } from './components/CanvasEditor';
import { Toolbar } from './components/Toolbar';
import { useCanvasStore } from './store/canvasStore';
import { exportCanvasToPng, exportCanvasToSvg } from './exporters';
import { connectBoard, disconnectBoard, getBoardId, loadBoard, publishBoardRenamed, saveBoardName } from './collaboration';
import { createId, isBoardId } from '@shared/index';

type RecentBoard = { id: string; name: string; updatedAt: string };

const RECENTS_KEY = 'nodeboard.recentBoards';

export function App() {
  const pathname = window.location.pathname;
  const isBoardRoute = pathname.startsWith('/board/');
  const shapes = useCanvasStore((state) => state.shapes);
  const camera = useCanvasStore((state) => state.camera);
  const selection = useCanvasStore((state) => state.selection);
  const boardId = useCanvasStore((state) => state.boardId);
  const boardName = useCanvasStore((state) => state.boardName);
  const connectionStatus = useCanvasStore((state) => state.connectionStatus);
  const saveStatus = useCanvasStore((state) => state.saveStatus);
  const presence = useCanvasStore((state) => state.presence);
  const setBoardFromServer = useCanvasStore((state) => state.setBoardFromServer);
  const setConnectionStatus = useCanvasStore((state) => state.setConnectionStatus);
  const setPresence = useCanvasStore((state) => state.setPresence);
  const setBoardName = useCanvasStore((state) => state.setBoardName);
  const setSaveStatus = useCanvasStore((state) => state.setSaveStatus);
  const renameBoard = useCanvasStore((state) => state.renameBoard);
  const [ready, setReady] = useState(false);
  const [recentBoards, setRecentBoards] = useState<RecentBoard[]>(() => readRecents());
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isBoardRoute) return;
    const run = async () => {
      let id = getBoardId();
      if (!id) {
        const candidate = pathname.split('/').filter(Boolean)[1];
        id = candidate && isBoardId(candidate) ? candidate : createId('board');
        if (window.location.pathname !== `/board/${id}`) {
          window.history.replaceState(null, '', `/board/${id}`);
        }
      }
      try {
        const board = await loadBoard(id);
        setBoardFromServer(board);
        connectBoard(id);
        setReady(true);
        touchRecent(board.id, board.name, board.updatedAt);
        setRecentBoards(readRecents());
      } catch {
        useCanvasStore.getState().hydrate();
        setConnectionStatus('disconnected');
        setReady(true);
      }
    };
    void run();
    return () => disconnectBoard();
  }, [isBoardRoute, pathname, setBoardFromServer, setConnectionStatus, setPresence]);

  useEffect(() => {
    if (!boardId) return;
    const timer = window.setTimeout(async () => {
      try {
        setSaveStatus('saving');
        const saved = await saveBoardName(boardId, boardName);
        setBoardFromServer(saved);
        publishBoardRenamed(saved.name);
        setSaveStatus('saved');
        touchRecent(saved.id, saved.name, saved.updatedAt);
        setRecentBoards(readRecents());
      } catch {
        setSaveStatus('error');
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [boardId, boardName, setBoardFromServer, setSaveStatus]);

  const emptyState = useMemo(() => shapes.length === 0, [shapes.length]);

  if (!isBoardRoute) {
    return (
      <div className="app-shell home-shell">
        <section className="home-panel">
          <p className="eyebrow">NodeBoard</p>
          <h1>Collaborative diagramming for teams and engineers.</h1>
          <p className="subtle-copy">Create system diagrams, sketch flows, and collaborate in real time.</p>
          <button type="button" className="primary-button" onClick={createBoard}>
            + New Board
          </button>
        </section>
        <section className="recent-panel">
          <div className="panel-header">
            <h2>Recent Boards</h2>
          </div>
          <div className="recent-list">
            {recentBoards.length ? recentBoards.map((board) => (
              <button key={board.id} type="button" className="recent-item" onClick={() => window.location.assign(`/board/${board.id}`)}>
                <span>{board.name}</span>
                <small>{board.id}</small>
              </button>
            )) : <p className="subtle-copy">No recent boards yet.</p>}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar board-topbar">
        <div className="brand-group">
          <button type="button" className="brand-button" onClick={() => window.location.assign('/')}>NodeBoard</button>
          <input
            className="board-name-input"
            value={boardName}
            onChange={(event) => renameBoard(event.target.value)}
            aria-label="Board name"
            spellCheck={false}
          />
        </div>
        <div className="header-actions">
          <span className={`status-pill status-${connectionStatus}`}>{connectionStatus}</span>
          <span className={`status-pill status-${saveStatus}`}>{saveLabel(saveStatus)}</span>
          <span className="status-pill">👥 {presence.length}</span>
          <button type="button" className="header-button" onClick={handleShare}>
            Share
          </button>
          <button type="button" className="header-button" onClick={() => exportCanvasToPng()}>
            PNG
          </button>
          <button type="button" className="header-button" onClick={() => exportCanvasToSvg()}>
            SVG
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
            <span>{boardId}</span>
          </footer>
        </section>
      </main>
      {shareFeedback && <div className="toast">{shareFeedback}</div>}
    </div>
  );

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareFeedback('Link copied');
    } catch {
      setShareFeedback('Couldn’t copy link');
    }
    window.setTimeout(() => setShareFeedback(null), 1600);
  }
}

function createBoard() {
  const id = createId('board');
  window.location.assign(`/board/${id}`);
}

function saveLabel(value: string) {
  if (value === 'saving') return 'Saving...';
  if (value === 'saved') return 'Saved';
  if (value === 'offline') return 'Offline';
  if (value === 'error') return "Couldn't save changes";
  return 'Saved';
}

function readRecents(): RecentBoard[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]') as RecentBoard[];
  } catch {
    return [];
  }
}

function touchRecent(id: string, name: string, updatedAt: string) {
  const recents = readRecents().filter((item) => item.id !== id);
  recents.unshift({ id, name, updatedAt });
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, 8)));
}
