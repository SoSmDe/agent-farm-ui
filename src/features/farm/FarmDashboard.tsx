/**
 * FarmDashboard — Main Agent Farm mission control dashboard.
 *
 * Shows agent cards grid, message feed, and stats bar.
 * Fetches from /api/farm/state (polling) + /api/farm/events (SSE).
 */

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useFarmData } from './useFarmData';
import { AgentCard } from './AgentCard';
import { MessageFeed } from './MessageFeed';
import { FarmStats } from './FarmStats';

export function FarmDashboard() {
  const { agents, recentMessages, stats, loading, error } = useFarmData();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs bg-background">
        <div className="flex flex-col items-center gap-2">
          <span className="animate-pulse text-primary text-lg">&#x25C6;</span>
          <span className="text-[0.733rem] text-muted-foreground/60 uppercase tracking-widest">
            Connecting to farm...
          </span>
        </div>
      </div>
    );
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

        {error && (
          <div className="flex items-center gap-1.5 rounded-md border border-red/30 bg-red/10 px-2.5 py-1 text-[0.667rem] text-red">
            <span>&#x26A0;</span>
            {error}
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="shrink-0 px-6 pb-4">
        <FarmStats stats={stats} />
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
                  <AgentCard key={agent.id} agent={agent} />
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
    </div>
  );
}
