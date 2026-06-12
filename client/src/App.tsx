import { CanvasEditor } from './components/CanvasEditor';
import { Toolbar } from './components/Toolbar';

export function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Eraser Personalized</p>
          <h1>Collaborative canvas editor</h1>
        </div>
        <p className="subtle-copy">Stage 1: core canvas, shape creation, and selection.</p>
      </header>

      <main className="workspace">
        <Toolbar />
        <CanvasEditor />
      </main>
    </div>
  );
}
