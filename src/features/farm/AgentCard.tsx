/**
 * AgentCard — Individual agent card for the Farm dashboard.
 *
 * Shows avatar monogram, agent name, role, status indicator with animation,
 * smart relative time, message counters, mini activity sparkline, and gradient border glow.
 */

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';
import { agentEmoji } from './useFarmData';
import type { FarmAgent, FarmMessage, AgentMessageCounts } from './useFarmData';

// ── Status config ────────────────────────────────────────────────────

const STATUS_CONFIG = {
  idle: {
    dot: 'bg-green',
    glow: 'shadow-[0_0_8px_rgba(127,199,130,0.5)]',
    label: 'text-green',
    text: 'Ready',
    cardBorder: 'shadow-[inset_0_0_0_1px_rgba(127,199,130,0.25),0_0_12px_-4px_rgba(127,199,130,0.15)]',
    cardOpacity: '',
    animation: 'pulse' as const,
    sparkColor: '#7fc782',
  },
  busy: {
    dot: 'bg-orange',
    glow: 'shadow-[0_0_8px_rgba(231,154,89,0.5)]',
    label: 'text-orange',
    text: 'Working...',
    cardBorder: 'shadow-[inset_0_0_0_1px_rgba(231,154,89,0.25),0_0_12px_-4px_rgba(231,154,89,0.15)]',
    cardOpacity: '',
    animation: 'spin' as const,
    sparkColor: '#e79a59',
  },
  offline: {
    dot: 'bg-red/60',
    glow: 'shadow-[0_0_4px_rgba(224,108,102,0.3)]',
    label: 'text-red/70',
    text: 'Offline',
    cardBorder: 'shadow-[inset_0_0_0_1px_rgba(224,108,102,0.15)]',
    cardOpacity: 'opacity-60',
    animation: 'none' as const,
    sparkColor: '#888',
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
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Mini sparkline for card ──────────────────────────────────────────

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(1, ...data);
  const W = 60;
  const H = 16;
  const barW = W / data.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="shrink-0">
      {data.map((val, i) => {
        const barH = (val / max) * (H - 1);
        return (
          <rect
            key={i}
            x={i * barW + 0.3}
            y={H - barH}
            width={Math.max(barW - 0.6, 0.5)}
            height={Math.max(barH, 0.5)}
            rx={0.5}
            fill={color}
            opacity={val === 0 ? 0.08 : 0.2 + (val / max) * 0.6}
          />
        );
      })}
    </svg>
  );
}

function useAgentActivityBuckets(agentName: string, messages: FarmMessage[] | undefined, buckets: number = 12): number[] {
  return useMemo(() => {
    const result = new Array(buckets).fill(0);
    if (!messages) return result;

    const now = Date.now();
    const span = 12 * 60 * 60 * 1000; // 12h
    const bucketSize = span / buckets;

    for (const msg of messages) {
      if (msg.from !== agentName && msg.to !== agentName) continue;
      const ts = new Date(msg.timestamp).getTime();
      if (Number.isNaN(ts)) continue;
      const age = now - ts;
      if (age < 0 || age > span) continue;
      const idx = buckets - 1 - Math.floor(age / bucketSize);
      if (idx >= 0 && idx < buckets) result[idx]++;
    }
    return result;
  }, [agentName, messages, buckets]);
}

// ── Status dot with animation ────────────────────────────────────────

function StatusDot({ animation, dotClass, glowClass }: {
  animation: 'pulse' | 'spin' | 'none';
  dotClass: string;
  glowClass: string;
}) {
  if (animation === 'spin') {
    return (
      <span className="relative flex size-3 items-center justify-center">
        <span className="absolute inset-[-3px] rounded-full border-2 border-transparent border-t-orange animate-spin" />
        <span className={`block size-2.5 rounded-full ${dotClass} ${glowClass}`} />
      </span>
    );
  }

  if (animation === 'pulse') {
    return (
      <span className="relative flex size-3 items-center justify-center">
        <span className={`absolute inset-0 rounded-full ${dotClass} animate-ping opacity-30`} />
        <span className={`block size-2.5 rounded-full ${dotClass} ${glowClass}`} />
      </span>
    );
  }

  return <span className={`block size-2.5 rounded-full ${dotClass} ${glowClass}`} />;
}

