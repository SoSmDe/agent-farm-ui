/**
 * useFarmData — Polling + SSE hook for Agent Farm state.
 *
 * Polls /api/farm/state every 3s for full state snapshot.
 * Optionally connects to /api/farm/events (SSE) for real-time updates.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────

export interface FarmAgent {
  id: string;
  name: string;
  role: string;
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

interface UseFarmDataReturn extends FarmState {
  loading: boolean;
  error: string | null;
}

const EMPTY_STATS: FarmStats = { total: 0, pending: 0, delivered: 0, done: 0 };
const POLL_INTERVAL = 3000;

export function useFarmData(): UseFarmDataReturn {
  const [agents, setAgents] = useState<FarmAgent[]>([]);
  const [recentMessages, setRecentMessages] = useState<FarmMessage[]>([]);
  const [stats, setStats] = useState<FarmStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchState = useCallback(async () => {
    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch('/api/farm/state', { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      setAgents(raw.agents ?? []);
      setRecentMessages(
        (raw.recentMessages ?? []).map((m: any) => ({
          id: m.id,
          from: m.from_agent ?? m.from,
          to: m.to_agent ?? m.to,
          content: m.message ?? m.content,
          timestamp: m.created_at ?? m.timestamp,
          status: m.status,
        }))
      );
      setStats(raw.stats ?? EMPTY_STATS);
      setError(null);
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
          setAgents(data.agents ?? []);
          setRecentMessages(data.recentMessages ?? []);
          setStats(data.stats ?? EMPTY_STATS);
          setError(null);
        } catch {
          // Ignore malformed SSE payloads
        }
      });

      es.addEventListener('agent', (e: MessageEvent) => {
        try {
          const agent: FarmAgent = JSON.parse(e.data);
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
          const msg: FarmMessage = JSON.parse(e.data);
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

  return { agents, recentMessages, stats, loading, error };
}
