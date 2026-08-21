import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { config } from './config';
import { getOrCreateBoard, saveBoard } from './repository';
import { isValidBoardId, parseMessage } from './protocol';
import type { BoardOperationMessage, BoardRecord, DiagramShape, PresenceUser } from '@shared/index';

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', config.clientOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get('/api/boards/:boardId', async (req, res) => {
  const boardId = req.params.boardId;
  if (!isValidBoardId(boardId)) {
    res.status(400).json({ error: 'Invalid board id' });
    return;
  }
  const board = await getOrCreateBoard(boardId);
  res.json(board);
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

type Room = {
  board: BoardRecord;
  users: Map<string, PresenceUser>;
  sockets: Set<import('ws').WebSocket>;
};

const rooms = new Map<string, Room>();

function roomFor(boardId: string): Room {
  const existing = rooms.get(boardId);
  if (existing) return existing;
  const empty: Room = {
    board: { id: boardId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), document: { version: 1, shapes: [], camera: { x: 0, y: 0, zoom: 1 } } },
    users: new Map(),
    sockets: new Set(),
  };
  rooms.set(boardId, empty);
  return empty;
}

wss.on('connection', async (socket, request) => {
  const url = new URL(request.url ?? '', `http://${request.headers.host}`);
  const boardId = url.searchParams.get('boardId');
  const clientId = url.searchParams.get('clientId');
  const label = url.searchParams.get('label') ?? 'Guest';
  if (!boardId || !clientId || !isValidBoardId(boardId)) {
    socket.close(1008, 'invalid-board');
    return;
  }

  const room = roomFor(boardId);
  room.sockets.add(socket);
  room.users.set(clientId, { clientId, label, cursor: null });
  room.board = await getOrCreateBoard(boardId);

  socket.send(JSON.stringify({ type: 'board:state', board: room.board }));
  broadcastPresence(boardId);

  socket.on('message', async (message) => {
    const parsed = parseMessage(message.toString());
    if (!parsed || parsed.boardId !== boardId) return;

    if (parsed.type === 'board:leave') {
      room.users.delete(parsed.clientId);
      broadcastPresence(boardId);
      return;
    }

    if (parsed.type === 'shape:created' || parsed.type === 'shape:updated' || parsed.type === 'shape:deleted' || parsed.type === 'text:updated') {
      await applyOperation(room, parsed);
      broadcast(room, parsed, socket);
    }
  });

  socket.on('close', () => {
    room.sockets.delete(socket);
    room.users.delete(clientId);
    broadcastPresence(boardId);
  });
});

async function applyOperation(room: Room, op: BoardOperationMessage) {
  const nextShapes = [...room.board.document.shapes];
  if (op.type === 'shape:created') nextShapes.push(op.shape);
  if (op.type === 'shape:updated') {
    const index = nextShapes.findIndex((shape) => shape.id === op.shape.id);
    if (index >= 0) nextShapes[index] = op.shape;
  }
  if (op.type === 'shape:deleted') {
    const index = nextShapes.findIndex((shape) => shape.id === op.shapeId);
    if (index >= 0) nextShapes.splice(index, 1);
  }
  if (op.type === 'text:updated') {
    const index = nextShapes.findIndex((shape) => shape.id === op.shapeId && shape.kind === 'text');
    if (index >= 0) nextShapes[index] = { ...(nextShapes[index] as DiagramShape & { kind: 'text' }), text: op.text };
  }
  room.board = {
    ...room.board,
    updatedAt: new Date().toISOString(),
    document: { ...room.board.document, shapes: nextShapes },
  };
  await saveBoard(room.board);
}

function broadcast(room: Room, message: BoardOperationMessage, except?: import('ws').WebSocket) {
  const payload = JSON.stringify(message);
  for (const socket of room.sockets) {
    if (socket !== except && socket.readyState === 1) socket.send(payload);
  }
}

function broadcastPresence(boardId: string) {
  const room = rooms.get(boardId);
  if (!room) return;
  const payload = JSON.stringify({ type: 'board:presence', boardId, users: [...room.users.values()] });
  for (const socket of room.sockets) {
    if (socket.readyState === 1) socket.send(payload);
  }
}

server.listen(config.port, () => {
  console.log(`NodeBoard server listening on ${config.port}`);
});
