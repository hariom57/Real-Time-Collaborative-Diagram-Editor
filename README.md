# NodeBoard

**NodeBoard** is a real-time collaborative diagramming tool for creating and editing diagrams on an infinite canvas.

Live app: https://real-time-collaborative-diagram-edi.vercel.app/

Backend: https://nodeboard-2mw7.onrender.com/

## Features

### Diagram Editor
- Infinite canvas with pan and zoom
- Rectangle, circle, line, and arrow tools
- Freehand drawing
- Text objects and editing
- Selection, multi-selection, dragging, and resizing
- Keyboard shortcuts
- Undo / redo

### Collaboration
- Real-time multi-user editing through WebSockets
- Board-based collaboration rooms
- Shareable board URLs
- Basic collaborator presence
- Connection status

### Persistence & Export
- Server-side board storage using file-based JSON persistence
- Local storage fallback
- Export diagrams as PNG or SVG
- Versioned shared diagram data

## Architecture

```text
                         ┌──────────────────────┐
                         │       Vercel         │
                         │  React + TypeScript   │
                         │     Canvas Client     │
                         └──────────┬───────────┘
                                    │
                              HTTPS / WSS
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │       Render         │
                         │ Express + WebSocket  │
                         │    Node.js Server    │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │  File-based Storage  │
                         │       JSON           │
                         └──────────────────────┘
```

The frontend handles rendering and user interaction. The backend manages board rooms, WebSocket communication, REST APIs, and server-side board state.

The `shared` package contains common TypeScript models and collaboration event definitions used by both sides.

## Tech Stack

**Frontend**
- React
- TypeScript
- Vite
- HTML5 Canvas
- Zustand

**Backend**
- Node.js
- Express
- WebSocket (`ws`)
- TypeScript

**Shared**
- TypeScript shared models and protocols

**Deployment**
- Vercel — frontend
- Render — backend

## Running Locally

From the project root:

### Install dependencies

```bash
npm install
```

### Start the backend

```bash
npm run dev --workspace server
```

### Start the frontend

In another terminal:

```bash
npm run dev --workspace client
```

Open the Vite URL shown in the terminal, usually:

```text
http://localhost:5173
```

## Collaboration

To test collaboration locally:

1. Open the same board URL in two browser tabs.
2. Make an edit in one tab.
3. The change should appear in the other tab through the WebSocket server.

Example:

```text
http://localhost:5173/board/testboard
```

## Production Configuration

### Vercel

The frontend is deployed from the `client` directory.

- Root Directory: `client`
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

Environment variables:

```text
VITE_API_BASE_URL=https://nodeboard-2mw7.onrender.com
VITE_WS_BASE_URL=wss://nodeboard-2mw7.onrender.com
```

### Render

The backend runs as the WebSocket/REST server.

Relevant environment variables:

```text
CLIENT_ORIGIN=https://real-time-collaborative-diagram-edi.vercel.app
NODEBOARD_DATA_DIR=./data
```

`PORT` is supplied by Render in normal deployments.

## Current Limitations

NodeBoard is currently a V2 system and intentionally keeps some parts simple:

- Persistence uses file-based JSON storage rather than PostgreSQL.
- Collaboration uses server-ordered operations / basic last-write-wins behavior rather than CRDT/OT.
- Authentication and access control are not implemented yet.
- Presence is basic and does not include live cursors.
- Connector routing/anchoring is still basic.

These limitations are intentional foundations for future versions.

## Roadmap

### V3 — System Design Mode
- Architecture-specific components
- Connect services such as APIs, databases, caches, queues, and load balancers
- Configure traffic and capacity
- Simulate request flow
- Detect bottlenecks and overloaded components

### V4 — Architecture Analysis
- Architecture recommendations
- Failure analysis
- Cloud cost estimation
- More realistic capacity models

### V5 — AI Assistance
- AI-powered architecture review
- Bottleneck explanations
- Improvement suggestions
- Trade-off analysis

## Project Goal

NodeBoard started as a collaborative diagram editor and is being developed toward a broader engineering workspace where developers can **draw, collaborate on, and eventually test system architectures**.

The long-term goal is to connect system design diagrams with practical performance analysis rather than treating the diagram as only a visual representation.

## License

See [LICENSE](./LICENSE).
