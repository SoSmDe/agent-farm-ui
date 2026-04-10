/**
 * Agent Files API — reads agent persona files, memory, and workspace
 * from the filesystem.
 *
 * GET /api/farm/agents/:name/files       — list all available files (recursive)
 * GET /api/farm/agents/:name/files/:file — read file content
 *
 * Agent profile directories are resolved via HERMES_PROFILES_DIR env var.
 * The "shrimpster" agent lives at HERMES_HOME (parent of profiles).
 * @module
 */

import { Hono } from 'hono';
import * as fs from 'node:fs';
import * as path from 'node:path';

const app = new Hono();

// ── Config ──────────────────────────────────────────────────────────

const HERMES_HOME = process.env.HERMES_HOME || '/root/.hermes';
const PROFILES_DIR = process.env.HERMES_PROFILES_DIR || path.join(HERMES_HOME, 'profiles');
const MAIN_AGENT = process.env.HERMES_MAIN_AGENT || 'shrimpster';

// Top-level persona files (always shown if they exist)
const PERSONA_FILES = [
  'SOUL.md', 'MEMORY.md', 'USER.md', 'IDENTITY.md',
  'AGENTS.md', 'CLAUDE.md', 'BOOTSTRAP.md',
];

// Directories to scan recursively for additional files
const SCAN_DIRS = ['workspace', 'memories'];

// Files/dirs to skip (security + noise reduction)
const SKIP_NAMES = new Set([
  '.env', '.mcp.json', '.tg-env', 'auth.json', 'auth.lock',
  'config.yaml', 'state.db', 'state.db-shm', 'state.db-wal',
  'models_dev_cache.json', '.skills_prompt_snapshot.json',
  'gateway.pid', 'gateway_state.json', 'processes.json',
  'channel_directory.json', 'honcho.json', '.update_check',
  'node_modules', '.git', 'cache', 'bin', 'logs', 'sessions',
  'skills', 'skins', 'plans', 'platforms', 'sandboxes', 'cron',
]);

// Max file size to serve (2MB)
const MAX_FILE_SIZE = 2 * 1024 * 1024;

function agentDir(name: string): string {
  if (name === MAIN_AGENT) return HERMES_HOME;
  return path.join(PROFILES_DIR, name);
}

interface FileEntry {
  name: string;
  size: number;
  type: 'persona' | 'memory' | 'workspace' | 'other';
  modified: string;
}

function scanDir(baseDir: string, relPrefix: string, type: FileEntry['type'], maxDepth: number = 3): FileEntry[] {
  const results: FileEntry[] = [];
  const absDir = path.join(baseDir, relPrefix);

  if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) return results;
  if (maxDepth <= 0) return results;

  try {
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_NAMES.has(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.claude') continue;

      const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      const absPath = path.join(baseDir, relPath);

      try {
        if (entry.isFile()) {
          const stat = fs.statSync(absPath);
          if (stat.size <= MAX_FILE_SIZE) {
            results.push({
              name: relPath,
              size: stat.size,
              type,
              modified: stat.mtime.toISOString(),
            });
          }
        } else if (entry.isDirectory()) {
          results.push(...scanDir(baseDir, relPath, type, maxDepth - 1));
        }
      } catch { /* skip unreadable */ }
    }
  } catch { /* skip unreadable dirs */ }

  return results;
}

// ── GET /api/farm/agents/:name/files ─────────────────────────────────

app.get('/api/farm/agents/:name/files', (c) => {
  const name = c.req.param('name');
  const dir = agentDir(name);

  if (!fs.existsSync(dir)) {
    return c.json({ error: `Agent "${name}" profile not found` }, 404);
  }

  const files: FileEntry[] = [];

  // 1. Persona files (top-level known files)
  for (const fname of PERSONA_FILES) {
    // Check direct
    const direct = path.join(dir, fname);
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
      const stat = fs.statSync(direct);
      files.push({ name: fname, size: stat.size, type: 'persona', modified: stat.mtime.toISOString() });
      continue;
    }
    // Check memories/ subdir for MEMORY.md
    if (fname === 'MEMORY.md') {
      const memPath = path.join(dir, 'memories', 'MEMORY.md');
      if (fs.existsSync(memPath) && fs.statSync(memPath).isFile()) {
        const stat = fs.statSync(memPath);
        files.push({ name: fname, size: stat.size, type: 'persona', modified: stat.mtime.toISOString() });
      }
    }
  }

  // 2. Memories directory (daily logs, etc.)
  const memFiles = scanDir(dir, 'memories', 'memory');
  // Filter out MEMORY.md if already added as persona file
  for (const mf of memFiles) {
    if (mf.name === 'memories/MEMORY.md') continue;
    // Skip lock files
    if (mf.name.endsWith('.lock')) continue;
    files.push(mf);
  }

  // 3. Workspace directory (recursive)
  const wsFiles = scanDir(dir, 'workspace', 'workspace');
  files.push(...wsFiles);

  return c.json({ agent: name, dir, files });
});

// ── GET /api/farm/agents/:name/files/:file ──────────────────────────

app.get('/api/farm/agents/:name/files/*', (c) => {
  const name = c.req.param('name');
  const filePath = c.req.path.replace(`/api/farm/agents/${name}/files/`, '');
  const dir = agentDir(name);

  if (!fs.existsSync(dir)) {
    return c.json({ error: `Agent "${name}" profile not found` }, 404);
  }

  // Security: prevent path traversal
  if (filePath.includes('..')) {
    return c.json({ error: 'Invalid path' }, 400);
  }

  // Persona files (top-level)
  if (PERSONA_FILES.includes(filePath)) {
    // Check direct
    const direct = path.join(dir, filePath);
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
      const content = fs.readFileSync(direct, 'utf-8');
      return c.json({ agent: name, file: filePath, content });
    }
    // Check memories/ subdir for MEMORY.md
    if (filePath === 'MEMORY.md') {
      const memPath = path.join(dir, 'memories', 'MEMORY.md');
      if (fs.existsSync(memPath) && fs.statSync(memPath).isFile()) {
        const content = fs.readFileSync(memPath, 'utf-8');
        return c.json({ agent: name, file: filePath, content });
      }
    }
    return c.json({ error: `File "${filePath}" not found` }, 404);
  }

  // Allow files under workspace/ and memories/
  if (filePath.startsWith('workspace/') || filePath.startsWith('memories/')) {
    const resolved = path.resolve(dir, filePath);
    // Ensure resolved path is within agent dir (prevent traversal)
    if (!resolved.startsWith(path.resolve(dir))) {
      return c.json({ error: 'Invalid path' }, 400);
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      return c.json({ error: `File "${filePath}" not found` }, 404);
    }
    const stat = fs.statSync(resolved);
    if (stat.size > MAX_FILE_SIZE) {
      return c.json({ error: 'File too large' }, 413);
    }
    const content = fs.readFileSync(resolved, 'utf-8');
    return c.json({ agent: name, file: filePath, content });
  }

  return c.json({ error: `File "${filePath}" not allowed` }, 403);
});

export default app;
