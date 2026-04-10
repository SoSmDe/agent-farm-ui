/**
 * Agent Farm dashboard proxy routes.
 *
 * GET  /api/farm/state  — full dashboard state (agents + messages + stats)
 * GET  /api/farm/events — SSE stream of all farm activity
 * GET  /api/farm/agents — agent list (extracted from dashboard state)
 * POST /api/farm/send   — send a message to the bus (admin-token injected)
 *
 * All reads proxy to /admin/* endpoints on the bus — admin Bearer token
 * is injected server-side from FARM_ADMIN_TOKEN env var.
 * @module
 */

import { Hono } from "hono";
import { stream } from "hono/streaming";
import { farmGet, farmPost, farmSSE } from "../lib/agent-farm-api.js";

const app = new Hono();

// ── GET /api/farm/state ────────────────────────────────────────────
app.get("/api/farm/state", async (c) => {
  try {
    const data = await farmGet("/admin/dashboard/state") as any;
    return c.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Farm API unreachable";
    return c.json({ error: message }, 502);
  }
});

// ── GET /api/farm/agents ───────────────────────────────────────────
app.get("/api/farm/agents", async (c) => {
  try {
    const data = await farmGet("/admin/dashboard/state") as any;
    return c.json({ agents: data.agents ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Farm API unreachable";
    return c.json({ error: message }, 502);
  }
});

// ── GET /api/farm/events (SSE proxy) ───────────────────────────────
app.get("/api/farm/events", async (c) => {
  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");

  let upstream: Response;
  try {
    upstream = await farmSSE("/admin/dashboard/stream");
  } catch {
    return c.text("Farm SSE unavailable", 502);
  }

  const body = upstream.body;
  if (!body) return c.text("No SSE body", 502);

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


// GET /api/farm/messages - full message history with filters
app.get("/api/farm/messages", async (c) => {
  try {
    const agent = c.req.query("agent") ?? "";
    const limit = c.req.query("limit") ?? "200";
    const params = new URLSearchParams();
    if (agent) params.set("agent", agent);
    params.set("limit", limit);
    const data = await farmGet("/admin/messages/recent?" + params.toString()) as any;
    return c.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Farm API unreachable";
    return c.json({ error: message }, 502);
  }
});

// ── POST /api/farm/send ────────────────────────────────────────────
app.post("/api/farm/send", async (c) => {
  try {
    const body = await c.req.json();
    const data = await farmPost("/admin/send", body);
    return c.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Farm API unreachable";
    return c.json({ error: message }, 502);
  }
});

export default app;
