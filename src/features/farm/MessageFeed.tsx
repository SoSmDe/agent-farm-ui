/**
 * MessageFeed — Scrollable list of recent bus messages with status
 * filtering, relative timestamps, priority indicators, and auto-scroll.
 * Enhanced with agent avatar dots and compact chat-style layout.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowRight, AlertCircle, ChevronUp } from 'lucide-react';
import type { FarmMessage } from './useFarmData';

// ── Status badge config ──────────────────────────────────────────────

const MSG_STATUS_CONFIG = {
  pending: { bg: 'bg-orange/15 text-orange border-orange/25', text: 'pending' },
  delivered: { bg: 'bg-info/15 text-info border-info/25', text: 'delivered' },
  done: { bg: 'bg-green/10 text-green/60 border-green/15', text: 'done' },
} as const;

// ── Filter ──────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'pending' | 'delivered' | 'done';

const FILTER_TABS: { key: StatusFilter; label: string; count?: boolean }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending', count: true },
  { key: 'delivered', label: 'Active' },
  { key: 'done', label: 'Done' },
];

// ── Agent color hash ────────────────────────────────────────────────

const AGENT_COLORS = [
  '#7fc782', '#e79a59', '#6ba3e0', '#c47fd0', '#e06c66',
  '#5dc4b8', '#d4a843', '#8b8be0', '#e08888', '#6bc47f',
];

function agentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

// ── Time ────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return 'now';
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function fullTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
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

  const filtered = useMemo(
    () => (filter === 'all' ? messages : messages.filter((m) => m.status === filter)),
    [messages, filter],
  );

  const pendingCount = useMemo(
    () => messages.filter((m) => m.status === 'pending').length,
    [messages],
  );

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    userScrolledRef.current = el.scrollTop > 40;
    if (el.scrollTop <= 40) setShowNewPill(false);
  }, []);

  useEffect(() => {
    if (messages.length <= prevCountRef.current) {
      prevCountRef.current = messages.length;
      return;
    }
    prevCountRef.current = messages.length;
    const el = scrollRef.current;
    if (!el) return;
    if (!userScrolledRef.current) {
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

  // Tick for relative times
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/30">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-2.5 py-1 rounded-full text-[0.667rem] font-medium transition-colors flex items-center gap-1 ${
              filter === tab.key
                ? 'bg-foreground/10 text-foreground'
                : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-foreground/[0.04]'
            }`}
          >
            {tab.label}
            {tab.count && pendingCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-orange/20 text-orange text-[0.6rem] font-bold px-1">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Message list */}
      <div className="relative flex-1 min-h-0">
        {filtered.length === 0 ? (
          <div className="flex-1 h-full flex items-center justify-center text-muted-foreground/50 text-[0.733rem]">
            {filter === 'all' ? 'No messages yet' : `No ${filter} messages`}
          </div>
        ) : (
          <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto">
            {filtered.map((msg) => {
              const statusCfg = MSG_STATUS_CONFIG[msg.status] ?? MSG_STATUS_CONFIG.pending;
              const hasPriority = (msg.priority ?? 0) > 0;
              const fromColor = agentColor(msg.from || '');
              const isTgBridge = (msg.from || '').startsWith('tg-') || (msg.to || '').startsWith('tg-');

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 px-3 py-2 border-b border-border/20 hover:bg-foreground/[0.02] transition-colors ${isTgBridge ? 'opacity-60' : ''}`}
                >
                  {/* Agent dot */}
                  <div className="shrink-0 mt-1.5">
                    <div
                      className="size-2 rounded-full"
                      style={{ backgroundColor: fromColor }}
                      title={msg.from}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Route */}
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-[0.7rem] font-semibold text-foreground/80" style={{ color: fromColor }}>
                        {msg.from}
                      </span>
                      <ArrowRight size={9} className="text-muted-foreground/30 shrink-0" />
                      <span className="text-[0.7rem] text-foreground/60">{msg.to}</span>
                      {hasPriority && <AlertCircle size={10} className="text-orange shrink-0" />}
                      <span className="ml-auto text-[0.55rem] text-muted-foreground/35 font-mono" title={fullTimestamp(msg.timestamp)}>
                        {relativeTime(msg.timestamp)}
                      </span>
                    </div>
                    {/* Message text */}
                    <p className="text-[0.733rem] text-foreground/85 line-clamp-2 leading-relaxed">{msg.content}</p>
                  </div>

                  {/* Status */}
                  <div className="shrink-0 mt-1">
                    <span className={`inline-flex items-center rounded border px-1 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wider ${statusCfg.bg}`}>
                      {statusCfg.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* New messages pill */}
        {showNewPill && (
          <button
            onClick={jumpToTop}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-3 py-1 rounded-full bg-foreground/90 text-background text-[0.667rem] font-medium shadow-lg hover:bg-foreground transition-colors"
          >
            <ChevronUp size={12} />
            New messages
          </button>
        )}
      </div>
    </div>
  );
}
