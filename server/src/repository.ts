import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from './config';
import type { BoardRecord, DiagramDocument } from '@shared/index';

type BoardRow = BoardRecord;

function boardPath(boardId: string) {
  return join(config.dataDir, `${boardId}.json`);
}

async function ensureDir() {
  await mkdir(config.dataDir, { recursive: true });
}

export async function loadBoard(boardId: string): Promise<BoardRow | null> {
  try {
    const raw = await readFile(boardPath(boardId), 'utf8');
    return JSON.parse(raw) as BoardRow;
  } catch {
    return null;
  }
}

export async function saveBoard(board: BoardRow): Promise<void> {
  await ensureDir();
  const tempPath = boardPath(board.id) + '.tmp';
  await writeFile(tempPath, JSON.stringify(board, null, 2), 'utf8');
  await rename(tempPath, boardPath(board.id));
}

export async function getOrCreateBoard(boardId: string): Promise<BoardRow> {
  const existing = await loadBoard(boardId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const created: BoardRow = {
    id: boardId,
    name: 'Untitled Board',
    createdAt: now,
    updatedAt: now,
    document: { version: 1, shapes: [], camera: { x: 0, y: 0, zoom: 1 } },
  };
  await saveBoard(created);
  return created;
}
