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

// ── Layout ──────────────────────────────────────────────────────────

const STORAGE_KEY = "agent-farm-org-positions";

function defaultCircularLayout(names: string[], cx: number, cy: number, radius: number): Map<string, Pos> {
  const map = new Map<string, Pos>();
  names.forEach((name, i) => {
    const angle = (2 * Math.PI * i) / names.length - Math.PI / 2;
    map.set(name, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  });
  return map;
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
    const defaults = defaultCircularLayout(agents.map((a) => a.name), cx, cy, radius);
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

  // Update positions when agents change (new agents get default positions)
  useEffect(() => {
    setPositions((prev) => {
      const defaults = defaultCircularLayout(agents.map((a) => a.name), cx, cy, radius);
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
  }, [agents, cx, cy, radius]);

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
    const defaults = defaultCircularLayout(agents.map((a) => a.name), cx, cy, radius);
    setPositions(defaults);
    localStorage.removeItem(STORAGE_KEY);
  }, [agents, cx, cy, radius]);

  if (agents.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground/50 text-[0.733rem]">
        No agents to display
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 gap-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 self-end">
        <span className="text-[0.6rem] text-muted-foreground/30 uppercase tracking-widest">
          Drag nodes | Scroll to zoom | Click edges for conversation
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

              {/* Inner ring */}
              <circle cx={pos.x} cy={pos.y} r={nodeR - 4}
                fill="none" stroke={colors.fill} strokeWidth={0.5} opacity={0.3} />

              {/* Monogram */}
              <text x={pos.x} y={pos.y - 6}
                textAnchor="middle" dominantBaseline="central"
                className="fill-foreground font-bold select-none pointer-events-none"
                fontSize={isSelected ? 22 : 20}
              >
                {agent.name.charAt(0).toUpperCase()}
              </text>

              {/* Name */}
              <text x={pos.x} y={pos.y + 10}
                textAnchor="middle"
                className="fill-foreground/70 font-medium select-none pointer-events-none"
                fontSize={9}
              >
                {agent.name}
              </text>

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

              {/* Hover tooltip */}
              {isHovered && !isDragging && stats && (
                <g>
                  <rect x={pos.x - 45} y={pos.y + nodeR + 24}
                    width={90} height={22} rx={6}
                    fill="var(--background)" stroke="currentColor"
                    className="text-border" strokeWidth={0.5} />
                  <text x={pos.x} y={pos.y + nodeR + 37}
                    textAnchor="middle" className="fill-muted-foreground"
                    fontSize={8} fontFamily="monospace"
                  >
                    {"\u2191"}{stats.sent} {"\u2193"}{stats.received}
                  </text>
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
