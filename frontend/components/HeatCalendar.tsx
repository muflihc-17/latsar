"use client";
import { useEffect, useState } from "react";
import { getHeatCalendar } from "@/lib/api";

interface DayData {
  date: string;
  count: number;
  level: "none" | "low" | "medium" | "high" | "critical";
  label: string;
}

const levelColors: Record<string, string> = {
  none:     "#1a2236",
  low:      "#7a1222",
  medium:   "#c41e3a",
  high:     "#e8234a",
  critical: "#ff4060",
};

const levelLabels: Record<string, string> = {
  none: "0",
  low: "1-4",
  medium: "5-9",
  high: "10-14",
  critical: "15+",
};

export default function HeatCalendar() {
  const [days, setDays] = useState<DayData[]>([]);
  const [tooltip, setTooltip] = useState<{ day: DayData; x: number; y: number } | null>(null);

  const load = async () => {
    try {
      const data = await getHeatCalendar();
      setDays(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 120_000); // update tiap 2 menit
    return () => clearInterval(id);
  }, []);

  const maxCount = days.reduce((a, b) => Math.max(a, b.count), 0);

  return (
    <div className="card">
      <div className="card-title">
        🗓 Heat Calendar — 30 Hari Terakhir
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          {Object.entries(levelLabels).map(([level, label]) => (
            <span key={level} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 1, background: levelColors[level], display: "inline-block" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-muted)" }}>{label}</span>
            </span>
          ))}
        </div>
      </div>

      {days.length === 0 ? (
        <div className="heat-grid">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="heat-cell heat-none" style={{ animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <div className="heat-grid">
            {days.map((day) => (
              <div
                key={day.date}
                className={`heat-cell heat-${day.level}`}
                style={{ background: levelColors[day.level] }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({ day, x: rect.left, y: rect.top });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            ))}
          </div>

          {/* Tooltip */}
          {tooltip && (
            <div style={{
              position: "fixed",
              left: tooltip.x + 12,
              top: tooltip.y - 40,
              background: "#0b0f17",
              border: "1px solid #1a2236",
              borderRadius: 4,
              padding: "4px 10px",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "#e2e8f0",
              zIndex: 1000,
              pointerEvents: "none",
              whiteSpace: "nowrap",
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            }}>
              <div style={{ color: "var(--text-secondary)" }}>{tooltip.day.date}</div>
              <div style={{ color: tooltip.day.count > 0 ? levelColors[tooltip.day.level] : "var(--text-muted)" }}>
                {tooltip.day.count} insiden
              </div>
            </div>
          )}

          {/* Summary row */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>
              {new Date(days[0]?.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>
              Total: {days.reduce((a, b) => a + b.count, 0)} insiden · Max: {maxCount}/hari
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>
              {new Date(days[days.length - 1]?.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
