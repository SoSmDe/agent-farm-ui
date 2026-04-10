/**
 * OrgChart — Interactive network graph of agents with draggable nodes.
 *
 * Features:
 * - Draggable agent nodes (positions saved in localStorage)
 * - Communication edges with gradient colors and message counts
 * - Status indicators, pending badges, hover tooltips
 * - Reset layout button
 */

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { agentColor, agentEmoji } from "./useFarmData";
import type { FarmAgent, FarmMessage } from "./useFarmData";

// ── Types ────────────────────────────────────────────────────────────

interface OrgChartProps {
  agents: FarmAgent[];
  messages: FarmMessage[];
  onSelectAgent?: (agent: FarmAgent) => void;
  selectedAgentName?: string | null;
  onSelectEdge?: (agentA: string, agentB: string) => void;
}

interface Edge {
  from: string;
  to: string;
  total: number;
}

interface Pos {
  x: number;
  y: number;
}

// ── Status colors ───────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { fill: string; stroke: string; glow: string }> = {
  idle: { fill: "#7fc782", stroke: "#5da861", glow: "rgba(127,199,130,0.3)" },
  busy: { fill: "#e79a59", stroke: "#c97e3d", glow: "rgba(231,154,89,0.3)" },
  offline: { fill: "#888", stroke: "#666", glow: "rgba(136,136,136,0.15)" },
};

// ── Layout types ────────────────────────────────────────────────────

type LayoutType = "circular" | "tree" | "grid";

const STORAGE_KEY = "agent-farm-org-positions";
const LAYOUT_KEY = "agent-farm-org-layout";

