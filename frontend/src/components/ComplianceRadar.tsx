"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface RadarScores {
  [key: string]: number;
}

interface ComplianceRadarProps {
  scores: RadarScores;
}

const LABEL_MAP: Record<string, string> = {
  clarity: "Clarity",
  enforceability: "Enforceability",
  completeness: "Completeness",
  risk_coverage: "Risk Coverage",
  jurisdiction_compliance: "Jurisdiction",
  party_protection: "Party Protection",
};

function getColor(value: number): string {
  if (value >= 70) return "#22c55e";
  if (value >= 40) return "#f59e0b";
  return "#ef4444";
}

// Custom tooltip
const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { subject: string; score: number } }[];
}) => {
  if (active && payload && payload.length) {
    const { subject, score } = payload[0].payload;
    return (
      <div
        style={{
          background: "rgba(18,18,26,0.95)",
          border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: 10,
          padding: "8px 14px",
          fontSize: "0.82rem",
          color: "#e2e8f0",
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>{subject}</p>
        <p style={{ margin: 0, color: getColor(score) }}>{score}/100</p>
      </div>
    );
  }
  return null;
};

export default function ComplianceRadar({ scores }: ComplianceRadarProps) {
  const data = Object.entries(scores).map(([key, value]) => ({
    subject: LABEL_MAP[key] ?? key.replace(/_/g, " "),
    score: value,
    fullMark: 100,
  }));

  if (data.length === 0) return null;

  // Average score for summary
  const avg = Math.round(data.reduce((s, d) => s + d.score, 0) / data.length);
  const avgColor = getColor(avg);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {/* Average badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: "0.78rem", color: "var(--color-lexai-text-muted)" }}>
          Compliance Score:
        </span>
        <span
          style={{
            fontSize: "1.4rem",
            fontWeight: 800,
            color: avgColor,
            lineHeight: 1,
          }}
        >
          {avg}
        </span>
        <span style={{ fontSize: "0.72rem", color: "var(--color-lexai-text-muted)" }}>/100</span>
      </div>

      {/* Recharts radar */}
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid
            stroke="rgba(99,102,241,0.15)"
            gridType="polygon"
          />
          <PolarAngleAxis
            dataKey="subject"
            tick={{
              fill: "var(--color-lexai-text-muted)",
              fontSize: 11,
              fontFamily: "inherit",
            }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "rgba(148,163,184,0.4)", fontSize: 9 }}
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.2}
            strokeWidth={2}
            dot={{ fill: "#818cf8", r: 4, strokeWidth: 0 }}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>

      {/* Score pills */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
          marginTop: 4,
        }}
      >
        {data.map((d) => (
          <div
            key={d.subject}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 10px",
              borderRadius: 999,
              border: `1px solid ${getColor(d.score)}40`,
              background: `${getColor(d.score)}10`,
              fontSize: "0.72rem",
            }}
          >
            <span style={{ color: "var(--color-lexai-text-muted)" }}>{d.subject}</span>
            <span style={{ fontWeight: 700, color: getColor(d.score) }}>{d.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
