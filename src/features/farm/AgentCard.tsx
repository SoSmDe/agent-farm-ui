/**
 * AgentCard — Individual agent card for the Farm dashboard.
 *
 * Displays agent name, role, status badge with colored dot,
 * and relative last_seen timestamp.
 */

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { FarmAgent } from './useFarmData';

// ── Status config ────────────────────────────────────────────────────

const STATUS_CONFIG = {
  idle: {
    dot: 'bg-green shadow-[0_0_6px_rgba(127,199,130,0.6)]',
    label: 'text-green',
    text: 'Idle',
    pulse: true,
  },
  busy: {
    dot: 'bg-orange shadow-[0_0_6px_rgba(231,154,89,0.6)]',
    label: 'text-orange',
    text: 'Busy',
    pulse: false,
  },
  offline: {
    dot: 'bg-red/60 shadow-[0_0_4px_rgba(224,108,102,0.3)]',
    label: 'text-red/70',
    text: 'Offline',
    pulse: false,
  },
} as const;

// ── Relative time ────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0 || diff < 10_000) return 'just now';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Component ────────────────────────────────────────────────────────

interface AgentCardProps {
  agent: FarmAgent;
}

export function AgentCard({ agent }: AgentCardProps) {
  const cfg = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.offline;
  const lastSeen = useMemo(() => formatRelativeTime(agent.last_seen), [agent.last_seen]);

  return (
    <Card className="group relative py-4 gap-3 hover:border-border transition-colors duration-200">
      <CardContent className="flex items-start gap-3">
        {/* Status dot */}
        <div className="pt-1 shrink-0">
          <span
            className={`block size-2.5 rounded-full ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`}
          />
        </div>

        {/* Agent info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-foreground truncate">
              {agent.name}
            </span>
            <span className={`text-[0.667rem] font-semibold uppercase tracking-wider ${cfg.label}`}>
              {cfg.text}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className="text-[0.733rem] text-muted-foreground truncate">
              {agent.role}
            </span>
            <span className="text-[0.667rem] text-muted-foreground/50 shrink-0">
              {lastSeen}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
