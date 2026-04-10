/**
 * useFarmData — Polling + SSE hook for Agent Farm state.
 *
 * Polls /api/farm/state every 3s for full state snapshot.
 * Optionally connects to /api/farm/events (SSE) for real-time updates.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ── Types ────────────────────────────────────────────────────────────

export interface FarmAgent {
  id: string;
  name: string;
  role: string;
  type?: 'persistent' | 'ephemeral';
  status: 'idle' | 'busy' | 'offline';
  last_seen: string; // ISO timestamp
}

export interface FarmMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: string; // ISO timestamp
  status: 'pending' | 'delivered' | 'done';
  priority?: number;
}

export interface FarmStats {
  total: number;
  pending: number;
  delivered: number;
  done: number;
}

interface FarmState {
  agents: FarmAgent[];
  recentMessages: FarmMessage[];
  stats: FarmStats;
}

export interface AgentMessageCounts {
  pending: number;
  total: number;
}

interface UseFarmDataReturn extends FarmState {
  loading: boolean;
  error: string | null;
  connected: boolean;
  lastUpdated: number | null;
  retry: () => void;
  agentMessageCounts: Record<string, AgentMessageCounts>;
}

const EMPTY_STATS: FarmStats = { total: 0, pending: 0, delivered: 0, done: 0 };

// Hermes agents don't send heartbeats when idle, so the bus marks them
// "offline" after 5 min. For persistent agents seen in the last 2 hours,
// treat "offline" as "idle" — they're available, just sleeping.
const IDLE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

function normalizeMessage(m: any): FarmMessage {
  return {
    id: m.id,
    from: m.from_agent ?? m.from,
    to: m.to_agent ?? m.to,
    content: m.message ?? m.content,
    timestamp: m.created_at ?? m.timestamp,
    status: m.status,
    priority: m.priority ?? 0,
  };
}
function normalizeAgentStatus(agents: any[]): FarmAgent[] {
  const now = Date.now();
  return agents.map((a) => {
    let status: FarmAgent['status'] = a.status;
    if (status === 'offline' && a.type === 'persistent') {
      const lastSeen = new Date(a.last_seen).getTime();
      if (now - lastSeen < IDLE_THRESHOLD_MS) {
        status = 'idle';
      }
    }
    return { ...a, status };
  });
}
const POLL_INTERVAL = 3000;

export function useFarmData(): UseFarmDataReturn {
  const [agents, setAgents] = useState<FarmAgent[]>([]);
  const [recentMessages, setRecentMessages] = useState<FarmMessage[]>([]);
  const [stats, setStats] = useState<FarmStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchState = useCallback(async () => {
    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch('/api/farm/state', { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      setAgents(normalizeAgentStatus(raw.agents ?? []));
      setRecentMessages(
        (raw.recentMessages ?? []).map((m: any) => ({
          id: m.id,
          from: m.from_agent ?? m.from,
          to: m.to_agent ?? m.to,
          content: m.message ?? m.content,
          timestamp: m.created_at ?? m.timestamp,
          status: m.status,
          priority: m.priority ?? 0,
        }))
      );
      setStats(raw.stats ?? EMPTY_STATS);
      setError(null);
      setLastUpdated(Date.now());
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to fetch farm state');
    } finally {
      setLoading(false);
    }
  }, []);

  // Polling
  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, POLL_INTERVAL);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [fetchState]);

  // SSE for real-time updates
  useEffect(() => {
    let es: EventSource | null = null;

    try {
      es = new EventSource('/api/farm/events');

      es.addEventListener('state', (e: MessageEvent) => {
        try {
          const data: FarmState = JSON.parse(e.data);
          setAgents(normalizeAgentStatus(data.agents ?? []));
          setRecentMessages((data.recentMessages ?? []).map(normalizeMessage));
          setStats(data.stats ?? EMPTY_STATS);
          setError(null);
          setLastUpdated(Date.now());
        } catch {
          // Ignore malformed SSE payloads
        }
      });

      es.addEventListener('agent', (e: MessageEvent) => {
        try {
          const raw = JSON.parse(e.data);
          const [agent] = normalizeAgentStatus([raw]);
          setAgents((prev) => {
            const idx = prev.findIndex((a) => a.id === agent.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = agent;
              return next;
            }
            return [...prev, agent];
          });
        } catch {
          // Ignore
        }
      });

      es.addEventListener('message', (e: MessageEvent) => {
        try {
          const msg: FarmMessage = normalizeMessage(JSON.parse(e.data));
          setRecentMessages((prev) => [msg, ...prev].slice(0, 100));
        } catch {
          // Ignore
        }
      });

      es.addEventListener('stats', (e: MessageEvent) => {
        try {
          setStats(JSON.parse(e.data));
        } catch {
          // Ignore
        }
      });

      es.onerror = () => {
        // SSE will auto-reconnect; no action needed
      };
    } catch {
      // SSE not available — rely on polling
    }

    return () => {
      es?.close();
    };
  }, []);

  const connected = error === null && !loading;

  // Compute per-agent message counts from recentMessages
  const agentMessageCounts = useMemo(() => {
    const counts: Record<string, AgentMessageCounts> = {};
    for (const msg of recentMessages) {
      const agentId = msg.to;
      if (!counts[agentId]) {
        counts[agentId] = { pending: 0, total: 0 };
      }
      counts[agentId].total++;
      if (msg.status === 'pending') {
        counts[agentId].pending++;
      }
    }
    return counts;
  }, [recentMessages]);

  return { agents, recentMessages, stats, loading, error, connected, lastUpdated, retry: fetchState, agentMessageCounts };
}

// ── Shared agent color utility ──────────────────────────────────────

const AGENT_COLORS = [
  "#7fc782", "#e79a59", "#6ba3e0", "#c47fd0", "#e06c66",
  "#5dc4b8", "#d4a843", "#8b8be0", "#e08888", "#6bc47f",
];

export function agentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}