// ── Avatar monogram ──────────────────────────────────────────────────

const AVATAR_COLORS: Record<string, string> = {
  idle: 'bg-green/15 text-green border-green/20',
  busy: 'bg-orange/15 text-orange border-orange/20',
  offline: 'bg-red/10 text-red/50 border-red/10',
};

function AvatarMonogram({ name, status }: { name: string; status: string }) {
  const letter = name.charAt(0).toUpperCase();
  const colorClass = AVATAR_COLORS[status] ?? AVATAR_COLORS.offline;

  return (
    <div className={`shrink-0 flex items-center justify-center size-10 rounded-full border text-sm font-bold ${colorClass}`} title={name}>
      {agentEmoji(status === 'offline' ? undefined : undefined) ? letter : letter}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────

interface AgentCardProps {
  agent: FarmAgent;
  messageCounts?: AgentMessageCounts;
  recentMessages?: FarmMessage[];
}

export function AgentCard({ agent, messageCounts, recentMessages }: AgentCardProps) {
  const cfg = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.offline;
  const lastSeen = useMemo(() => formatRelativeTime(agent.last_seen), [agent.last_seen]);
  const pending = messageCounts?.pending ?? 0;
  const total = messageCounts?.total ?? 0;
  const activityData = useAgentActivityBuckets(agent.name, recentMessages);
  const hasActivity = activityData.some((v) => v > 0);

  // Last message preview
  const lastMessage = useMemo(() => {
    if (!recentMessages) return null;
    for (const msg of recentMessages) {
      if (msg.from === agent.name || msg.to === agent.name) {
        const prefix = msg.from === agent.name ? "" : msg.from + ": ";
        const text = prefix + (msg.content || "");
        return text.length > 60 ? text.slice(0, 57) + "..." : text;
      }
    }
    return null;
  }, [agent.name, recentMessages]);

  return (
    <Card
      className={`group relative py-3 gap-2 transition-all duration-300 hover:translate-y-[-1px] ${cfg.cardBorder} ${cfg.cardOpacity}`}
    >
      <CardContent className="flex items-start gap-3">
        {/* Avatar */}
        <AvatarMonogram name={agent.name} status={agent.status} />

        {/* Agent info */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Name + status */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-foreground truncate">
              <span className="mr-1">{agentEmoji(agent.role)}</span>{agent.name}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <StatusDot animation={cfg.animation} dotClass={cfg.dot} glowClass={cfg.glow} />
              <span className={`text-[0.667rem] font-semibold uppercase tracking-wider ${cfg.label}`}>
                {cfg.text}
              </span>
            </div>
          </div>

          {/* Row 2: Role */}
          <span className="block text-[0.733rem] text-muted-foreground truncate mt-0.5">
            {agent.role || 'agent'}
          </span>

          {/* Row 3: Messages + sparkline + last active */}
          <div className="flex items-center justify-between gap-2 mt-2">
            {/* Message counters */}
            <div className="flex items-center gap-1.5 text-[0.667rem] text-muted-foreground/70">
              <MessageSquare size={11} className="shrink-0" />
              {pending > 0 ? (
                <span>
                  <span className="text-orange font-semibold">{pending}</span>
                  <span className="mx-0.5">/</span>
                  <span>{total}</span>
                </span>
              ) : (
                <span>{total}</span>
              )}
            </div>

            {/* Mini sparkline */}
            {hasActivity && <MiniSparkline data={activityData} color={cfg.sparkColor} />}

            {/* Last active */}
            <span className="text-[0.625rem] text-muted-foreground/40 shrink-0">
              {lastSeen}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
