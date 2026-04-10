/**
 * EdgeConversation — Popover showing conversation between two agents.
 * Triggered by clicking an edge in OrgChart.
 */

import { useState, useEffect, useCallback } from "react";
import { X, ArrowRight, Loader2 } from "lucide-react";

interface BusMessage {
  id: number;
  from_agent: string;
  to_agent: string;
  message: string;
  status: string;
  correlation_id: string | null;
  created_at: string;
}

interface EdgeConversationProps {
  agentA: string;
  agentB: string;
  onClose: () => void;
}

function shortTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

// Agent color hash (same as MessageFeed)
const AGENT_COLORS = [
  "#7fc782", "#e79a59", "#6ba3e0", "#c47fd0", "#e06c66",
  "#5dc4b8", "#d4a843", "#8b8be0", "#e08888", "#6bc47f",
];
function agentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

export function EdgeConversation({ agentA, agentB, onClose }: EdgeConversationProps) {
  const [messages, setMessages] = useState<BusMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMessages = useCallback(() => {
    setLoading(true);
    // Load messages for both agents and filter to their conversation
    Promise.all([
      fetch(`/api/farm/messages?agent=${agentA}&limit=200`).then((r) => r.json()),
      fetch(`/api/farm/messages?agent=${agentB}&limit=200`).then((r) => r.json()),
    ]).then(([dataA, dataB]) => {
      const allMsgs: BusMessage[] = [...(dataA.messages ?? []), ...(dataB.messages ?? [])];
      // Deduplicate by id
      const seen = new Set<number>();
      const unique = allMsgs.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      // Filter to conversation between A and B
      const conversation = unique.filter(
        (m) =>
          (m.from_agent === agentA && m.to_agent === agentB) ||
          (m.from_agent === agentB && m.to_agent === agentA)
      );
      // Sort oldest first (chat order)
      conversation.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setMessages(conversation);
    }).catch(() => {
      setMessages([]);
    }).finally(() => {
      setLoading(false);
    });
  }, [agentA, agentB]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const colorA = agentColor(agentA);
  const colorB = agentColor(agentB);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[55] bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Popover */}
      <div className="fixed top-[10%] left-1/2 -translate-x-1/2 z-[56] w-full max-w-xl bg-background border border-border rounded-xl shadow-2xl flex flex-col max-h-[75vh]">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border/40">
          <span className="text-sm font-bold" style={{ color: colorA }}>{agentA}</span>
          <ArrowRight size={14} className="text-muted-foreground/40" />
          <span className="text-sm font-bold" style={{ color: colorB }}>{agentB}</span>
          <span className="text-[0.667rem] text-muted-foreground/40 ml-2">
            {messages.length} messages
          </span>
          <button onClick={onClose} className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground/50 text-[0.733rem]">
              No direct messages between these agents
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const isFromA = msg.from_agent === agentA;
                const senderColor = isFromA ? colorA : colorB;

                return (
                  <div key={msg.id} className={`flex flex-col ${isFromA ? "items-start" : "items-end"}`}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 ${isFromA ? "bg-foreground/5 rounded-tl-sm" : "bg-primary/5 rounded-tr-sm"}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="size-1.5 rounded-full" style={{ backgroundColor: senderColor }} />
                        <span className="text-[0.667rem] font-semibold" style={{ color: senderColor }}>
                          {msg.from_agent}
                        </span>
                        <span className="text-[0.55rem] text-muted-foreground/30 font-mono ml-auto">
                          {shortTime(msg.created_at)}
                        </span>
                      </div>
                      <p className="text-[0.8rem] text-foreground/85 whitespace-pre-wrap break-words leading-relaxed">
                        {msg.message}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
