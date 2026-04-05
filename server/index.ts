/**
 * Agent Farm UI server entry point.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import app from './app.js';
import { config, validateConfig, printStartupBanner } from './lib/config.js';

// ── Startup banner + validation ──────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, '..', 'package.json');
const pkgVersion: string = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version || '0.0.0';

printStartupBanner(pkgVersion);
validateConfig();

// ── HTTP server ──────────────────────────────────────────────────────

const httpServer = serve(
  {
    fetch: app.fetch,
    port: config.port,
    hostname: config.host,
  },
  (info) => {
    console.log(`\x1b[33m[agent-farm-ui]\x1b[0m http://${config.host}:${info.port}`);
  },
);

// Friendly error on port conflict
(httpServer as unknown as import('node:net').Server).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\x1b[31m[agent-farm-ui]\x1b[0m Port ${config.port} is already in use. Is another instance running?`);
    process.exit(1);
  }
  throw err;
});

// ── Graceful shutdown ────────────────────────────────────────────────

function shutdown(signal: string) {
  console.log(`\n[agent-farm-ui] ${signal} received, shutting down...`);

  httpServer.close(() => {
    console.log('[agent-farm-ui] HTTP server closed');
  });

  setTimeout(() => {
    console.log('[agent-farm-ui] Force exit');
    process.exit(0);
  }, 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
