import type { ClientToServerMessage, DiagramShape } from '@shared/index';
import { isBoardId as validateBoardId } from '@shared/index';

export function parseMessage(data: string): ClientToServerMessage | null {
  try {
    const parsed = JSON.parse(data) as ClientToServerMessage;
    if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isValidBoardId(boardId: string) {
  return validateBoardId(boardId);
}

export function isShape(value: unknown): value is DiagramShape {
  return !!value && typeof value === 'object' && 'id' in value && 'kind' in value;
}
