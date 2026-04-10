/**
 * Timeline — Chronological activity feed across all agents.
 *
 * Shows messages grouped by time periods (today, yesterday, older)
 * with agent avatars, message previews, and status changes.
 */

import { useMemo, useState } from "react";
import { ArrowRight, Filter, MessageSquare, Clock, Search } from "lucide-react";
import type { FarmMessage, FarmAgent } from "./useFarmData";

// ── Agent colors ────────────────────────────────────────────────────

const AGENT_COLORS = [
  "#7fc782", "#e79a59", "#6ba3e0", "#c47fd0", "#e06c66",
  "#5dc4b8", "#d4a843", "#8b8be0", "#e08888", "#6bc47f",
];

function agentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

// ── Time helpers ────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function getDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDateLabel(dateKey: string): string {
  const today = getDateKey(new Date().toISOString());
  const yesterday = getDateKey(new Date(Date.now() - 86400000).toISOString());
  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";
  return formatDate(dateKey + "T00:00:00Z");
}

// ── Types ───────────────────────────────────────────────────────────

interface TimelineProps {
  messages: FarmMessage[];
  agents: FarmAgent[];
  onSelectAgent?: (agent: FarmAgent) => void;
}

interface TimelineGroup {
  dateKey: string;
  label: string;
  messages: FarmMessage[];
}


// ── Text highlight ──────────────────────────────────────────────────

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-primary/20 text-foreground rounded-sm px-0.5">{part}</mark>
          : part
      )}
    </>
  );
}

// ── Component ───────────────────────────────────────────────────────

