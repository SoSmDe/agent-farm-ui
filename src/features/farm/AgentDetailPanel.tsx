/**
 * AgentDetailPanel — Slide-out panel showing detailed agent info.
 *
 * Tabs: Info | Messages | Files
 * Messages: full history with thread grouping, partner filter, text search.
 * Files: persona + workspace files from the agent directory.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { X, ArrowRight, User, MessageSquare, FolderOpen, Clock, Activity, Mail, FileText, Loader2, Search, Filter, GitBranch, List, Copy, Check, Download } from 'lucide-react';
import type { FarmAgent, FarmMessage } from './useFarmData';

// ── Copy to clipboard hook ────────────────────────────────────────

function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, []);
  return { copied, copy };
}

// ── Copy button component ─────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); copy(text); }}
      className="inline-flex items-center gap-1 text-[0.6rem] text-muted-foreground/40 hover:text-muted-foreground px-1.5 py-0.5 rounded border border-border/20 hover:border-border/40 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check size={10} className="text-green" /> : <Copy size={10} />}
      {label && <span>{label}</span>}
    </button>
  );
}

// ── Types ────────────────────────────────────────────────────────────

interface AgentDetailPanelProps {
  agent: FarmAgent;
  messages: FarmMessage[];
  onClose: () => void;
}

type DetailTab = 'info' | 'messages' | 'files';

// ── Status config ───────────────────────────────────────────────────

const STATUS_CONFIG = {
  idle: { color: 'text-green', bg: 'bg-green/10 border-green/20', dot: 'bg-green', label: 'Ready' },
  busy: { color: 'text-orange', bg: 'bg-orange/10 border-orange/20', dot: 'bg-orange', label: 'Working' },
  offline: { color: 'text-red', bg: 'bg-red/10 border-red/20', dot: 'bg-red', label: 'Offline' },
} as const;

// ── Helpers ──────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fullTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function shortTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// ── Agent Files Tab ─────────────────────────────────────────────

interface AgentFile {
  name: string;
  size: number;
  type: 'persona' | 'workspace' | 'memory' | 'other';
  modified?: string;
}

function AgentFilesTab({ agentName }: { agentName: string }) {
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelectedFile(null);
    setFileContent(null);
    fetch(`/api/farm/agents/${agentName}/files`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setFiles(data.files ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [agentName]);

  const loadFile = useCallback((fileName: string) => {
    setSelectedFile(fileName);
    setFileLoading(true);
    setFileContent(null);
    fetch(`/api/farm/agents/${agentName}/files/${fileName}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setFileContent(data.content ?? '');
      })
      .catch((e) => setFileContent(`Error: ${e.message}`))
      .finally(() => setFileLoading(false));
  }, [agentName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground/50 gap-2">
        <FolderOpen size={32} strokeWidth={1} />
        <p className="text-[0.733rem]">{error}</p>
      </div>
    );
  }

  const personaFiles = files.filter((f) => f.type === 'persona');
  const memoryFiles = files.filter((f) => f.type === 'memory');
  const workspaceFiles = files.filter((f) => f.type === 'workspace');
  const otherFiles = files.filter((f) => f.type === 'other');

  function formatSize(size: number): string {
    if (size > 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`;
    if (size > 1024) return `${(size / 1024).toFixed(1)}KB`;
    return `${size}B`;
  }

  // Simple markdown rendering for file content
  function renderMarkdown(text: string) {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    for (const line of lines) {
      i++;
      // Headers
      if (line.startsWith('### ')) {
        elements.push(<h4 key={i} className="text-[0.85rem] font-bold text-foreground mt-3 mb-1">{line.slice(4)}</h4>);
      } else if (line.startsWith('## ')) {
        elements.push(<h3 key={i} className="text-[0.9rem] font-bold text-foreground mt-4 mb-1 border-b border-border/20 pb-1">{line.slice(3)}</h3>);
      } else if (line.startsWith('# ')) {
        elements.push(<h2 key={i} className="text-base font-bold text-foreground mt-4 mb-2 border-b border-border/30 pb-1">{line.slice(2)}</h2>);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(
          <div key={i} className="flex gap-2 text-[0.8rem] text-foreground/85 leading-relaxed pl-2">
            <span className="text-muted-foreground/40 shrink-0">&#x2022;</span>
            <span>{renderInline(line.slice(2))}</span>
          </div>
        );
      } else if (line.startsWith('---')) {
        elements.push(<hr key={i} className="border-border/20 my-2" />);
      } else if (line.trim() === '') {
        elements.push(<div key={i} className="h-2" />);
      } else {
        elements.push(<p key={i} className="text-[0.8rem] text-foreground/85 leading-relaxed">{renderInline(line)}</p>);
      }
    }
    return elements;
  }

  function renderInline(text: string): React.ReactNode {
    // Bold **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      // Inline code `text`
      const codeParts = part.split(/(`[^`]+`)/g);
      return codeParts.map((cp, ci) => {
        if (cp.startsWith('`') && cp.endsWith('`')) {
          return <code key={`${idx}-${ci}`} className="text-[0.75rem] bg-muted/40 rounded px-1 py-0.5 font-mono text-primary/80">{cp.slice(1, -1)}</code>;
        }
        return cp;
      });
    });
  }

  return (
    <div className="flex flex-col h-full">
      {!selectedFile && (
        <div className="p-4 space-y-4">
          {[
            { title: 'Persona', list: personaFiles, icon: <FileText size={16} />, cls: 'text-primary/60' },
            { title: 'Memory', list: memoryFiles, icon: <Clock size={16} />, cls: 'text-info/60' },
            { title: 'Workspace', list: workspaceFiles, icon: <FolderOpen size={16} />, cls: 'text-orange/60' },
            { title: 'Other', list: otherFiles, icon: <FileText size={16} />, cls: 'text-muted-foreground/60' },
          ].map(({ title, list, icon, cls }) => list.length > 0 && (
            <div key={title}>
              <p className="text-[0.667rem] uppercase tracking-widest text-muted-foreground/50 mb-2">
                {title} <span className="text-muted-foreground/30">({list.length})</span>
              </p>
              <div className="space-y-1">
                {list.map((f) => {
                  const displayName = f.name.replace(/^(workspace|memories)\//, '');
                  return (
                    <button
                      key={f.name}
                      onClick={() => loadFile(f.name)}
                      className="w-full flex items-center gap-3 rounded-lg border border-border/30 bg-card/30 px-3 py-2.5 hover:bg-foreground/5 transition-colors text-left group"
                    >
                      <span className={`shrink-0 ${cls}`}>{icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground block truncate">{displayName}</span>
                        {f.modified && (
                          <span className="text-[0.6rem] text-muted-foreground/30 font-mono">{relativeTime(f.modified)}</span>
                        )}
                      </div>
                      <span className="text-[0.625rem] text-muted-foreground/40 font-mono shrink-0">
                        {formatSize(f.size)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {files.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground/50 gap-2">
              <FolderOpen size={24} strokeWidth={1} />
              <p className="text-[0.733rem]">No files found</p>
            </div>
          )}
        </div>
      )}
      {selectedFile && (
        <div className="flex flex-col h-full">
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border/30">
            <button onClick={() => { setSelectedFile(null); setFileContent(null); }} className="text-[0.733rem] text-primary hover:text-primary/80 transition-colors">&larr; Back</button>
            <span className="text-[0.8rem] font-medium text-foreground flex-1">{selectedFile}</span>
            {fileContent && (
              <CopyButton text={fileContent} />
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {fileLoading ? (
              <div className="flex items-center justify-center h-32"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
            ) : selectedFile.endsWith('.md') ? (
              <div className="space-y-0.5">{renderMarkdown(fileContent ?? '')}</div>
            ) : (
              <pre className="text-[0.8rem] text-foreground/90 whitespace-pre-wrap font-mono leading-relaxed bg-muted/20 rounded-lg p-4 border border-border/30">{fileContent}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Agent Messages Tab (full history with threads & filters) ────

interface BusMessage {
  id: number;
  from_agent: string;
  to_agent: string;
  message: string;
  status: string;
  priority: number;
  correlation_id: string | null;
  created_at: string;
  delivered_at: string | null;
}

interface Thread {
  id: string;
  messages: BusMessage[];
  participants: string[];
  firstTime: string;
  lastTime: string;
}

type MsgViewMode = 'flat' | 'threads';

function AgentMessagesTab({ agentName }: { agentName: string }) {
  const [messages, setMessages] = useState<BusMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [partnerFilter, setPartnerFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<MsgViewMode>('flat');
  const [expandedThread, setExpandedThread] = useState<string | null>(null);

  const loadMessages = useCallback(() => {
    setLoading(true);
    fetch(`/api/farm/messages?agent=${agentName}&limit=200`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setMessages(data.messages ?? []);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [agentName]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Extract unique partners
  const partners = useMemo(() => {
    const set = new Set<string>();
    for (const msg of messages) {
      if (msg.from_agent !== agentName) set.add(msg.from_agent);
      if (msg.to_agent !== agentName) set.add(msg.to_agent);
    }
    return [...set].sort();
  }, [messages, agentName]);

  // Filter messages
  const filtered = useMemo(() => {
    let result = messages;
    if (partnerFilter !== 'all') {
      result = result.filter(
        (m) => m.from_agent === partnerFilter || m.to_agent === partnerFilter
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m) => m.message.toLowerCase().includes(q));
    }
    return result;
  }, [messages, partnerFilter, searchQuery]);

  // Group into threads by correlation_id
  const threads = useMemo(() => {
    const map = new Map<string, BusMessage[]>();
    const noThread: BusMessage[] = [];
    for (const msg of filtered) {
      if (msg.correlation_id) {
        if (!map.has(msg.correlation_id)) map.set(msg.correlation_id, []);
        map.get(msg.correlation_id)!.push(msg);
      } else {
        noThread.push(msg);
      }
    }
    const result: Thread[] = [];
    for (const [id, msgs] of map) {
      const participants = [...new Set(msgs.flatMap((m) => [m.from_agent, m.to_agent]))];
      const sorted = msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      result.push({
        id,
        messages: sorted,
        participants,
        firstTime: sorted[0].created_at,
        lastTime: sorted[sorted.length - 1].created_at,
      });
    }
    // Add standalone messages as single-message threads
    for (const msg of noThread) {
      result.push({
        id: `standalone-${msg.id}`,
        messages: [msg],
        participants: [msg.from_agent, msg.to_agent],
        firstTime: msg.created_at,
        lastTime: msg.created_at,
      });
    }
    return result.sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
  }, [filtered]);

  if (loading) {
    return <div className="flex items-center justify-center h-48"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground/50 gap-2">
        <MessageSquare size={32} strokeWidth={1} />
        <p className="text-[0.733rem]">{error}</p>
        <button onClick={loadMessages} className="text-[0.667rem] text-primary">Retry</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar: search, filter, view mode */}
      <div className="shrink-0 px-3 py-2 border-b border-border/30 space-y-2">
        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-[0.8rem] rounded-md border border-border/30 bg-muted/20 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40"
          />
        </div>
        {/* Filter + View mode */}
        <div className="flex items-center gap-2">
          <Filter size={12} className="text-muted-foreground/40 shrink-0" />
          <select
            value={partnerFilter}
            onChange={(e) => setPartnerFilter(e.target.value)}
            className="flex-1 text-[0.733rem] rounded-md border border-border/30 bg-muted/20 text-foreground py-1 px-2 focus:outline-none focus:border-primary/40"
          >
            <option value="all">All partners</option>
            {partners.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <div className="flex items-center rounded-md border border-border/30 overflow-hidden">
            <button
              onClick={() => setViewMode('flat')}
              className={`px-2 py-1 text-[0.667rem] transition-colors ${viewMode === 'flat' ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
              title="Flat view"
            >
              <List size={13} />
            </button>
            <button
              onClick={() => setViewMode('threads')}
              className={`px-2 py-1 text-[0.667rem] transition-colors ${viewMode === 'threads' ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
              title="Thread view"
            >
              <GitBranch size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground/50 text-[0.733rem]">
            {searchQuery || partnerFilter !== 'all' ? 'No matching messages' : 'No messages'}
          </div>
        ) : viewMode === 'flat' ? (
          /* ── Flat view (chat-style) ── */
          <div className="divide-y divide-border/10">
            {filtered.map((msg) => {
              const isOutgoing = msg.from_agent === agentName;
              return (
                <div key={msg.id} className={`px-4 py-2.5 transition-colors hover:bg-foreground/[0.02] group ${isOutgoing ? '' : ''}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className={`flex items-center gap-1 text-[0.7rem] font-mono ${isOutgoing ? 'flex-row' : 'flex-row'}`}>
                      <span className={`inline-block size-1.5 rounded-full ${isOutgoing ? 'bg-green/60' : 'bg-info/60'}`} />
                      <span className={isOutgoing ? 'text-foreground/70 font-semibold' : 'text-muted-foreground/60'}>{msg.from_agent}</span>
                      <ArrowRight size={9} className="text-muted-foreground/30" />
                      <span className={isOutgoing ? 'text-muted-foreground/60' : 'text-foreground/70 font-semibold'}>{msg.to_agent}</span>
                    </div>
                    {msg.correlation_id && (
                      <span className="text-[0.55rem] text-primary/40 font-mono bg-primary/5 rounded px-1">#{msg.correlation_id.slice(0, 8)}</span>
                    )}
                    <span className="ml-auto text-[0.6rem] text-muted-foreground/30 font-mono">{shortTime(msg.created_at)}</span>
                    <span className={`text-[0.55rem] rounded border px-1 py-0.5 font-semibold uppercase tracking-wider ${
                      msg.status === 'pending' ? 'bg-orange/15 text-orange border-orange/25'
                      : msg.status === 'delivered' ? 'bg-info/15 text-info border-info/25'
                      : 'bg-green/10 text-green/60 border-green/15'
                    }`}>{msg.status}</span>
                  </div>
                  <div className={`flex items-start gap-1 ${isOutgoing ? 'pl-4 border-l-2 border-green/20' : 'pl-4 border-l-2 border-info/20'}`}>
                    <p className={`text-[0.8rem] whitespace-pre-wrap break-words leading-relaxed flex-1 ${isOutgoing ? 'text-foreground/80' : 'text-foreground/90'}`}>
                      {msg.message}
                    </p>
                    <span className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                      <CopyButton text={msg.message} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Thread view ── */
          <div className="divide-y divide-border/20">
            {threads.map((thread) => {
              const isExpanded = expandedThread === thread.id;
              const isStandalone = thread.messages.length === 1;
              const preview = thread.messages[0];
              const otherParticipants = thread.participants.filter((p) => p !== agentName);

              if (isStandalone) {
                // Single message — render inline
                const msg = preview;
                const isOutgoing = msg.from_agent === agentName;
                return (
                  <div key={thread.id} className="px-4 py-2.5 hover:bg-foreground/[0.02] transition-colors">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`inline-block size-1.5 rounded-full ${isOutgoing ? 'bg-green/60' : 'bg-info/60'}`} />
                      <span className="text-[0.7rem] font-mono text-foreground/70">{msg.from_agent}</span>
                      <ArrowRight size={9} className="text-muted-foreground/30" />
                      <span className="text-[0.7rem] font-mono text-foreground/70">{msg.to_agent}</span>
                      <span className="ml-auto text-[0.6rem] text-muted-foreground/30 font-mono">{shortTime(msg.created_at)}</span>
                    </div>
                    <p className="text-[0.8rem] text-foreground/85 whitespace-pre-wrap break-words leading-relaxed pl-4 border-l-2 border-border/20">
                      {msg.message}
                    </p>
                  </div>
                );
              }

              return (
                <div key={thread.id} className="hover:bg-foreground/[0.01] transition-colors">
                  {/* Thread header */}
                  <button
                    onClick={() => setExpandedThread(isExpanded ? null : thread.id)}
                    className="w-full px-4 py-2.5 text-left flex items-center gap-2"
                  >
                    <GitBranch size={13} className="text-primary/50 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.8rem] font-medium text-foreground truncate">
                          {otherParticipants.join(', ') || 'self'}
                        </span>
                        <span className="text-[0.55rem] text-primary/40 font-mono bg-primary/5 rounded px-1">
                          #{thread.id.slice(0, 8)}
                        </span>
                        <span className="text-[0.625rem] text-muted-foreground/40 font-mono bg-muted/30 rounded px-1">
                          {thread.messages.length} msgs
                        </span>
                      </div>
                      <p className="text-[0.733rem] text-muted-foreground/60 truncate mt-0.5">
                        {preview.message.slice(0, 100)}{preview.message.length > 100 ? '...' : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[0.6rem] text-muted-foreground/30 font-mono">{shortTime(thread.lastTime)}</p>
                      <span className={`text-[0.6rem] ${isExpanded ? 'text-primary' : 'text-muted-foreground/30'}`}>
                        {isExpanded ? '\u25B2' : '\u25BC'}
                      </span>
                    </div>
                  </button>

                  {/* Expanded thread messages */}
                  {isExpanded && (
                    <div className="pb-2 px-4 ml-4 border-l-2 border-primary/15 space-y-1.5">
                      {thread.messages.map((msg) => {
                        const isOutgoing = msg.from_agent === agentName;
                        return (
                          <div key={msg.id} className="pl-3 py-1.5">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={`inline-block size-1.5 rounded-full ${isOutgoing ? 'bg-green/60' : 'bg-info/60'}`} />
                              <span className="text-[0.667rem] font-mono text-foreground/60">{msg.from_agent}</span>
                              <ArrowRight size={8} className="text-muted-foreground/25" />
                              <span className="text-[0.667rem] font-mono text-foreground/60">{msg.to_agent}</span>
                              <span className="ml-auto text-[0.55rem] text-muted-foreground/25 font-mono">{shortTime(msg.created_at)}</span>
                            </div>
                            <p className={`text-[0.773rem] whitespace-pre-wrap break-words leading-relaxed ${isOutgoing ? 'text-foreground/75' : 'text-foreground/85'}`}>
                              {msg.message}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-2 border-t border-border/30 flex justify-between items-center">
        <span className="text-[0.625rem] text-muted-foreground/40">
          {filtered.length} message{filtered.length !== 1 ? 's' : ''}
          {viewMode === 'threads' && ` \u00B7 ${threads.length} thread${threads.length !== 1 ? 's' : ''}`}
          {(searchQuery || partnerFilter !== 'all') && ` (filtered from ${messages.length})`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const text = filtered.map((m) =>
                "[" + new Date(m.created_at).toLocaleString() + "] " + m.from_agent + " -> " + m.to_agent + ":\n" + m.message
              ).join("\n\n---\n\n");
              const blob = new Blob([text], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = agentName + "-messages.txt";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-[0.667rem] text-muted-foreground/40 hover:text-muted-foreground transition-colors flex items-center gap-1"
            title="Export as text"
          >
            <Download size={11} />
            Export
          </button>
          <button onClick={loadMessages} className="text-[0.667rem] text-primary hover:text-primary/80 transition-colors">Refresh</button>
        </div>
      </div>
    </div>
  );
}

// ── Communication Partners ──────────────────────────────────────

interface CommPartner {
  name: string;
  sent: number;
  received: number;
  lastMessage: string;
}

function useCommPartners(agentName: string, messages: FarmMessage[]): CommPartner[] {
  return useMemo(() => {
    const map = new Map<string, CommPartner>();
    for (const msg of messages) {
      if (!msg.from || !msg.to) continue;
      if (msg.from !== agentName && msg.to !== agentName) continue;
      const partner = msg.from === agentName ? msg.to : msg.from;
      if (partner.startsWith('tg-')) continue;
      if (!map.has(partner)) {
        map.set(partner, { name: partner, sent: 0, received: 0, lastMessage: msg.timestamp });
      }
      const p = map.get(partner)!;
      if (msg.from === agentName) p.sent++;
      else p.received++;
      if (msg.timestamp > p.lastMessage) p.lastMessage = msg.timestamp;
    }
    return [...map.values()].sort((a, b) => (a.sent + a.received) > (b.sent + b.received) ? -1 : 1);
  }, [agentName, messages]);
}

// ── Component ───────────────────────────────────────────────────

export function AgentDetailPanel({ agent, messages, onClose }: AgentDetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>('info');
  const cfg = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.offline;

  const agentMessages = useMemo(
    () => messages.filter((m) => m.to === agent.name || m.from === agent.name),
    [agent.name, messages],
  );

  const commPartners = useCommPartners(agent.name, messages);
  const pendingCount = agentMessages.filter((m) => m.to === agent.name && m.status === 'pending').length;
  const sentCount = agentMessages.filter((m) => m.from === agent.name).length;
  const receivedCount = agentMessages.filter((m) => m.to === agent.name).length;

  const tabs: { key: DetailTab; label: string; Icon: typeof User }[] = [
    { key: 'info', label: 'Info', Icon: User },
    { key: 'messages', label: 'Messages', Icon: MessageSquare },
    { key: 'files', label: 'Files', Icon: FolderOpen },
  ];

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg z-50 flex flex-col bg-background border-l border-border shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-border/40">
        <div className={`shrink-0 flex items-center justify-center size-12 rounded-xl ${cfg.bg} border text-lg font-bold ${cfg.color}`}>
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground truncate">{agent.name}</h2>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.color}`}>
              <span className={`inline-block size-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
          <p className="text-[0.8rem] text-muted-foreground truncate">{agent.role || 'No role specified'}</p>
          {agent.type && (<span className="text-[0.55rem] text-muted-foreground/30 border border-border/20 rounded px-1.5 py-0.5 uppercase tracking-wider font-mono">{agent.type}</span>)}
        </div>
        <button onClick={onClose} className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex items-center gap-1 px-5 py-2 border-b border-border/30">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[0.733rem] font-medium transition-colors ${
              tab === t.key ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-foreground/5'
            }`}
          >
            <t.Icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === 'info' && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Pending', value: pendingCount, Icon: Clock, color: 'text-orange' },
                { label: 'Received', value: receivedCount, Icon: Mail, color: 'text-info' },
                { label: 'Sent', value: sentCount, Icon: Activity, color: 'text-green' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-border/40 bg-card/50 p-3 text-center">
                  <stat.Icon size={14} className={`${stat.color} mx-auto mb-1 opacity-60`} />
                  <p className={`text-xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
                  <p className="text-[0.625rem] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-border/30 bg-card/30 px-4 py-3">
              <p className="text-[0.667rem] uppercase tracking-widest text-muted-foreground/50 mb-1">Last seen</p>
              <p className="text-sm text-foreground font-mono">{fullTimestamp(agent.last_seen)}</p>
              <p className="text-[0.733rem] text-muted-foreground">{relativeTime(agent.last_seen)}</p>
            </div>
            {commPartners.length > 0 && (
              <div>
                <p className="text-[0.667rem] uppercase tracking-widest text-muted-foreground/50 mb-2">Communication partners</p>
                <div className="space-y-1.5">
                  {commPartners.map((p) => (
                    <div key={p.name} className="flex items-center gap-3 rounded-lg border border-border/30 bg-card/30 px-3 py-2">
                      <div className="shrink-0 flex items-center justify-center size-8 rounded-full bg-foreground/5 text-sm font-bold text-foreground/70">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground">{p.name}</span>
                        <div className="flex items-center gap-3 text-[0.667rem] text-muted-foreground">
                          <span>{p.sent} sent</span>
                          <span>{p.received} received</span>
                        </div>
                      </div>
                      <span className="text-[0.625rem] text-muted-foreground/40 font-mono shrink-0">{relativeTime(p.lastMessage)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'messages' && (
          <AgentMessagesTab agentName={agent.name} />
        )}

        {tab === 'files' && (
          <AgentFilesTab agentName={agent.name} />
        )}
      </div>
    </div>
  );
}
