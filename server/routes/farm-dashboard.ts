/**
 * Agent Farm dashboard proxy routes.
 *
 * GET  /api/farm/state  — full dashboard state (agents + messages + stats)
 * GET  /api/farm/events — SSE stream of all farm activity
 * GET  /api/farm/agents — agent list (extracted from dashboard state)
 * POST /api/farm/send   — send a message to the bus (requires agent token in body)
 *
 * All dashboard reads proxy to the Agent Farm API without auth.
 * The /send endpoint forwards the Bearer token from the request header.
 * @module
 */

import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { farmGet, farmPost, farmSSE } from '../lib/agent-farm-api.js';

const app = new Hono();

// ── GET /api/farm/state ────────────────────────────────────────────
app.get('/api/farm/state', async (c) => {
  try {
    const data = await farmGet('/dashboard/state');
    return c.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Farm API unreachable';
    return c.json({ error: message }, 502);
  }
});

// ── GET /api/farm/agents ───────────────────────────────────────────
app.get('/api/farm/agents', async (c) => {
  try {
    const data = await farmGet('/dashboard/state');
    return c.json({ agents: data.agents ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Farm API unreachable';
    return c.json({ error: message }, 502);
  }
});

// ── GET /api/farm/events (SSE proxy) ───────────────────────────────
app.get('/api/farm/events', async (c) => {
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  let upstream: Response;
  try {
    upstream = await farmSSE('/dashboard/events');
  } catch {
    return c.text('Farm SSE unavailable', 502);
  }

  const body = upstream.body;
  if (!body) return c.text('No SSE body', 502);

  return stream(c, async (s) => {
    const reader = body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await s.write(value);
      }
    } catch {
      // client disconnected or upstream closed — silent exit
    } finally {
      reader.cancel().catch(() => {});
    }
  });
});

// ── POST /api/farm/send ────────────────────────────────────────────
app.post('/api/farm/send', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  try {
    const body = await c.req.json();
    const data = await farmPost('/bus/send', body, token);
    return c.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Farm API unreachable';
    return c.json({ error: message }, 502);
  }
});

export default app;

// ── GET /api/farm/setup/status ─────────────────────────────────────
app.get('/api/farm/setup/status', async (c) => {
  try {
    const adminToken = process.env.FARM_ADMIN_TOKEN || '';
    const data = await farmGet('/admin/setup/status', adminToken);
    return c.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Farm API unreachable';
    return c.json({ error: message }, 502);
  }
});

// ── POST /api/farm/setup/oauth ─────────────────────────────────────
app.post('/api/farm/setup/oauth', async (c) => {
  try {
    const adminToken = process.env.FARM_ADMIN_TOKEN || '';
    const body = await c.req.json();
    const data = await farmPost('/admin/setup/oauth', body, adminToken);
    return c.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Farm API unreachable';
    return c.json({ error: message }, 502);
  }
});

// ── DELETE /api/farm/agents/:name ──────────────────────────────────
app.delete('/api/farm/agents/:name', async (c) => {
  try {
    const adminToken = process.env.FARM_ADMIN_TOKEN || '';
    const name = c.req.param('name');
    const res = await fetch(`${process.env.FARM_API_URL || 'http://localhost:3000'}/admin/agents/${name}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const data = await res.json();
    return c.json(data, res.ok ? 200 : res.status as any);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Farm API unreachable';
    return c.json({ error: message }, 502);
  }
});
