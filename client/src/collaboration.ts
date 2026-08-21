import { useCanvasStore } from './store/canvasStore';
import type {
  BoardRecord,
  ClientToServerMessage,
  DiagramShape,
  PresenceUser,
  ServerToClientMessage,
} from '@shared/index';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

let socket: WebSocket | null = null;
let activeBoardId: string | null = null;
let activeClientId: string | null = null;

export async function loadBoard(boardId: string) {
  const response = await fetch(`/api/boards/${boardId}`);
  if (!response.ok) throw new Error(`Failed to load board ${boardId}`);
  return (await response.json()) as BoardRecord;
}

export function connectBoard(boardId: string) {
  disconnectBoard();
  activeBoardId = boardId;
  activeClientId = getClientId();
  useCanvasStore.getState().setConnectionStatus('connecting');
  socket = new WebSocket(`${getWsBase()}/ws?boardId=${encodeURIComponent(boardId)}&clientId=${encodeURIComponent(activeClientId)}&label=User`);
  socket.onopen = () => useCanvasStore.getState().setConnectionStatus('connected');
  socket.onclose = () => useCanvasStore.getState().setConnectionStatus('disconnected');
  socket.onerror = () => useCanvasStore.getState().setConnectionStatus('disconnected');
  socket.onmessage = (event) => {
    const msg = parseMessage(event.data);
    if (!msg) return;
    if (msg.type === 'board:state') {
      useCanvasStore.getState().setBoardFromServer(msg.board);
      return;
    }
    if (msg.type === 'board:presence') {
      useCanvasStore.getState().setPresence(msg.users);
      return;
    }
    useCanvasStore.getState().applyRemoteMessage(msg);
  };
}

export function disconnectBoard() {
  if (socket) {
    socket.close();
    socket = null;
  }
}

export function sendMessage(message: ClientToServerMessage) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(message));
}

export function publishShapeCreated(shape: DiagramShape) {
  if (!activeBoardId) return;
  sendMessage({ type: 'shape:created', boardId: activeBoardId, shape });
}

export function publishShapeUpdated(shape: DiagramShape) {
  if (!activeBoardId) return;
  sendMessage({ type: 'shape:updated', boardId: activeBoardId, shape });
}

export function publishShapeDeleted(shapeId: string) {
  if (!activeBoardId) return;
  sendMessage({ type: 'shape:deleted', boardId: activeBoardId, shapeId });
}

export function publishTextUpdated(shapeId: string, text: string) {
  if (!activeBoardId) return;
  sendMessage({ type: 'text:updated', boardId: activeBoardId, shapeId, text });
}

export function getBoardId() {
  return activeBoardId;
}

function getClientId() {
  const key = 'nodeboard.clientId';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(key, next);
  return next;
}

function getWsBase() {
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;
}

function parseMessage(data: string): ServerToClientMessage | null {
  try {
    return JSON.parse(data) as ServerToClientMessage;
  } catch {
    return null;
  }
}
