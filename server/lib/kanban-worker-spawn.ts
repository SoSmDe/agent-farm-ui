/**
 * Server-side RPC-based worker spawn helper for Kanban execution.
 *
 * Mirrors the frontend spawn/discovery flow to work around the upstream
 * OpenClaw bug (issue #169) where HTTP /tools/invoke -> sessions_spawn
 * fails with EROFS errors.
 *
 * @module
 */

import { randomUUID } from 'node:crypto';
import { gatewayRpcCall } from './gateway-rpc.js';

// ── Constants ────────────────────────────────────────────────────────

const DISCOVERY_TIMEOUT_MS = 5_000; // Short timeout for server-side
const DISCOVERY_POLL_MS = 500;

// ── Regex helpers ────────────────────────────────────────────────────

const ROOT_AGENT_RE = /^agent:([^:]+):main$/;
const SUBAGENT_RE = /^((?:agent:[^:]+)):subagent:.+$/;

/**
 * Check if a session key is a top-level root agent session.
 * Equivalent to frontend `isTopLevelAgentSessionKey()`.
 */
function isTopLevelAgentSessionKey(sessionKey: string): boolean {
  return ROOT_AGENT_RE.test(sessionKey);
}

function getSessionKey(session: SessionListEntry): string {
  return session.key ?? session.sessionKey ?? '';
}

function getSessionId(session: SessionListEntry): string | undefined {
  return session.id ?? session.sessionId;
}

/**
 * Check if a session key is a subagent session.
 * Equivalent to frontend `isSubagentSessionKey()`.
 */
function isSubagentSessionKey(sessionKey: string): boolean {
  return SUBAGENT_RE.test(sessionKey);
}

/**
 * Get the root agent session key for a given session.
 * Equivalent to frontend `getRootAgentSessionKey()`.
 */
function getRootAgentSessionKey(sessionKey: string): string | null {
  const rootMatch = sessionKey.match(ROOT_AGENT_RE);
  if (rootMatch) return sessionKey; // Already a root session

  const subagentMatch = sessionKey.match(SUBAGENT_RE);
  if (subagentMatch) {
    const rootAgentId = subagentMatch[1].split(':')[1];
    return rootAgentId ? `agent:${rootAgentId}:main` : null;
  }

  return null;
}

/**
 * Check if a session is a direct child of a root session.
 * Equivalent to frontend `isRootChildSession()`.
 */
function isRootChildSession(sessionKey: string, rootSessionKey: string): boolean {
  return getRootAgentSessionKey(sessionKey) === rootSessionKey && sessionKey !== rootSessionKey;
}

// ── Types ────────────────────────────────────────────────────────────

interface SessionListEntry {
  id?: string;
  sessionId?: string;
  key?: string;
  sessionKey?: string;
  label?: string;
  parentId?: string;
  agentName?: string;
  rootAgentId?: string;
}

interface SessionsListResponse {
  sessions: SessionListEntry[];
}

export interface KanbanWorkerSpawnResult {
  parentSessionKey: string;
  childSessionKey?: string;
  sessionId?: string;
}

// ── Spawn message builder ────────────────────────────────────────────

/**
 * Build a [spawn-subagent] message for Kanban workers.
 * Server-side equivalent to frontend `buildSpawnSubagentMessage()`.
 */
function buildSpawnSubagentMessage(params: {
  task: string;
  label?: string;
  model?: string;
  thinking?: string;
}): string {
  const lines = ['[spawn-subagent]'];

  lines.push(`task: ${params.task}`);
  if (params.label) lines.push(`label: ${params.label}`);
  if (params.model) lines.push(`model: ${params.model}`);
  if (params.thinking && params.thinking !== 'off') lines.push(`thinking: ${params.thinking}`);
  lines.push('mode: run');
  lines.push('cleanup: keep');

  return lines.join('\n');
}

// ── Main spawn helper ────────────────────────────────────────────────

/**
 * Spawn a Kanban worker via RPC using the chat.send + sessions.list discovery flow.
 *
 * This mirrors the frontend spawn pattern to avoid the upstream OpenClaw bug
 * where HTTP /tools/invoke -> sessions_spawn fails with EROFS errors.
 *
 * @param params - Worker spawn parameters
 * @returns Parent session key and discovered child session key/ID (if available)
 * @throws Error if no top-level agent session exists
 */
export async function spawnKanbanWorkerViaRpc(params: {
  label: string;
  task: string;
  model?: string;
  thinking?: string;
}): Promise<KanbanWorkerSpawnResult> {
  // 1. Get pre-spawn session list to establish baseline
  const preSpawnResponse = await gatewayRpcCall('sessions.list', {}) as SessionsListResponse;
  const preSpawnSessions = preSpawnResponse.sessions ?? [];
  const preSpawnKeys = new Set(preSpawnSessions.map((session) => getSessionKey(session)).filter(Boolean));

  // 2. Find parent session: prefer agent:main:main, fallback to another top-level root
  let parentSessionKey: string | undefined;
  const mainSession = preSpawnSessions.find((session) => getSessionKey(session) === 'agent:main:main');
  if (mainSession) {
    parentSessionKey = 'agent:main:main';
  } else {
    const otherRoot = preSpawnSessions.find((session) => isTopLevelAgentSessionKey(getSessionKey(session)));
    if (otherRoot) {
      parentSessionKey = getSessionKey(otherRoot);
    }
  }

  if (!parentSessionKey) {
    throw new Error('No top-level agent session found');
  }

  // 3. Build spawn message
  const message = buildSpawnSubagentMessage({
    task: params.task,
    label: params.label,
    model: params.model,
    thinking: params.thinking,
  });

  // 4. Send chat.send with idempotency key
  const idempotencyKey = `spawn-kanban-worker-${Date.now()}-${randomUUID().slice(0, 8)}`;
  await gatewayRpcCall('chat.send', {
    sessionKey: parentSessionKey,
    message,
    idempotencyKey,
  });

  // 5. Poll sessions.list to discover the new child session
  const deadline = Date.now() + DISCOVERY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const postSpawnResponse = await gatewayRpcCall('sessions.list', {}) as SessionsListResponse;
      const postSpawnSessions = postSpawnResponse.sessions ?? [];

      const candidates = postSpawnSessions.filter((session) => {
        const sessionKey = getSessionKey(session);
        if (!sessionKey || preSpawnKeys.has(sessionKey) || !isSubagentSessionKey(sessionKey)) return false;
        if (session.parentId) return session.parentId === parentSessionKey;
        return isRootChildSession(sessionKey, parentSessionKey!);
      });

      const labelMatches = candidates.filter((session) => session.label === params.label);
      const uniquelyMatchedChild = labelMatches.length === 1
        ? labelMatches[0]
        : labelMatches.length > 1
          ? undefined
          : candidates.length === 1 && !candidates[0].label
            ? candidates[0]
            : undefined;

      if (uniquelyMatchedChild) {
        return {
          parentSessionKey,
          childSessionKey: getSessionKey(uniquelyMatchedChild),
          sessionId: getSessionId(uniquelyMatchedChild),
        };
      }
    } catch {
      // Keep polling on error
    }

    await new Promise(resolve => setTimeout(resolve, DISCOVERY_POLL_MS));
  }

  // 6. Discovery timeout - degrade gracefully, still return parent info
  return {
    parentSessionKey,
  };
}
