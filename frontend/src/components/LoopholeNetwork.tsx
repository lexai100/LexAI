"use client";

import { useEffect, useRef, useMemo } from "react";

interface Vulnerability {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  category?: string;
  description?: string;
}

interface LoopholeNetworkProps {
  vulnerabilities: Vulnerability[];
  width?: number;
  height?: number;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#f59e0b",
  low:      "#22c55e",
};

const SEVERITY_RADIUS: Record<string, number> = {
  critical: 22,
  high:     18,
  medium:   14,
  low:      11,
};

// Simple force-directed positions (no D3 needed — pure math)
function useForceLayout(
  nodes: { id: string; severity: string }[],
  w: number,
  h: number
) {
  return useMemo(() => {
    if (nodes.length === 0) return [];

    // Distribute nodes in a spiral / sunflower pattern from center
    const cx = w / 2;
    const cy = h / 2;
    const golden = Math.PI * (3 - Math.sqrt(5)); // golden angle

    return nodes.map((node, i) => {
      if (i === 0) return { ...node, x: cx, y: cy }; // center node
      const r = Math.sqrt(i / nodes.length) * Math.min(w, h) * 0.42;
      const angle = i * golden;
      return {
        ...node,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      };
    });
  }, [nodes, w, h]);
}

export default function LoopholeNetwork({
  vulnerabilities,
  width = 560,
  height = 380,
}: LoopholeNetworkProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Sort: critical first so they get prominent positions
  const sorted = useMemo(
    () =>
      [...vulnerabilities].sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
      }),
    [vulnerabilities]
  );

  // Add a center "Document" node
  const centerNode = { id: "__doc__", severity: "center", title: "Document" };
  const allNodes = [centerNode, ...sorted];
  const positions = useForceLayout(allNodes, width, height);

  // Build edges: every vuln connects to the center
  const edges = sorted.map((_, i) => ({ from: 0, to: i + 1 }));

  // Cross-edges between vulnerabilities of same category
  const crossEdges: { from: number; to: number }[] = [];
  sorted.forEach((a, i) => {
    sorted.forEach((b, j) => {
      if (j <= i) return;
      if (a.category && b.category && a.category === b.category) {
        crossEdges.push({ from: i + 1, to: j + 1 });
      }
    });
  });

  if (vulnerabilities.length === 0) {
    return (
      <div className="loophole-network-empty">
        <p>No vulnerabilities found — document appears safe ✓</p>
      </div>
    );
  }

  const docPos = positions[0];

  return (
    <div className="loophole-network-wrap">
      {/* Legend */}
      <div className="loophole-legend">
        {Object.entries(SEVERITY_COLOR).map(([sev, color]) => (
          <div key={sev} className="loophole-legend-item">
            <span className="loophole-legend-dot" style={{ background: color }} />
            <span>{sev.charAt(0).toUpperCase() + sev.slice(1)}</span>
          </div>
        ))}
      </div>

      {/* SVG network */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ maxHeight: height, display: "block" }}
        aria-label="Loophole vulnerability network graph"
      >
        <defs>
          {/* Glow filter per severity */}
          {Object.entries(SEVERITY_COLOR).map(([sev, color]) => (
            <filter key={sev} id={`glow-${sev}`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={color} floodOpacity="0.6" />
            </filter>
          ))}
          <filter id="glow-center">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#6366f1" floodOpacity="0.7" />
          </filter>

          {/* Arrowhead */}
          <marker
            id="arrow"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="rgba(99,102,241,0.4)" />
          </marker>
        </defs>

        {/* Cross-edges (same category) */}
        {crossEdges.map(({ from, to }, i) => {
          const a = positions[from];
          const b = positions[to];
          if (!a || !b) return null;
          return (
            <line
              key={`cross-${i}`}
              x1={a.x} y1={a.y}
              x2={b.x} y2={b.y}
              stroke="rgba(148,163,184,0.1)"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
          );
        })}

        {/* Main edges to center */}
        {edges.map(({ from, to }, i) => {
          const a = positions[from];
          const b = positions[to];
          if (!a || !b) return null;
          const sev = sorted[i]?.severity ?? "medium";
          const color = SEVERITY_COLOR[sev] ?? "#6366f1";
          return (
            <line
              key={`edge-${i}`}
              x1={a.x} y1={a.y}
              x2={b.x} y2={b.y}
              stroke={color}
              strokeWidth={sev === "critical" ? 1.8 : 1.2}
              strokeOpacity={sev === "critical" ? 0.5 : 0.25}
              strokeDasharray={sev === "low" ? "4 4" : undefined}
              markerEnd="url(#arrow)"
            />
          );
        })}

        {/* Center document node */}
        {docPos && (
          <g>
            <circle
              cx={docPos.x} cy={docPos.y}
              r={28}
              fill="rgba(99,102,241,0.15)"
              stroke="#6366f1"
              strokeWidth="2"
              filter="url(#glow-center)"
            />
            <text
              x={docPos.x} y={docPos.y - 4}
              textAnchor="middle"
              fontSize="11"
              fill="#a5b4fc"
              fontWeight="700"
            >
              DOC
            </text>
            <text
              x={docPos.x} y={docPos.y + 9}
              textAnchor="middle"
              fontSize="8"
              fill="rgba(165,180,252,0.6)"
            >
              {vulnerabilities.length} vulns
            </text>
          </g>
        )}

        {/* Vulnerability nodes */}
        {sorted.map((vuln, i) => {
          const pos = positions[i + 1];
          if (!pos) return null;
          const color = SEVERITY_COLOR[vuln.severity] ?? "#6366f1";
          const r = SEVERITY_RADIUS[vuln.severity] ?? 14;
          // Truncate label
          const label = vuln.title.length > 14
            ? vuln.title.slice(0, 13) + "…"
            : vuln.title;

          return (
            <g key={vuln.id}>
              {/* Outer ring for critical */}
              {vuln.severity === "critical" && (
                <circle
                  cx={pos.x} cy={pos.y}
                  r={r + 5}
                  fill="none"
                  stroke={color}
                  strokeWidth="1"
                  strokeOpacity="0.3"
                  strokeDasharray="3 3"
                />
              )}
              {/* Node */}
              <circle
                cx={pos.x} cy={pos.y}
                r={r}
                fill={`${color}20`}
                stroke={color}
                strokeWidth="1.5"
                filter={`url(#glow-${vuln.severity})`}
              />
              {/* Severity initial */}
              <text
                x={pos.x} y={pos.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={r > 16 ? "10" : "8"}
                fontWeight="700"
                fill={color}
              >
                {vuln.severity[0].toUpperCase()}
              </text>
              {/* Label below */}
              <text
                x={pos.x} y={pos.y + r + 11}
                textAnchor="middle"
                fontSize="9"
                fill="rgba(203,213,225,0.7)"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Count summary */}
      <div className="loophole-summary">
        {(["critical", "high", "medium", "low"] as const).map((sev) => {
          const count = vulnerabilities.filter((v) => v.severity === sev).length;
          if (count === 0) return null;
          return (
            <span
              key={sev}
              className="loophole-count-badge"
              style={{
                borderColor: `${SEVERITY_COLOR[sev]}40`,
                color: SEVERITY_COLOR[sev],
                background: `${SEVERITY_COLOR[sev]}10`,
              }}
            >
              {count} {sev}
            </span>
          );
        })}
      </div>
    </div>
  );
}
