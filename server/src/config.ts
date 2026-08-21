import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

function normalizeOrigin(value: string | undefined, fallback: string) {
  const trimmed = (value ?? fallback).trim();
  return trimmed.replace(/\/+$/, '');
}

function buildAllowedOrigins(primaryOrigin: string) {
  const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  return Array.from(new Set([primaryOrigin, ...devOrigins].map((origin) => normalizeOrigin(origin, origin))));
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  clientOrigin: normalizeOrigin(process.env.CLIENT_ORIGIN, 'http://127.0.0.1:5173'),
  allowedOrigins: buildAllowedOrigins(normalizeOrigin(process.env.CLIENT_ORIGIN, 'http://127.0.0.1:5173')),
  dataDir: process.env.NODEBOARD_DATA_DIR ?? resolve(fileURLToPath(new URL('..', import.meta.url)), 'data'),
};
