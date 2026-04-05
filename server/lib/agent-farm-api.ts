/**
 * Agent Farm API client.
 *
 * Thin wrapper around fetch for calling the Agent Farm bus/dashboard/admin
 * endpoints. Base URL comes from FARM_API_URL env var (default localhost:3000).
 * @module
 */

import { config } from './config.js';

export async function farmGet(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${config.farmApiUrl}${path}`, { headers });
  if (!res.ok) {
    throw new Error(`Farm API ${path} returned ${res.status}`);
  }
  return res.json();
}

export async function farmPost(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${config.farmApiUrl}${path}`, {
    method: 'POST',
    headers,
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
export async function farmSSE(path: string): Promise<Response> {
  const res = await fetch(`${config.farmApiUrl}${path}`, {
    headers: { Accept: 'text/event-stream' },
  });
  if (!res.ok) {
    throw new Error(`Farm SSE ${path} returned ${res.status}`);
  }
  return res;
}
