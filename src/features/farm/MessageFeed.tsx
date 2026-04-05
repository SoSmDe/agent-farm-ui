/**
 * MessageFeed — Scrollable list of recent bus messages.
 *
 * Displays messages newest-first with from/to, content preview,
 * timestamp, and color-coded status badges.
 */

import type { FarmMessage } from './useFarmData';

// ── Status badge config ──────────────────────────────────────────────

const MSG_STATUS_CONFIG = {
  pending: {
    bg: 'bg-orange/15 text-orange border-orange/25',
    text: 'pending',
  },
  delivered: {
    bg: 'bg-info/15 text-info border-info/25',
    text: 'delivered',
  },
  done: {
    bg: 'bg-green/15 text-green border-green/25',
    text: 'done',
  },
} as const;

// ── Timestamp formatting ─────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

// ── Component ────────────────────────────────────────────────────────

interface MessageFeedProps {
  messages: FarmMessage[];
}

export function MessageFeed({ messages }: MessageFeedProps) {
  if (!messages.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground/50 text-[0.733rem]">
        No messages yet
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {messages.map((msg) => {
        const statusCfg = MSG_STATUS_CONFIG[msg.status] ?? MSG_STATUS_CONFIG.pending;
        return (
          <div
            key={msg.id}
            className="flex items-start gap-3 px-4 py-2.5 border-b border-border/30 hover:bg-foreground/[0.02] transition-colors"
          >
            {/* Route indicator */}
            <div className="shrink-0 pt-0.5">
              <div className="text-[0.667rem] font-mono text-muted-foreground">
                <span className="text-foreground/80">{msg.from}</span>
                <span className="text-muted-foreground/40 mx-1">{'\u2192'}</span>
                <span className="text-foreground/80">{msg.to}</span>
              </div>
            </div>

            {/* Content preview */}
            <div className="flex-1 min-w-0">
              <p className="text-[0.733rem] text-foreground/90 truncate">
                {msg.content}
              </p>
            </div>

            {/* Status badge + time */}
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider ${statusCfg.bg}`}
              >
                {statusCfg.text}
              </span>
              <span className="text-[0.6rem] text-muted-foreground/50 font-mono w-16 text-right">
                {formatTime(msg.timestamp)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
