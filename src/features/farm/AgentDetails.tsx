/**
 * AgentDetails — Detailed view of all agents with roles, stats, and comm matrix.
 * Cards are clickable to open the detail panel.
 */

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { FarmAgent, FarmMessage } from './useFarmData';
import { MessageSquare, Clock, Activity, ArrowRight } from 'lucide-react';

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

// ── Activity mini chart ───────────────────────────────────────────

function ActivityMiniChart({ agentName, messages }: { agentName: string; messages: FarmMessage[] }) {
  const buckets = useMemo(() => {
    const result = new Array(12).fill(0);
    const now = Date.now();
    const span = 12 * 60 * 60 * 1000;
    const bucketSize = span / 12;
    for (const msg of messages) {
      if (msg.from !== agentName && msg.to !== agentName) continue;
      const ts = new Date(msg.timestamp).getTime();
      if (Number.isNaN(ts)) continue;
      const age = now - ts;
      if (age < 0 || age > span) continue;
      const idx = 11 - Math.floor(age / bucketSize);
      if (idx >= 0 && idx < 12) result[idx]++;
    }
    return result;
  }, [agentName, messages]);

  const max = Math.max(1, ...buckets);
  const hasActivity = buckets.some((v) => v > 0);
  if (!hasActivity) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border/30">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[0.6rem] uppercase tracking-widest text-muted-foreground/40">12h activity</span>
      </div>
      <svg viewBox="0 0 120 20" className="w-full h-5" preserveAspectRatio="none">
        {buckets.map((val, i) => {
          const barH = (val / max) * 18;
          const opacity = val === 0 ? 0.06 : 0.15 + (val / max) * 0.6;
          return (
            <rect key={i} x={i * 10 + 0.5} y={20 - barH} width={9} height={Math.max(barH, 1)} rx={1}
              fill="currentColor" className="text-primary" opacity={opacity} />
          );
        })}
      </svg>
    </div>
  );
}

// ── Communication matrix ─────────────────────────────────────────────

function CommMatrix({ agents, messages }: { agents: FarmAgent[]; messages: FarmMessage[] }) {
  const matrix = useMemo(() => {
    const names = agents.map((a) => a.name);
    const counts = new Map<string, number>();
    for (const msg of messages) {
      if (!msg.from || !msg.to) continue;
      if (msg.from.startsWith('tg-') || msg.to.startsWith('tg-')) continue;
      if (!names.includes(msg.from) || !names.includes(msg.to)) continue;
      const key = `${msg.from}::${msg.to}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return { names, counts };
  }, [agents, messages]);

  if (matrix.names.length === 0) return null;

  const maxCount = Math.max(1, ...matrix.counts.values());

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-4">
      <p className="text-[0.667rem] uppercase tracking-widest text-muted-foreground/50 mb-3">
        Communication Matrix
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[0.7rem]">
          <thead>
            <tr>
              <th className="text-left font-normal text-muted-foreground/40 pb-2 pr-3">From \ To</th>
              {matrix.names.map((name) => (
                <th key={name} className="text-center font-semibold text-foreground/70 pb-2 px-2 min-w-[50px]">
                  {name.slice(0, 5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.names.map((from) => (
              <tr key={from}>
                <td className="font-semibold text-foreground/70 py-1.5 pr-3">{from}</td>
                {matrix.names.map((to) => {
                  const count = matrix.counts.get(`${from}::${to}`) ?? 0;
                  const intensity = count / maxCount;
                  const isSelf = from === to;
                  return (
                    <td key={to} className="text-center py-1.5 px-2">
                      {isSelf ? (
                        <span className="text-muted-foreground/15">-</span>
                      ) : count === 0 ? (
                        <span className="text-muted-foreground/15">0</span>
                      ) : (
                        <span
                          className="inline-flex items-center justify-center min-w-[24px] h-5 rounded-md text-[0.65rem] font-bold"
                          style={{
                            backgroundColor: `rgba(99, 163, 224, ${0.1 + intensity * 0.5})`,
                            color: intensity > 0.5 ? '#fff' : 'rgba(99,163,224,0.9)',
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────

interface AgentDetailsProps {
  agents: FarmAgent[];
  messages: FarmMessage[];
  onSelectAgent?: (agent: FarmAgent) => void;
}

export function AgentDetails({ agents, messages, onSelectAgent }: AgentDetailsProps) {
  if (agents.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground/50 text-[0.733rem]">
        No agents registered
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {/* Communication matrix */}
      <CommMatrix agents={agents} messages={messages} />

      {/* Agent cards */}
      {agents.map((agent) => {
        const cfg = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.offline;
        const agentMessages = messages.filter((m) => m.to === agent.name || m.from === agent.name);
        const pendingInbox = messages.filter((m) => m.to === agent.name && m.status === 'pending');
        const sentCount = messages.filter((m) => m.from === agent.name).length;

        // Top communication partners
        const partnerCounts = new Map<string, number>();
        for (const msg of agentMessages) {
          const partner = msg.from === agent.name ? msg.to : msg.from;
          if (!partner || partner.startsWith('tg-')) continue;
          partnerCounts.set(partner, (partnerCounts.get(partner) ?? 0) + 1);
        }
        const topPartners = [...partnerCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);

        return (
          <Card
            key={agent.id}
            className={`border ${cfg.bg} transition-all duration-300 cursor-pointer hover:translate-y-[-1px] hover:shadow-lg`}
            onClick={() => onSelectAgent?.(agent)}
          >
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
                    <div className="flex items-center gap-1.5" title="Total messages">
                      <MessageSquare size={12} />
                      <span>{agentMessages.length} total</span>
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto" title={`Last seen: ${agent.last_seen}`}>
                      <Clock size={12} />
                      <span>{relativeTime(agent.last_seen)}</span>
                    </div>
                  </div>

                  {/* Top partners */}
                  {topPartners.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-3 flex-wrap">
                      <span className="text-[0.6rem] uppercase tracking-widest text-muted-foreground/40">Talks to:</span>
                      {topPartners.map(([name, count]) => (
                        <span key={name} className="inline-flex items-center gap-1 text-[0.7rem] text-foreground/70 bg-foreground/5 rounded-full px-2 py-0.5">
                          <span className="font-semibold">{name}</span>
                          <span className="text-muted-foreground/40">({count})</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Activity chart */}
                  <ActivityMiniChart agentName={agent.name} messages={messages} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
