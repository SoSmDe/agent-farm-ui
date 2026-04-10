/**
 * Agent Farm API client.
 *
 * Thin wrapper around fetch for calling the Agent Farm bus/dashboard/admin
 * endpoints. Base URL comes from FARM_API_URL env var (default localhost:3000).
 * Admin token from FARM_ADMIN_TOKEN env var is injected server-side for
 * protected /admin/* endpoints.
 * @module
 */

import { config } from "./config.js";

function authHeaders(token?: string): Record<string, string> {
  const t = token || config.farmAdminToken;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function farmGet(path: string, token?: string) {
  const res = await fetch(`${config.farmApiUrl}${path}`, {
    headers: { ...authHeaders(token) },
  });
  if (!res.ok) {
    throw new Error(`Farm API ${path} returned ${res.status}`);
  }
  return res.json();
}

export async function farmPost(path: string, body: unknown, token?: string) {
  const res = await fetch(`${config.farmApiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Farm API ${path} returned ${res.status}`);
  }
  return res.json();
}

/**
 * Open an SSE connection to the Farm API and return the raw Response
 * so the caller can pipe its body to the client.
 */
export async function farmSSE(path: string, token?: string): Promise<Response> {
  const res = await fetch(`${config.farmApiUrl}${path}`, {
    headers: { Accept: "text/event-stream", ...authHeaders(token) },
  });
  if (!res.ok) {
    throw new Error(`Farm SSE ${path} returned ${res.status}`);
  }
  return res;
}