function defaultCircularLayout(names: string[], cx: number, cy: number, radius: number): Map<string, Pos> {
  const map = new Map<string, Pos>();
  names.forEach((name, i) => {
    const angle = (2 * Math.PI * i) / names.length - Math.PI / 2;
    map.set(name, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  });
  return map;
}

function treeLayout(names: string[], W: number, H: number, messages?: FarmMessage[]): Map<string, Pos> {
  const map = new Map<string, Pos>();
  if (names.length === 0) return map;

  // Find root: agent with most total messages (hub of communication)
  let sortedNames = [...names];
  if (messages && messages.length > 0) {
    const msgCount = new Map<string, number>();
    for (const msg of messages) {
      if (!msg.from || !msg.to) continue;
      msgCount.set(msg.from, (msgCount.get(msg.from) ?? 0) + 1);
      msgCount.set(msg.to, (msgCount.get(msg.to) ?? 0) + 1);
    }
    sortedNames.sort((a, b) => (msgCount.get(b) ?? 0) - (msgCount.get(a) ?? 0));
  }

  const root = sortedNames[0];
  map.set(root, { x: W / 2, y: 70 });

  const children = sortedNames.slice(1);
  if (children.length === 0) return map;

  // Single row if ≤4, two rows otherwise
  const perRow = children.length <= 4 ? children.length : Math.ceil(children.length / 2);
  const rows = Math.ceil(children.length / perRow);
  const rowHeight = Math.min(140, (H - 140) / rows);
  const colSpacing = Math.min(180, (W - 80) / perRow);

  children.forEach((name, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const rowCount = Math.min(perRow, children.length - row * perRow);
    const startX = W / 2 - ((rowCount - 1) * colSpacing) / 2;
    map.set(name, {
      x: startX + col * colSpacing,
      y: 160 + row * rowHeight,
    });
  });
  return map;
}

function gridLayout(names: string[], W: number, H: number): Map<string, Pos> {
  const map = new Map<string, Pos>();
  if (names.length === 0) return map;

  const cols = Math.ceil(Math.sqrt(names.length));
  const rows = Math.ceil(names.length / cols);
  const cellW = W / (cols + 1);
  const cellH = H / (rows + 1);

  names.forEach((name, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    map.set(name, {
      x: cellW + col * cellW,
      y: cellH + row * cellH,
    });
  });
  return map;
}

function getDefaultLayout(type: LayoutType, names: string[], W: number, H: number, radius: number, messages?: FarmMessage[]): Map<string, Pos> {
  switch (type) {
    case "tree": return treeLayout(names, W, H, messages);
    case "grid": return gridLayout(names, W, H);
    default: return defaultCircularLayout(names, W / 2, H / 2, radius);
  }
}

function loadSavedPositions(): Record<string, Pos> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePositions(positions: Record<string, Pos>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch { /* ignore */ }
}

// ── Component ───────────────────────────────────────────────────────

export function OrgChart({ agents, messages, onSelectAgent, selectedAgentName, onSelectEdge }: OrgChartProps) {
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [dragAgent, setDragAgent] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Pos>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [layoutType, setLayoutType] = useState<LayoutType>(() => {
    try { return (localStorage.getItem(LAYOUT_KEY) as LayoutType) || "circular"; } catch { return "circular"; }
  });
  const svgRef = useRef<SVGSVGElement>(null);

  // Zoom with scroll wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      return Math.max(0.4, Math.min(2.5, prev * delta));
    });
  }, []);

  const W = 800;
  const H = 560;
  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(W, H) * 0.33;
  const NODE_R = 36;

  // Initialize positions: saved positions + defaults for new agents
  const [positions, setPositions] = useState<Map<string, Pos>>(() => {
    const saved = loadSavedPositions();
    const defaults = getDefaultLayout(layoutType, agents.map((a) => a.name), W, H, radius, messages);
    const merged = new Map<string, Pos>();
    for (const agent of agents) {
      if (saved[agent.name]) {
        merged.set(agent.name, saved[agent.name]);
      } else {
        merged.set(agent.name, defaults.get(agent.name) ?? { x: cx, y: cy });
      }
    }
    return merged;
  });

  // Update positions when agents change
  useEffect(() => {
    setPositions((prev) => {
      const defaults = getDefaultLayout(layoutType, agents.map((a) => a.name), W, H, radius, messages);
      const next = new Map(prev);
      let changed = false;
      for (const agent of agents) {
        if (!next.has(agent.name)) {
          next.set(agent.name, defaults.get(agent.name) ?? { x: cx, y: cy });
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [agents, layoutType, cx, cy, radius, W, H]);

  // Switch layout
  const switchLayout = useCallback((type: LayoutType) => {
    setLayoutType(type);
    localStorage.setItem(LAYOUT_KEY, type);
    const newPositions = getDefaultLayout(type, agents.map((a) => a.name), W, H, radius, messages);
    setPositions(newPositions);
    localStorage.removeItem(STORAGE_KEY);
  }, [agents, W, H, radius]);

  // Build edges
  const edges = useMemo(() => {
    const map = new Map<string, number>();
    for (const msg of messages) {
      if (!msg.from || !msg.to || msg.from.startsWith("tg-") || msg.to.startsWith("tg-")) continue;
      const key = [msg.from, msg.to].sort().join("::");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const result: Edge[] = [];
    for (const [key, total] of map) {
      const [from, to] = key.split("::");
      result.push({ from, to, total });
    }
    return result;
  }, [messages]);

  // Per-agent stats
  const agentStats = useMemo(() => {
    const stats = new Map<string, { sent: number; received: number; pending: number }>();
    for (const msg of messages) {
      if (!msg.from || !msg.to) continue;
      if (!stats.has(msg.from)) stats.set(msg.from, { sent: 0, received: 0, pending: 0 });
      if (!stats.has(msg.to)) stats.set(msg.to, { sent: 0, received: 0, pending: 0 });
      stats.get(msg.from)!.sent++;
      stats.get(msg.to)!.received++;
      if (msg.status === "pending") stats.get(msg.to)!.pending++;
    }
    return stats;
  }, [messages]);

  const maxEdgeCount = Math.max(1, ...edges.map((e) => e.total));

  // Last message per agent (for tooltip)
  const lastMsgMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const msg of messages) {
      if (!msg.from || !msg.to) continue;
      for (const name of [msg.from, msg.to]) {
        if (!map.has(name) && msg.content) {
          const text = msg.content.length > 50 ? msg.content.slice(0, 47) + "..." : msg.content;
          map.set(name, text);
        }
      }
    }
    return map;
  }, [messages]);

  // ── Drag handlers ─────────────────────────────────────────────────

  const svgPoint = useCallback((clientX: number, clientY: number): Pos => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent, agentName: string) => {
    e.preventDefault();
    e.stopPropagation();
    const svgPos = svgPoint(e.clientX, e.clientY);
    const agentPos = positions.get(agentName) ?? { x: cx, y: cy };
    setDragOffset({ x: svgPos.x - agentPos.x, y: svgPos.y - agentPos.y });
    setDragAgent(agentName);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [positions, svgPoint, cx, cy]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragAgent) return;
    e.preventDefault();
    const svgPos = svgPoint(e.clientX, e.clientY);
    const newX = Math.max(NODE_R, Math.min(W - NODE_R, svgPos.x - dragOffset.x));
    const newY = Math.max(NODE_R, Math.min(H - NODE_R, svgPos.y - dragOffset.y));
    setPositions((prev) => {
      const next = new Map(prev);
      next.set(dragAgent, { x: newX, y: newY });
      return next;
    });
  }, [dragAgent, dragOffset, svgPoint, W, H, NODE_R]);

  const handlePointerUp = useCallback(() => {
    if (dragAgent) {
      // Save to localStorage
      const posObj: Record<string, Pos> = {};
      positions.forEach((pos, name) => { posObj[name] = pos; });
      savePositions(posObj);
    }
    setDragAgent(null);
  }, [dragAgent, positions]);

  const resetLayout = useCallback(() => {
    const defaults = getDefaultLayout(layoutType, agents.map((a) => a.name), W, H, radius, messages);
    setPositions(defaults);
    localStorage.removeItem(STORAGE_KEY);
  }, [agents, layoutType, W, H, radius]);

  if (agents.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/50 gap-3">
        <svg viewBox="0 0 64 64" width="48" height="48" className="opacity-20">
          <circle cx="32" cy="20" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="16" cy="48" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="48" cy="48" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="32" y1="28" x2="16" y2="42" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
          <line x1="32" y1="28" x2="48" y2="42" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        </svg>
        <div className="text-center">
          <p className="text-[0.8rem] font-medium">No agents registered</p>
          <p className="text-[0.667rem] text-muted-foreground/30 mt-1">Agents will appear here when they connect to the bus</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 gap-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 self-end flex-wrap">
        {/* Layout switcher */}
        <div className="flex items-center rounded-md border border-border/30 overflow-hidden">
          {([
            { type: "circular" as const, label: "Circle" },
            { type: "tree" as const, label: "Tree" },
            { type: "grid" as const, label: "Grid" },
          ]).map(({ type, label }) => (
            <button key={type} onClick={() => switchLayout(type)}
              className={`px-2.5 py-1 text-[0.667rem] font-medium transition-colors ${layoutType === type ? "bg-foreground/10 text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
            >{label}</button>
          ))}
        </div>
        <span className="text-[0.55rem] text-muted-foreground/25 uppercase tracking-widest hidden lg:inline">
          Drag | Zoom | Click edges
        </span>
        <div className="flex items-center gap-1 border border-border/30 rounded-md overflow-hidden">
          <button onClick={() => setZoom((z) => Math.max(0.4, z * 0.8))}
            className="text-[0.733rem] text-muted-foreground/50 hover:text-foreground px-2 py-1 hover:bg-foreground/5 transition-colors">-</button>
          <span className="text-[0.6rem] text-muted-foreground/40 font-mono px-1 min-w-[32px] text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2.5, z * 1.2))}
            className="text-[0.733rem] text-muted-foreground/50 hover:text-foreground px-2 py-1 hover:bg-foreground/5 transition-colors">+</button>
        </div>
        <button onClick={() => setZoom(1)}
          className="text-[0.667rem] text-muted-foreground/50 hover:text-foreground px-2 py-1 rounded border border-border/30 hover:border-border/60 transition-colors">
          Fit
        </button>
        <button
          onClick={resetLayout}
          className="text-[0.667rem] text-muted-foreground/50 hover:text-foreground px-2 py-1 rounded border border-border/30 hover:border-border/60 transition-colors"
        >
          Reset
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`${cx - (W / 2) / zoom} ${cy - (H / 2) / zoom} ${W / zoom} ${H / zoom}`}
        className="w-full max-w-[800px] h-auto select-none"
        style={{ filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.12))", cursor: dragAgent ? "grabbing" : "default" }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={() => setZoom(1)}
      >
        <defs>
          {edges.map((edge) => {
            const fromColor = STATUS_COLORS[agents.find((a) => a.name === edge.from)?.status ?? "offline"]?.fill ?? "#888";
            const toColor = STATUS_COLORS[agents.find((a) => a.name === edge.to)?.status ?? "offline"]?.fill ?? "#888";
            return (
              <linearGradient key={`grad-${edge.from}-${edge.to}`} id={`grad-${edge.from}-${edge.to}`}>
                <stop offset="0%" stopColor={fromColor} stopOpacity={0.6} />
                <stop offset="100%" stopColor={toColor} stopOpacity={0.6} />
              </linearGradient>
            );
          })}
        </defs>

        {/* Edges */}
        {edges.map((edge) => {
          const fromPos = positions.get(edge.from);
          const toPos = positions.get(edge.to);
          if (!fromPos || !toPos) return null;

          const isHighlighted =
            hoveredAgent === edge.from || hoveredAgent === edge.to ||
            selectedAgentName === edge.from || selectedAgentName === edge.to;

          const strokeWidth = 1.5 + (edge.total / maxEdgeCount) * 4;
          const opacity = isHighlighted ? 0.8 : 0.25;

          const midX = (fromPos.x + toPos.x) / 2;
          const midY = (fromPos.y + toPos.y) / 2;
          const dx = toPos.x - fromPos.x;
          const dy = toPos.y - fromPos.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const curvature = 25;
          const ctrlX = midX + (dy / len) * curvature;
          const ctrlY = midY - (dx / len) * curvature;

          return (
            <g key={`${edge.from}-${edge.to}`} className="cursor-pointer" onClick={() => onSelectEdge?.(edge.from, edge.to)}>
              {/* Hit area (wider invisible path for easier clicking) */}
              <path
                d={`M ${fromPos.x} ${fromPos.y} Q ${ctrlX} ${ctrlY} ${toPos.x} ${toPos.y}`}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(strokeWidth + 10, 14)}
              />
              <path
                d={`M ${fromPos.x} ${fromPos.y} Q ${ctrlX} ${ctrlY} ${toPos.x} ${toPos.y}`}
                fill="none"
                stroke={`url(#grad-${edge.from}-${edge.to})`}
                strokeWidth={strokeWidth}
                opacity={opacity}
                strokeLinecap="round"
              />
              {/* Flow particles on highlighted edges */}
              {isHighlighted && edge.total > 0 && (
                <>
                  {[0, 0.33, 0.66].map((offset, pi) => (
                    <circle key={pi} r={2.5} fill={`url(#grad-${edge.from}-${edge.to})`} opacity={0.7}>
                      <animateMotion
                        dur={`${2 + pi * 0.5}s`}
                        begin={`${offset * 2}s`}
                        repeatCount="indefinite"
                        path={`M ${fromPos.x} ${fromPos.y} Q ${ctrlX} ${ctrlY} ${toPos.x} ${toPos.y}`}
                      />
                    </circle>
                  ))}
                </>
              )}
              {/* Edge count badge */}
              {(isHighlighted || edge.total >= 3) && (
                <g>
                  <rect
                    x={ctrlX - 16} y={ctrlY - 9}
                    width={32} height={18} rx={9}
                    fill="var(--background)"
                    stroke="currentColor" className="text-border"
                    strokeWidth={0.5}
                    opacity={isHighlighted ? 1 : 0.6}
                  />
                  <text
                    x={ctrlX} y={ctrlY + 1}
                    textAnchor="middle" dominantBaseline="central"
                    className="fill-muted-foreground" fontSize={9} fontFamily="monospace"
                    opacity={isHighlighted ? 1 : 0.6}
                  >
                    {edge.total}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Agent nodes */}
        {agents.map((agent) => {
          const pos = positions.get(agent.name);
          if (!pos) return null;

          const isSelected = selectedAgentName === agent.name;
          const isHovered = hoveredAgent === agent.name;
          const isDragging = dragAgent === agent.name;
          const colors = STATUS_COLORS[agent.status] ?? STATUS_COLORS.offline;
          const stats = agentStats.get(agent.name);
          const nodeR = isDragging ? NODE_R + 3 : isSelected ? NODE_R + 4 : isHovered ? NODE_R + 2 : NODE_R;

          return (
            <g
              key={agent.id}
              style={{ cursor: isDragging ? "grabbing" : "grab" }}
              onPointerDown={(e) => handlePointerDown(e, agent.name)}
              onClick={(e) => {
                // Only fire click if we didn't drag
                if (!isDragging) onSelectAgent?.(agent);
              }}
              onMouseEnter={() => { if (!dragAgent) setHoveredAgent(agent.name); }}
              onMouseLeave={() => setHoveredAgent(null)}
            >
              {/* Selection ring */}
              {isSelected && (
                <circle cx={pos.x} cy={pos.y} r={nodeR + 8}
                  fill="none" stroke={colors.fill} strokeWidth={2}
                  opacity={0.4} strokeDasharray="6 4"
                >
                  <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${pos.x} ${pos.y}`} to={`360 ${pos.x} ${pos.y}`}
                    dur="10s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Glow */}
              <circle cx={pos.x} cy={pos.y} r={nodeR + 2}
                fill={colors.glow}
                opacity={isDragging ? 0.7 : isHovered || isSelected ? 0.5 : 0.2} />

              {/* Main circle */}
              <circle cx={pos.x} cy={pos.y} r={nodeR}
                fill="var(--background)" stroke={colors.stroke}
                strokeWidth={isDragging ? 3.5 : isSelected ? 3 : isHovered ? 2.5 : 2}
                opacity={agent.status === "offline" ? 0.5 : 1} />

              {/* Identity color ring */}
              <circle cx={pos.x} cy={pos.y} r={nodeR - 4}
                fill="none" stroke={agentColor(agent.name)} strokeWidth={1.5} opacity={0.25} />

              {/* Emoji + Monogram */}
              <text x={pos.x} y={pos.y - 10}
                textAnchor="middle" dominantBaseline="central"
                className="select-none pointer-events-none"
                fontSize={12}
              >
                {agentEmoji(agent.role)}
              </text>
              <text x={pos.x} y={pos.y + 6}
                textAnchor="middle" dominantBaseline="central"
                className="fill-foreground/70 font-medium select-none pointer-events-none"
                fontSize={10}
              >
                {agent.name}
              </text>

              {/* Name */}


              {/* Role below */}
              <text x={pos.x} y={pos.y + nodeR + 14}
                textAnchor="middle"
                className="fill-muted-foreground/60 select-none pointer-events-none"
                fontSize={9} fontStyle="italic"
              >
                {agent.role || "agent"}
              </text>

              {/* Status dot */}
              <circle cx={pos.x + nodeR * 0.65} cy={pos.y - nodeR * 0.65} r={5}
                fill={colors.fill} stroke="var(--background)" strokeWidth={2}
              >
                {agent.status === "busy" && (
                  <animate attributeName="r" values="5;7;5" dur="1.5s" repeatCount="indefinite" />
                )}
              </circle>

              {/* Pending badge */}
              {stats && stats.pending > 0 && (
                <g>
                  <circle cx={pos.x - nodeR * 0.65} cy={pos.y - nodeR * 0.65} r={9}
                    fill="#e74c3c" stroke="var(--background)" strokeWidth={2} />
                  <text x={pos.x - nodeR * 0.65} y={pos.y - nodeR * 0.65 + 1}
                    textAnchor="middle" dominantBaseline="central"
                    fill="white" fontSize={8} fontWeight="bold"
                    className="select-none pointer-events-none"
                  >
                    {stats.pending}
                  </text>
                </g>
              )}

              {/* Rich hover tooltip */}
              {isHovered && !isDragging && (
                <g>
                  {(() => {
                    const tooltipW = 160;
                    const tooltipH = stats ? 52 : 30;
                    const tx = pos.x - tooltipW / 2;
                    const ty = pos.y + nodeR + 20;
                    const lastMsg = lastMsgMap.get(agent.name);
                    return (
                      <>
                        <rect x={tx} y={ty} width={tooltipW} height={lastMsg ? tooltipH + 16 : tooltipH}
                          rx={8} fill="var(--background)" stroke="currentColor"
                          className="text-border" strokeWidth={0.5}
                          style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.15))" }} />
                        {/* Stats line */}
                        {stats && (
                          <text x={pos.x} y={ty + 14} textAnchor="middle"
                            className="fill-muted-foreground" fontSize={8} fontFamily="monospace">
                            {"\u2191"}{stats.sent} sent {"\u00B7"} {"\u2193"}{stats.received} recv
                            {stats.pending > 0 && ` \u00B7 ${stats.pending} pending`}
                          </text>
                        )}
                        {/* Role */}
                        <text x={pos.x} y={ty + (stats ? 30 : 14)} textAnchor="middle"
                          className="fill-muted-foreground/60" fontSize={8}>
                          {agent.role || "agent"}
                        </text>
                        {/* Last message */}
                        {lastMsg && (
                          <text x={pos.x} y={ty + (stats ? 44 : 28)} textAnchor="middle"
                            className="fill-foreground/50" fontSize={7} fontStyle="italic">
                            {lastMsg}
                          </text>
                        )}
                      </>
                    );
                  })()}
                </g>
              )}
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(16, ${H - 60})`}>
          {[
            { status: "idle", label: "Ready" },
            { status: "busy", label: "Working" },
            { status: "offline", label: "Offline" },
          ].map((item, i) => (
            <g key={item.status} transform={`translate(0, ${i * 16})`}>
              <circle cx={6} cy={0} r={4} fill={STATUS_COLORS[item.status].fill} />
              <text x={16} y={1} dominantBaseline="central" className="fill-muted-foreground/60" fontSize={9}>
                {item.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
