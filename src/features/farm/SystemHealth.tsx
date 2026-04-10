/**
 * SystemHealth — Compact system health overview panel.
 * Shows agent status breakdown, bus throughput, uptime indicators.
 */

import { useMemo } from "react";
import { Users, Zap, Database, TrendingUp } from "lucide-react";
import { agentColor } from "./useFarmData";
import type { FarmAgent, FarmMessage, FarmStats } from "./useFarmData";

interface SystemHealthProps {
  agents: FarmAgent[];
  messages: FarmMessage[];
  stats: FarmStats;
}

export function SystemHealth({ agents, messages, stats }: SystemHealthProps) {
  // Agent status breakdown
  const statusCounts = useMemo(() => {
    const counts = { idle: 0, busy: 0, offline: 0 };
    for (const a of agents) {
      if (a.status in counts) counts[a.status as keyof typeof counts]++;
    }
    return counts;
  }, [agents]);

  // Message rate (last hour)
  const hourlyRate = useMemo(() => {
    const oneHourAgo = Date.now() - 3600000;
    let count = 0;
    for (const msg of messages) {
      if (new Date(msg.timestamp).getTime() > oneHourAgo) count++;
    }
    return count;
  }, [messages]);

  // Unique active agents (sent or received in recent messages)
  const activeAgents = useMemo(() => {
    const set = new Set<string>();
    for (const msg of messages) {
      if (msg.from && !msg.from.startsWith("tg-")) set.add(msg.from);
      if (msg.to && !msg.to.startsWith("tg-")) set.add(msg.to);
    }
    return set.size;
  }, [messages]);

  // Completion rate
  const completionRate = stats.total > 0
    ? Math.round((stats.done / stats.total) * 100)
    : 100;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {/* Agents */}
      <div className="rounded-xl border border-border/30 bg-card/30 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Users size={14} className="text-primary/60" />
          <span className="text-[0.667rem] text-muted-foreground/50 uppercase tracking-wider">Agents</span>
        </div>
        <div className="flex items-end gap-1.5">
          <span className="text-2xl font-bold font-mono text-foreground leading-none">{agents.length}</span>
          <div className="flex items-center gap-1 mb-0.5">
            {statusCounts.idle > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[0.6rem] text-green/70">
                <span className="size-1.5 rounded-full bg-green" />{statusCounts.idle}
              </span>
            )}
            {statusCounts.busy > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[0.6rem] text-orange/70">
                <span className="size-1.5 rounded-full bg-orange" />{statusCounts.busy}
              </span>
            )}
            {statusCounts.offline > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[0.6rem] text-muted-foreground/40">
                <span className="size-1.5 rounded-full bg-muted-foreground/40" />{statusCounts.offline}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hourly rate */}
      <div className="rounded-xl border border-border/30 bg-card/30 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={14} className="text-orange/60" />
          <span className="text-[0.667rem] text-muted-foreground/50 uppercase tracking-wider">Last Hour</span>
        </div>
        <div className="flex items-end gap-1.5">
          <span className="text-2xl font-bold font-mono text-foreground leading-none">{hourlyRate}</span>
          <span className="text-[0.6rem] text-muted-foreground/40 mb-0.5">messages</span>
        </div>
      </div>

      {/* Active */}
      <div className="rounded-xl border border-border/30 bg-card/30 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Database size={14} className="text-info/60" />
          <span className="text-[0.667rem] text-muted-foreground/50 uppercase tracking-wider">Active</span>
        </div>
        <div className="flex items-end gap-1.5">
          <span className="text-2xl font-bold font-mono text-foreground leading-none">{activeAgents}</span>
          <span className="text-[0.6rem] text-muted-foreground/40 mb-0.5">communicating</span>
        </div>
      </div>

      {/* Completion */}
      <div className="rounded-xl border border-border/30 bg-card/30 p-3">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={14} className="text-green/60" />
          <span className="text-[0.667rem] text-muted-foreground/50 uppercase tracking-wider">Processed</span>
        </div>
        <div className="flex items-end gap-1.5">
          <span className={`text-2xl font-bold font-mono leading-none ${completionRate >= 90 ? "text-green" : completionRate >= 50 ? "text-orange" : "text-red"}`}>
            {completionRate}%
          </span>
          <span className="text-[0.6rem] text-muted-foreground/40 mb-0.5">completion</span>
        </div>
      </div>
    {/* Agent status bar */}
      <div className="mt-2 rounded-xl border border-border/30 bg-card/30 p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[0.6rem] text-muted-foreground/40 uppercase tracking-wider">Agent Status</span>
        </div>
        <div className="flex items-center gap-1.5">
          {agents.map((agent) => {
            const color = agentColor(agent.name);
            const statusOpacity = agent.status === "offline" ? 0.2 : agent.status === "busy" ? 0.9 : 0.6;
            return (
              <div key={agent.name} className="flex-1 relative group cursor-default" title={agent.name + " (" + agent.status + ")"}>
                <div className="h-6 rounded-md transition-all group-hover:h-8" style={{ backgroundColor: color, opacity: statusOpacity }} />
                <span className="absolute inset-0 flex items-center justify-center text-[0.55rem] font-bold text-white/80 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {agent.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
