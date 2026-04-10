/**
 * ActivityHeatmap — Hour-of-day activity grid showing when agents communicate.
 * Added to the Agents tab below the communication matrix.
 */

import { useMemo } from "react";
import type { FarmMessage } from "./useFarmData";

interface ActivityHeatmapProps {
  messages: FarmMessage[];
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_LABELS = HOURS.map((h) => (h % 6 === 0 ? `${String(h).padStart(2, "0")}` : ""));

export function ActivityHeatmap({ messages }: ActivityHeatmapProps) {
  const buckets = useMemo(() => {
    const grid = new Array(24).fill(0);
    for (const msg of messages) {
      if (!msg.timestamp) continue;
      const d = new Date(msg.timestamp);
      if (Number.isNaN(d.getTime())) continue;
      const hour = d.getHours();
      grid[hour]++;
    }
    return grid;
  }, [messages]);

  const max = Math.max(1, ...buckets);
  const total = buckets.reduce((a, b) => a + b, 0);

  if (total === 0) return null;

  // Find peak hour
  const peakHour = buckets.indexOf(max);

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[0.667rem] uppercase tracking-widest text-muted-foreground/50">
          Activity by Hour
        </p>
        <span className="text-[0.6rem] text-muted-foreground/30 font-mono">
          peak: {String(peakHour).padStart(2, "0")}:00
        </span>
      </div>
      <div className="flex items-end gap-[2px] h-16">
        {buckets.map((count, hour) => {
          const intensity = count / max;
          const barH = Math.max(intensity * 100, count > 0 ? 8 : 2);
          return (
            <div key={hour} className="flex-1 flex flex-col items-center gap-0.5" title={`${String(hour).padStart(2, "0")}:00 — ${count} messages`}>
              <div
                className="w-full rounded-sm transition-all hover:opacity-100"
                style={{
                  height: `${barH}%`,
                  backgroundColor: count === 0
                    ? "var(--muted)"
                    : `rgba(99, 163, 224, ${0.15 + intensity * 0.75})`,
                  opacity: count === 0 ? 0.3 : 1,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-[2px] mt-1">
        {HOUR_LABELS.map((label, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[0.5rem] text-muted-foreground/30 font-mono">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
