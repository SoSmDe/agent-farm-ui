/**
 * AgentDetails — Detailed view of all agents with their roles and responsibilities.
 */

import { Card, CardContent } from '@/components/ui/card';
import type { FarmAgent, FarmMessage } from './useFarmData';
import { MessageSquare, Clock, Activity } from 'lucide-react';

// ── Status config ────────────────────────────────────────────────────

const STATUS_CONFIG = {
  idle: { color: 'text-green', bg: 'bg-green/10 border-green/20', dot: 'bg-green', label: 'Ready' },
  busy: { color: 'text-orange', bg: 'bg-orange/10 border-orange/20', dot: 'bg-orange', label: 'Working' },
  offline: { color: 'text-red', bg: 'bg-red/10 border-red/20', dot: 'bg-red', label: 'Offline' },
} as const;

// ── Time formatting ──────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Component ────────────────────────────────────────────────────────

interface AgentDetailsProps {
  agents: FarmAgent[];
  messages: FarmMessage[];
}

export function AgentDetails({ agents, messages }: AgentDetailsProps) {
  if (agents.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground/50 text-[0.733rem]">
        No agents registered
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {agents.map((agent) => {
        const cfg = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.offline;
        const agentMessages = messages.filter((m) => m.to === agent.name || m.from === agent.name);
        const pendingInbox = messages.filter((m) => m.to === agent.name && m.status === 'pending');
        const sentCount = messages.filter((m) => m.from === agent.name).length;

        return (
          <Card key={agent.id} className={`border ${cfg.bg} transition-all duration-300`}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className={`shrink-0 flex items-center justify-center size-14 rounded-xl ${cfg.bg} border text-xl font-bold ${cfg.color}`}>
                  {agent.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base font-bold text-foreground">{agent.name}</h3>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.667rem] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.color}`}>
                      <span className={`inline-block size-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>

                  <p className="text-[0.8rem] text-muted-foreground mb-3">
                    {agent.role || 'No role specified'}
                  </p>

                  {/* Stats row */}
                  <div className="flex items-center gap-5 text-[0.733rem] text-muted-foreground">
                    <div className="flex items-center gap-1.5" title="Pending inbox messages">
                      <MessageSquare size={12} className={pendingInbox.length > 0 ? 'text-orange' : ''} />
                      <span>{pendingInbox.length} pending</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Messages sent">
                      <Activity size={12} />
                      <span>{sentCount} sent</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Total messages involving this agent">
                      <MessageSquare size={12} />
                      <span>{agentMessages.length} total</span>
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto" title={`Last seen: ${agent.last_seen}`}>
                      <Clock size={12} />
                      <span>{relativeTime(agent.last_seen)}</span>
                    </div>
                  </div>

                  {/* Recent messages for this agent */}
                  {agentMessages.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <p className="text-[0.667rem] uppercase tracking-widest text-muted-foreground/50 mb-2">
                        Recent activity
                      </p>
                      <div className="space-y-1">
                        {agentMessages.slice(0, 3).map((msg) => (
                          <div key={msg.id} className="flex items-center gap-2 text-[0.7rem] text-muted-foreground">
                            <span className="font-mono text-foreground/70">{msg.from}</span>
                            <span className="text-muted-foreground/30">&rarr;</span>
                            <span className="font-mono text-foreground/70">{msg.to}</span>
                            <span className="truncate flex-1 text-muted-foreground/60">{msg.content}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