export function Timeline({ messages, agents, onSelectAgent }: TimelineProps) {
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [textSearch, setTextSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"all" | "agent-only">("all");

  // Get unique agent names
  const agentNames = useMemo(() => {
    const set = new Set<string>();
    for (const a of agents) set.add(a.name);
    return [...set].sort();
  }, [agents]);

  // Filter and sort messages
  const filtered = useMemo(() => {
    let result = [...messages];

    if (agentFilter !== "all") {
      result = result.filter(
        (m) => m.from === agentFilter || m.to === agentFilter
      );
    }

    if (directionFilter === "agent-only") {
      // Only agent-to-agent, exclude tg-bridge
      result = result.filter(
        (m) => m.from && m.to && !m.from.startsWith("tg-") && !m.to.startsWith("tg-")
      );
    }

    if (textSearch.trim()) {
      const q = textSearch.toLowerCase();
      result = result.filter((m) => (m.content || "").toLowerCase().includes(q));
    }

    // Sort newest first
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return result;
  }, [messages, agentFilter, directionFilter, textSearch]);

  // Group by date
  const groups = useMemo(() => {
    const map = new Map<string, FarmMessage[]>();
    for (const msg of filtered) {
      const key = getDateKey(msg.timestamp);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(msg);
    }
    const result: TimelineGroup[] = [];
    for (const [dateKey, msgs] of map) {
      result.push({ dateKey, label: getDateLabel(dateKey), messages: msgs });
    }
    return result.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filtered]);

  // Agent activity summary
  const activitySummary = useMemo(() => {
    const map = new Map<string, { lastActive: string; msgCount: number }>();
    for (const msg of messages) {
      if (!msg.from || !msg.to) continue;
      for (const name of [msg.from, msg.to]) {
        if (name.startsWith("tg-")) continue;
        if (!map.has(name)) map.set(name, { lastActive: msg.timestamp, msgCount: 0 });
        const entry = map.get(name)!;
        entry.msgCount++;
        if (msg.timestamp > entry.lastActive) entry.lastActive = msg.timestamp;
      }
    }
    return map;
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header bar */}
      <div className="shrink-0 px-6 py-3 border-b border-border/30 space-y-2">
        {/* Text search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
          <input
            type="text"
            placeholder="Search all messages..."
            value={textSearch}
            onChange={(e) => setTextSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-[0.8rem] rounded-md border border-border/30 bg-muted/20 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40"
          />
        </div>
        {/* Agent activity pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[0.6rem] text-muted-foreground/40 uppercase tracking-widest shrink-0">Activity:</span>
          {agents.map((agent) => {
            const summary = activitySummary.get(agent.name);
            const isActive = agentFilter === agent.name;
            return (
              <button
                key={agent.name}
                onClick={() => {
                  setAgentFilter(isActive ? "all" : agent.name);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium transition-colors border ${
                  isActive
                    ? "bg-foreground/10 text-foreground border-foreground/20"
                    : "text-muted-foreground/60 border-border/30 hover:border-border/60 hover:text-muted-foreground"
                }`}
              >
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: agentColor(agent.name) }}
                />
                {agent.name}
                {summary && (
                  <span className="text-[0.6rem] text-muted-foreground/40 font-mono">
                    {summary.msgCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter size={12} className="text-muted-foreground/40" />
          <button
            onClick={() => setDirectionFilter(directionFilter === "all" ? "agent-only" : "all")}
            className={`text-[0.667rem] rounded-full px-2.5 py-1 border transition-colors ${
              directionFilter === "agent-only"
                ? "bg-primary/10 text-primary border-primary/20"
                : "text-muted-foreground/50 border-border/30 hover:border-border/60"
            }`}
          >
            {directionFilter === "agent-only" ? "Agent-to-agent only" : "All messages"}
          </button>
          <span className="ml-auto text-[0.6rem] text-muted-foreground/30 font-mono">
            {filtered.length} messages
          </span>
        </div>
      </div>

      {/* Timeline content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {groups.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground/50 text-[0.733rem]">
            <MessageSquare size={16} className="mr-2 opacity-50" />
            No messages to display
          </div>
        ) : (
          <div className="px-6 py-4">
            {groups.map((group) => (
              <div key={group.dateKey} className="mb-6">
                {/* Date header */}
                <div className="sticky top-0 z-10 flex items-center gap-3 mb-3">
                  <span className="text-[0.733rem] font-semibold text-foreground/80 bg-background px-1">{group.label}</span>
                  <div className="flex-1 h-px bg-border/30" />
                  <span className="text-[0.6rem] text-muted-foreground/30 font-mono bg-background px-1">
                    {group.messages.length} msgs
                  </span>
                </div>

                {/* Messages */}
                <div className="relative ml-4 border-l-2 border-border/20 pl-6 space-y-0.5">
                  {group.messages.map((msg) => {
                    const fromColor = agentColor(msg.from || "");
                    const isTgBridge = (msg.from || "").startsWith("tg-") || (msg.to || "").startsWith("tg-");
                    const fromAgent = agents.find((a) => a.name === msg.from);

                    return (
                      <div
                        key={msg.id}
                        className={`relative py-2 group ${isTgBridge ? "opacity-50" : ""}`}
                      >
                        {/* Timeline dot */}
                        <div
                          className="absolute -left-[31px] top-3 size-3 rounded-full border-2 border-background"
                          style={{ backgroundColor: fromColor }}
                        />

                        {/* Time */}
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[0.6rem] text-muted-foreground/35 font-mono w-16">
                            {formatTime(msg.timestamp)}
                          </span>
                          <div className="flex items-center gap-1">
                            <span
                              className="text-[0.733rem] font-semibold cursor-pointer hover:underline"
                              style={{ color: fromColor }}
                              onClick={() => {
                                if (fromAgent && onSelectAgent) onSelectAgent(fromAgent);
                              }}
                            >
                              {msg.from}
                            </span>
                            <ArrowRight size={10} className="text-muted-foreground/30" />
                            <span className="text-[0.733rem] text-foreground/60">{msg.to}</span>
                          </div>
                          <span className={`ml-auto text-[0.55rem] rounded border px-1 py-0.5 font-semibold uppercase tracking-wider ${
                            msg.status === "pending" ? "bg-orange/15 text-orange border-orange/25"
                            : msg.status === "delivered" ? "bg-info/15 text-info border-info/25"
                            : "bg-green/10 text-green/60 border-green/15"
                          }`}>{msg.status}</span>
                        </div>

                        {/* Content */}
                        <p className="text-[0.8rem] text-foreground/80 leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                          {textSearch ? <HighlightText text={msg.content || ""} query={textSearch} /> : msg.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
