/**
 * FarmDashboard — Main Agent Farm mission control dashboard.
 *
 * Shows agent cards grid, message feed, and stats bar.
 * Fetches from /api/farm/state (polling) + /api/farm/events (SSE).
 */

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useFarmData } from './useFarmData';
import { AgentCard } from './AgentCard';
import { MessageFeed } from './MessageFeed';
import { FarmStats } from './FarmStats';

// ── Helpers ───────────────────────────────────────────────────────────

function useTimeAgo(timestamp: number | null): string {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (timestamp === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timestamp]);

  if (timestamp === null) return 'never';
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

// ── Skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header skeleton */}
      <div className="shrink-0 px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="animate-pulse text-primary text-lg">&#x25C6;</span>
          <div className="h-5 w-24 bg-muted/50 rounded animate-pulse" />
          <div className="h-3 w-28 bg-muted/30 rounded animate-pulse" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="shrink-0 px-6 pb-4">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 min-h-0 px-6 pb-6 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4">
        <div className="bg-muted/20 rounded-lg animate-pulse" />
        <div className="bg-muted/20 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

// ── Error State ───────────────────────────────────────────────────────

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center">
        <div className="h-10 w-10 rounded-full bg-red/10 flex items-center justify-center">
          <span className="text-red text-lg">&#x26A0;</span>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground mb-1">
            Failed to connect to Farm API
          </p>
          <p className="text-[0.733rem] text-muted-foreground">
            {error}
          </p>
        </div>
        <button
          onClick={onRetry}
          className="px-4 py-1.5 text-[0.733rem] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

// ── Connection Indicator ──────────────────────────────────────────────

function ConnectionIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          connected
            ? 'bg-green shadow-[0_0_4px_theme(colors.green)]'
            : 'bg-red shadow-[0_0_4px_theme(colors.red)]'
        }`}
      />
      <span
        className={`text-[0.667rem] uppercase tracking-widest ${
          connected ? 'text-green/80' : 'text-red/80'
        }`}
      >
        {connected ? 'Connected to Farm API' : 'API Unreachable'}
      </span>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────

export function FarmDashboard() {
  const { agents, recentMessages, stats, loading, error, connected, lastUpdated, retry, agentMessageCounts } = useFarmData();

  const timeAgo = useTimeAgo(lastUpdated);

  // First load — show skeleton
  if (loading) {
    return <LoadingSkeleton />;
  }

  // Error with no data — show full-screen error
  if (error && agents.length === 0) {
    return <ErrorState error={error} onRetry={retry} />;
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-primary text-lg">&#x25C6;</span>
          <h1 className="text-lg font-bold text-foreground tracking-tight">
            Agent Farm
          </h1>
          <span className="text-[0.667rem] text-muted-foreground/50 uppercase tracking-widest">
            Mission Control
          </span>
        </div>

        <ConnectionIndicator connected={connected} />
      </div>

      {/* Inline error banner (when we have stale data but fetch failed) */}
      {error && agents.length > 0 && (
        <div className="shrink-0 mx-6 mb-3 flex items-center justify-between rounded-md border border-red/30 bg-red/10 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[0.667rem] text-red">
            <span>&#x26A0;</span>
            {error}
          </div>
          <button
            onClick={retry}
            className="text-[0.667rem] font-medium text-red hover:text-red/80 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stats bar */}
      <div className="shrink-0 px-6 pb-4">
        <FarmStats stats={stats} recentMessages={recentMessages} />
      </div>

      {/* Main content: agents grid + message feed */}
      <div className="flex-1 min-h-0 px-6 pb-6 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4">
        {/* Agents grid */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="border-b border-border/40">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="text-green text-xs">&#x25CF;</span>
              Agents
              <span className="text-[0.667rem] text-muted-foreground font-normal ml-auto">
                {agents.length} total
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto py-3">
            {agents.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground/50 text-[0.733rem]">
                No agents registered
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                {agents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} messageCounts={agentMessageCounts[agent.id]} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message feed */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="border-b border-border/40">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="text-info text-xs">&#x25CF;</span>
              Message Bus
              <span className="text-[0.667rem] text-muted-foreground font-normal ml-auto">
                {recentMessages.length} recent
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col p-0">
            <MessageFeed messages={recentMessages} />
          </CardContent>
        </Card>
      </div>

      {/* Footer — last updated */}
      <div className="shrink-0 px-6 pb-3 flex justify-end">
        <span className="text-[0.625rem] text-muted-foreground/40 uppercase tracking-widest">
          Last updated: {timeAgo}
        </span>
      </div>
    </div>
  );
}
