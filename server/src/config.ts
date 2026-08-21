import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const config = {
  port: Number(process.env.PORT ?? 3001),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://127.0.0.1:5173',
  dataDir: process.env.NODEBOARD_DATA_DIR ?? resolve(fileURLToPath(new URL('..', import.meta.url)), 'data'),
};
