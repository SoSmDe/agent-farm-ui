/**
 * FarmDashboard — Main Agent Farm mission control dashboard.
 *
 * Tabs: Overview | Agents | Org Chart
 * Clicking an agent card opens a detail panel with info/messages/files.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useFarmData } from './useFarmData';
import { AgentCard } from './AgentCard';
import { MessageFeed } from './MessageFeed';
import { FarmStats } from './FarmStats';
import { AgentDetails } from './AgentDetails';
import { OrgChart } from './OrgChart';
import { AgentDetailPanel } from './AgentDetailPanel';
import { Timeline } from "./Timeline";
import { SystemHealth } from "./SystemHealth";
import { ErrorBoundary } from "./ErrorBoundary";
import { EdgeConversation } from "./EdgeConversation";
import { Search } from "lucide-react";
import type { FarmAgent } from './useFarmData';

type DashboardTab = 'overview' | 'agents' | 'org' | 'timeline';

// ── Helpers ───────────────────────────────────────────────────────────

function useTimeAgo(timestamp: number | null): string {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (timestamp === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timestamp]);

  if (timestamp === null) return 'never';
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

// ── Skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <div className="shrink-0 px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="animate-pulse text-primary text-lg">&#x25C6;</span>
          <div className="h-5 w-24 bg-muted/50 rounded animate-pulse" />
          <div className="h-3 w-28 bg-muted/30 rounded animate-pulse" />
        </div>
      </div>
      <div className="shrink-0 px-6 pb-4">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 px-6 pb-6 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4">
        <div className="bg-muted/20 rounded-lg animate-pulse" />
        <div className="bg-muted/20 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

// ── Error State ───────────────────────────────────────────────────────

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center">
        <div className="h-10 w-10 rounded-full bg-red/10 flex items-center justify-center">
          <span className="text-red text-lg">&#x26A0;</span>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground mb-1">
            Failed to connect to Farm API
          </p>
          <p className="text-[0.733rem] text-muted-foreground">
            {error}
          </p>
        </div>
        <button
          onClick={onRetry}
          className="px-4 py-1.5 text-[0.733rem] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

// ── Connection Indicator ──────────────────────────────────────────────

function ConnectionIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          connected
            ? 'bg-green shadow-[0_0_4px_theme(colors.green)]'
            : 'bg-red shadow-[0_0_4px_theme(colors.red)]'
        }`}
      />
      <span
        className={`text-[0.667rem] uppercase tracking-widest ${
          connected ? 'text-green/80' : 'text-red/80'
        }`}
      >
        {connected ? 'Live' : 'Offline'}
      </span>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────

export function FarmDashboard() {
  const { agents, recentMessages, stats, loading, error, connected, lastUpdated, retry, agentMessageCounts } = useFarmData();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [selectedAgent, setSelectedAgent] = useState<FarmAgent | null>(null);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickSearchQuery, setQuickSearchQuery] = useState("");
  const [orgFullscreen, setOrgFullscreen] = useState(false);
  const [edgeConversation, setEdgeConversation] = useState<{ a: string; b: string } | null>(null);

  const timeAgo = useTimeAgo(lastUpdated);
  // Update browser tab title with pending count
  useEffect(() => {
    const pending = stats.pending;
    document.title = pending > 0 ? "(" + pending + ") Agent Farm" : "Agent Farm";
    return () => { document.title = "Agent Farm"; };
  }, [stats.pending]);

  // Shortcuts help modal
  const [showShortcuts, setShowShortcuts] = useState(false);


  const handleSelectAgent = useCallback((agent: FarmAgent) => {
    setSelectedAgent(agent);
  }, []);

  const handleSelectEdge = useCallback((a: string, b: string) => {
    setEdgeConversation({ a, b });
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedAgent(null);
  }, []);

  // Close panel on Escape
  useEffect(() => {
    if (!selectedAgent) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClosePanel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedAgent, handleClosePanel]);

  if (loading) return <LoadingSkeleton />;
  if (error && agents.length === 0) return <ErrorState error={error} onRetry={retry} />;

  const TAB_LABELS: { key: DashboardTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'agents', label: 'Agents' },
    { key: 'org', label: 'Org Chart' },
    { key: 'timeline', label: 'Timeline' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-primary text-lg">&#x25C6;</span>
          <h1 className="text-lg font-bold text-foreground tracking-tight">
            Agent Farm
          </h1>
          <span className="text-[0.667rem] text-muted-foreground/50 uppercase tracking-widest">
            Mission Control
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Agent status pills */}
          <div className="hidden md:flex items-center gap-1">
            {(() => {
              const idle = agents.filter((a) => a.status === "idle").length;
              const busy = agents.filter((a) => a.status === "busy").length;
              const offline = agents.filter((a) => a.status === "offline").length;
              return (
                <>
                  {idle > 0 && <span className="text-[0.6rem] text-green/80 bg-green/10 rounded-full px-2 py-0.5 font-mono">{idle} ready</span>}
                  {busy > 0 && <span className="text-[0.6rem] text-orange/80 bg-orange/10 rounded-full px-2 py-0.5 font-mono">{busy} busy</span>}
                  {offline > 0 && <span className="text-[0.6rem] text-muted-foreground/50 bg-muted/30 rounded-full px-2 py-0.5 font-mono">{offline} off</span>}
                </>
              );
            })()}
          </div>
          {/* Cmd+K hint */}
          <button
            onClick={() => { setQuickSearchOpen(true); setQuickSearchQuery(""); }}
            className="hidden sm:flex items-center gap-1.5 text-[0.667rem] text-muted-foreground/30 border border-border/30 rounded-md px-2.5 py-1 hover:text-muted-foreground/50 hover:border-border/50 transition-colors"
          >
            <Search size={12} />
            <span>Search</span>
            <kbd className="text-[0.55rem] border border-border/20 rounded px-1 ml-1">⌘K</kbd>
          </button>
          <ConnectionIndicator connected={connected} />
        </div>
      </div>

      {/* Tab switcher */}
      <div className="shrink-0 px-6 pb-3 flex items-center gap-1">
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-3 py-1.5 rounded-md text-[0.733rem] font-medium uppercase tracking-wider transition-colors ${
              activeTab === key
                ? 'bg-foreground/10 text-foreground'
                : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-foreground/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Inline error banner */}
      {error && agents.length > 0 && (
        <div className="shrink-0 mx-6 mb-3 flex items-center justify-between rounded-md border border-red/30 bg-red/10 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[0.667rem] text-red">
            <span>&#x26A0;</span>
            {error}
          </div>
          <button
            onClick={retry}
            className="text-[0.667rem] font-medium text-red hover:text-red/80 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {activeTab === 'overview' && (
        <>
          <div className="shrink-0 px-6 pb-4">
            <FarmStats stats={stats} recentMessages={recentMessages} />
          </div>
          <div className="flex-1 min-h-0 px-6 pb-6 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4">
            {/* Agents grid — cards are clickable */}
            <Card className="flex flex-col min-h-0">
              <CardHeader className="border-b border-border/40">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <span className="text-green text-xs">&#x25CF;</span>
                  Agents
                  <span className="text-[0.667rem] text-muted-foreground font-normal ml-auto">
                    {agents.length} total
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto py-3">
                {agents.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground/50 text-[0.733rem]">
                    No agents registered
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                    {agents.map((agent) => (
                      <div key={agent.id} onClick={() => handleSelectAgent(agent)} className="cursor-pointer">
                        <AgentCard
                          agent={agent}
                          messageCounts={agentMessageCounts[agent.name]}
                          recentMessages={recentMessages}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="flex flex-col min-h-0">
              <CardHeader className="border-b border-border/40">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <span className="text-info text-xs">&#x25CF;</span>
                  Message Bus
                  <span className="text-[0.667rem] text-muted-foreground font-normal ml-auto">
                    {recentMessages.length} recent
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 flex flex-col p-0">
                <MessageFeed messages={recentMessages} />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {activeTab === 'agents' && (
        <ErrorBoundary label="Agents"><AgentDetails
          agents={agents}
          messages={recentMessages}
          onSelectAgent={handleSelectAgent}
        /></ErrorBoundary>
      )}

      {activeTab === 'org' && (
        <OrgChart
          agents={agents}
          messages={recentMessages}
          onSelectAgent={handleSelectAgent}
          selectedAgentName={selectedAgent?.name ?? null}
          onSelectEdge={handleSelectEdge}
        />
      )}

      {activeTab === 'timeline' && (
        <ErrorBoundary label="Timeline"><Timeline
          messages={recentMessages}
          agents={agents}
          onSelectAgent={handleSelectAgent}
        /></ErrorBoundary>
      )}

      {/* Footer */}
      <div className="shrink-0 px-6 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[0.55rem] text-muted-foreground/25 font-mono">{agents.length} agents</span>
          <span className="text-[0.55rem] text-muted-foreground/25 font-mono">{recentMessages.length} msgs</span>
          <span className="text-[0.55rem] text-muted-foreground/15">|</span>
          <span className="text-[0.55rem] text-muted-foreground/20 cursor-help" title="Press ? for keyboard shortcuts">? shortcuts</span>
        </div>
        <span className="text-[0.55rem] text-muted-foreground/30 font-mono">
          {timeAgo}
        </span>
      </div>

      {/* Keyboard Shortcuts Help */}
      {showShortcuts && (
        <>
          <div className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-sm" onClick={() => setShowShortcuts(false)} />
          <div className="fixed top-[15%] left-1/2 -translate-x-1/2 z-[81] w-full max-w-sm bg-background border border-border rounded-xl shadow-2xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">Keyboard Shortcuts</h3>
            <div className="space-y-2">
              {[
                { keys: "Ctrl + K", desc: "Quick search agents" },
                { keys: "?", desc: "Show this help" },
                { keys: "Esc", desc: "Close panel / modal" },
                { keys: "1-4", desc: "Switch tabs (Overview, Agents, Org, Timeline)" },
              ].map(({ keys, desc }) => (
                <div key={keys} className="flex items-center justify-between">
                  <span className="text-[0.8rem] text-muted-foreground">{desc}</span>
                  <kbd className="text-[0.667rem] text-foreground/70 bg-muted/40 border border-border/30 rounded px-2 py-0.5 font-mono">{keys}</kbd>
                </div>
              ))}
            </div>
            <p className="text-[0.6rem] text-muted-foreground/30 mt-4 text-center">Press ? or Esc to close</p>
          </div>
        </>
      )}

      {/* Edge Conversation Popover */}
      {edgeConversation && (
        <EdgeConversation
          agentA={edgeConversation.a}
          agentB={edgeConversation.b}
          onClose={() => setEdgeConversation(null)}
        />
      )}

      {/* Quick Search Modal (Cmd+K) */}
      {quickSearchOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm" onClick={() => { setQuickSearchOpen(false); setQuickSearchQuery(""); }} />
          <div className="fixed top-[20%] left-1/2 -translate-x-1/2 z-[70] w-full max-w-md bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
              <Search size={16} className="text-muted-foreground/50 shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Search agents..."
                value={quickSearchQuery}
                onChange={(e) => setQuickSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
              />
              <kbd className="text-[0.6rem] text-muted-foreground/30 border border-border/30 rounded px-1.5 py-0.5">ESC</kbd>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {agents
                .filter((a) => !quickSearchQuery || a.name.toLowerCase().includes(quickSearchQuery.toLowerCase()) || (a.role || "").toLowerCase().includes(quickSearchQuery.toLowerCase()))
                .map((agent) => {
                  const cfg = { idle: "bg-green", busy: "bg-orange", offline: "bg-red/60" }[agent.status] ?? "bg-red/60";
                  return (
                    <button
                      key={agent.id}
                      onClick={() => { handleSelectAgent(agent); setQuickSearchOpen(false); setQuickSearchQuery(""); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-foreground/5 transition-colors text-left"
                    >
                      <span className={"inline-block size-2 rounded-full " + cfg} />
                      <span className="text-sm font-semibold text-foreground">{agent.name}</span>
                      <span className="text-[0.733rem] text-muted-foreground/50 truncate flex-1">{agent.role || "agent"}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </>
      )}

      {/* Agent Detail Panel (slide-out) */}
      {selectedAgent && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleClosePanel}
          />
          <AgentDetailPanel
            agent={selectedAgent}
            messages={recentMessages}
          onSelectAgent={handleSelectAgent}
            onClose={handleClosePanel}
          />
        </>
      )}
    </div>
  );
}
