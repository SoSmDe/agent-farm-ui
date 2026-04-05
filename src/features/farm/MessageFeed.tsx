/**
 * MessageFeed — Scrollable list of recent bus messages with status
 * filtering, relative timestamps, priority indicators, and auto-scroll.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowRight, AlertCircle, ChevronUp } from 'lucide-react';
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

// ── Filter tab types ────────────────────────────────────────────────

type StatusFilter = 'all' | 'pending' | 'delivered' | 'done';

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'done', label: 'Done' },
];

const EMPTY_MESSAGES: Record<StatusFilter, string> = {
  all: 'No messages yet',
  pending: 'No pending messages',
  delivered: 'No delivered messages',
  done: 'No completed messages',
};

// ── Relative time formatting ────────────────────────────────────────

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);

  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function fullTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// ── Component ────────────────────────────────────────────────────────

interface MessageFeedProps {
  messages: FarmMessage[];
}

export function MessageFeed({ messages }: MessageFeedProps) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [showNewPill, setShowNewPill] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(messages.length);
  const userScrolledRef = useRef(false);

  // Filtered messages
  const filtered = useMemo(
    () => (filter === 'all' ? messages : messages.filter((m) => m.status === filter)),
    [messages, filter],
  );

  // Track whether user has scrolled away from top
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    userScrolledRef.current = el.scrollTop > 40;
    // If user scrolled back to top, hide pill
    if (el.scrollTop <= 40) setShowNewPill(false);
  }, []);

  // Auto-scroll or show "new messages" pill when new messages arrive
  useEffect(() => {
    if (messages.length <= prevCountRef.current) {
      prevCountRef.current = messages.length;
      return;
    }
    prevCountRef.current = messages.length;

    const el = scrollRef.current;
    if (!el) return;

    if (!userScrolledRef.current) {
      // User is at top — auto-scroll to show new messages
      el.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setShowNewPill(true);
    }
  }, [messages.length]);

  const jumpToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setShowNewPill(false);
    userScrolledRef.current = false;
  }, []);

  // Relative time refresh
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Filter tabs ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/30">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`
              px-2.5 py-1 rounded-full text-[0.667rem] font-medium transition-colors
              ${
                filter === tab.key
                  ? 'bg-foreground/10 text-foreground'
                  : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-foreground/[0.04]'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Message list ────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
        {filtered.length === 0 ? (
          <div className="flex-1 h-full flex items-center justify-center text-muted-foreground/50 text-[0.733rem]">
            {EMPTY_MESSAGES[filter]}
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto"
          >
            {filtered.map((msg) => {
              const statusCfg =
                MSG_STATUS_CONFIG[msg.status] ?? MSG_STATUS_CONFIG.pending;
              const hasPriority = (msg.priority ?? 0) > 0;

              return (
                <div
                  key={msg.id}
                  className="animate-feed-enter flex items-start gap-3 px-4 py-2.5 border-b border-border/30 hover:bg-foreground/[0.02] transition-colors"
                >
                  {/* Route indicator */}
                  <div className="shrink-0 pt-0.5">
                    <div className="flex items-center gap-1 text-[0.667rem] font-mono text-muted-foreground">
                      <span className="text-foreground/80">{msg.from}</span>
                      <ArrowRight size={10} className="text-muted-foreground/40" />
                      <span className="text-foreground/80">{msg.to}</span>
                    </div>
                  </div>

                  {/* Content preview — up to 2 lines with ellipsis */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.733rem] text-foreground/90 line-clamp-2">
                      {msg.content}
                    </p>
                  </div>

                  {/* Priority + status badge + relative time */}
                  <div className="flex items-center gap-2 shrink-0">
                    {hasPriority && (
                      <AlertCircle
                        size={12}
                        className="text-orange shrink-0"
                        aria-label="High priority"
                      />
                    )}
                    <span
                      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider ${statusCfg.bg}`}
                    >
                      {statusCfg.text}
                    </span>
                    <span
                      className="text-[0.6rem] text-muted-foreground/50 font-mono w-16 text-right cursor-default"
                      title={fullTimestamp(msg.timestamp)}
                    >
                      {relativeTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── "New messages" pill ──────────────────────────────── */}
        {showNewPill && (
          <button
            onClick={jumpToTop}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-3 py-1 rounded-full bg-foreground/90 text-background text-[0.667rem] font-medium shadow-lg hover:bg-foreground transition-colors animate-feed-enter"
          >
            <ChevronUp size={12} />
            New messages
          </button>
        )}
      </div>
    </div>
  );
}
