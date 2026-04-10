/**
 * FarmStats — Compact visual stats bar with mini-cards, stacked progress bar,
 * throughput metric, and activity sparkline.
 */

import { useMemo } from 'react';
import {
  MessageSquare,
  Clock,
  Send,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';
import type { FarmStats as FarmStatsType, FarmMessage } from './useFarmData';

// ── Types ───────────────────────────────────────────────────────────

interface FarmStatsProps {
  stats: FarmStatsType;
  recentMessages?: FarmMessage[];
}

// ── Throughput calculator ───────────────────────────────────────────

function useThroughput(messages: FarmMessage[] | undefined): string {
  return useMemo(() => {
    if (!messages || messages.length < 2) return '0';

    const timestamps = messages
      .map((m) => new Date(m.timestamp).getTime())
      .filter((t) => !Number.isNaN(t))
      .sort((a, b) => a - b);

    if (timestamps.length < 2) return '0';

    const spanMinutes =
      (timestamps[timestamps.length - 1] - timestamps[0]) / 60_000;

    if (spanMinutes < 0.01) return String(timestamps.length);

    const rate = timestamps.length / spanMinutes;
    return rate >= 10 ? Math.round(rate).toString() : rate.toFixed(1);
  }, [messages]);
}

// ── Activity sparkline data ─────────────────────────────────────────

function useActivityBuckets(messages: FarmMessage[] | undefined, bucketCount: number = 24): number[] {
  return useMemo(() => {
    const buckets = new Array(bucketCount).fill(0);
    if (!messages || messages.length === 0) return buckets;

    const now = Date.now();
    const span = bucketCount * 60 * 60 * 1000; // bucketCount hours
    const bucketSize = span / bucketCount;

    for (const msg of messages) {
      const ts = new Date(msg.timestamp).getTime();
      if (Number.isNaN(ts)) continue;
      const age = now - ts;
      if (age < 0 || age > span) continue;
      const idx = bucketCount - 1 - Math.floor(age / bucketSize);
      if (idx >= 0 && idx < bucketCount) buckets[idx]++;
    }
    return buckets;
  }, [messages, bucketCount]);
}

// ── Sparkline SVG ───────────────────────────────────────────────────

function Sparkline({ data, width = 200, height = 32 }: { data: number[]; width?: number; height?: number }) {
  const max = Math.max(1, ...data);
  const barW = width / data.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      {data.map((val, i) => {
        const barH = (val / max) * (height - 2);
        const opacity = val === 0 ? 0.08 : 0.15 + (val / max) * 0.65;
        return (
          <rect
            key={i}
            x={i * barW + 0.5}
            y={height - barH - 1}
            width={Math.max(barW - 1, 1)}
            height={Math.max(barH, 1)}
            rx={1}
            fill="currentColor"
            className="text-primary"
            opacity={opacity}
          />
        );
      })}
    </svg>
  );
}

// ── Stat config ─────────────────────────────────────────────────────

const STAT_CONFIG = [
  {
    key: 'total' as const,
    label: 'Total',
    Icon: MessageSquare,
    text: 'text-foreground',
    bg: 'bg-foreground/[0.06]',
    border: 'border-foreground/10',
  },
  {
    key: 'pending' as const,
    label: 'Pending',
    Icon: Clock,
    text: 'text-orange',
    bg: 'bg-orange/[0.08]',
    border: 'border-orange/15',
  },
  {
    key: 'delivered' as const,
    label: 'Delivered',
    Icon: Send,
    text: 'text-info',
    bg: 'bg-info/[0.08]',
    border: 'border-info/15',
  },
  {
    key: 'done' as const,
    label: 'Done',
    Icon: CheckCircle,
    text: 'text-green',
    bg: 'bg-green/[0.08]',
    border: 'border-green/15',
  },
] as const;

// ── Component ───────────────────────────────────────────────────────

export function FarmStats({ stats, recentMessages }: FarmStatsProps) {
  const throughput = useThroughput(recentMessages);
  const activityData = useActivityBuckets(recentMessages, 24);
  const hasActivity = activityData.some((v) => v > 0);

  const total = stats.total || 1;

  return (
    <div className="rounded-2xl border border-border/70 bg-card/88 backdrop-blur-xl px-3 py-2 shadow-[0_22px_52px_rgba(0,0,0,0.22)] space-y-1.5">
      {/* Top row: mini cards + throughput */}
      <div className="flex items-center gap-1.5">
        {STAT_CONFIG.map((cfg) => (
          <div
            key={cfg.key}
            className={`flex items-center gap-2 rounded-lg border ${cfg.border} ${cfg.bg} px-3 py-1.5`}
          >
            <cfg.Icon className={`${cfg.text} opacity-60`} size={14} />
            <span className={`text-base font-bold font-mono leading-none ${cfg.text}`}>
              {stats[cfg.key].toLocaleString()}
            </span>
            <span className="text-[0.6rem] text-muted-foreground uppercase tracking-wider leading-none">
              {cfg.label}
            </span>
          </div>
        ))}

        <div className="flex-1" />

        {/* Throughput */}
        <div className="flex items-center gap-1.5 rounded-lg border border-primary/15 bg-primary/[0.06] px-3 py-1.5">
          <TrendingUp className="text-primary opacity-60" size={13} />
          <span className="text-sm font-bold font-mono text-primary leading-none">
            ~{throughput}
          </span>
          <span className="text-[0.6rem] text-muted-foreground uppercase tracking-wider leading-none">
            msg/min
          </span>
        </div>
      </div>

      {/* Stacked progress bar */}
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
        {stats.pending > 0 && (
          <div
            className="bg-orange transition-all duration-500"
            style={{ width: `${(stats.pending / total) * 100}%` }}
          />
        )}
        {stats.delivered > 0 && (
          <div
            className="bg-info transition-all duration-500"
            style={{ width: `${(stats.delivered / total) * 100}%` }}
          />
        )}
        {stats.done > 0 && (
          <div
            className="bg-green transition-all duration-500"
            style={{ width: `${(stats.done / total) * 100}%` }}
          />
        )}
      </div>

      {/* Activity sparkline */}
      {hasActivity && (
        <div className="flex items-center gap-2">
          <span className="text-[0.55rem] text-muted-foreground/40 uppercase tracking-widest shrink-0">24h</span>
          <div className="flex-1 h-6">
            <Sparkline data={activityData} />
          </div>
          <span className="text-[0.55rem] text-muted-foreground/40 uppercase tracking-widest shrink-0">now</span>
        </div>
      )}
    </div>
  );
}
