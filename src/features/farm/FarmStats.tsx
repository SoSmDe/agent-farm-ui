/**
 * FarmStats — Horizontal stats bar with message counts.
 *
 * Displays total messages, pending, delivered, and done counts
 * in a compact horizontal layout.
 */

import type { FarmStats as FarmStatsType } from './useFarmData';

// ── Component ────────────────────────────────────────────────────────

interface FarmStatsProps {
  stats: FarmStatsType;
}

export function FarmStats({ stats }: FarmStatsProps) {
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-border/70 bg-card/88 backdrop-blur-xl px-4 py-2.5 shadow-[0_22px_52px_rgba(0,0,0,0.22)]">
      <StatItem label="Total" value={stats.total} colorClass="text-foreground" />
      <Divider />
      <StatItem label="Pending" value={stats.pending} colorClass="text-orange" />
      <Divider />
      <StatItem label="Delivered" value={stats.delivered} colorClass="text-info" />
      <Divider />
      <StatItem label="Done" value={stats.done} colorClass="text-green" />
    </div>
  );
}

function StatItem({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="flex items-baseline gap-1.5 px-2">
      <span className={`text-base font-bold font-mono ${colorClass}`}>
        {value.toLocaleString()}
      </span>
      <span className="text-[0.667rem] text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-border/50 mx-1" />;
}
