"use client";
import { useEffect, useState } from "react";
import { getStats } from "@/lib/api";
import { usePeriod } from "@/lib/PeriodContext";

interface KpiData {
  total_incidents: number;
  total_crawled: number;
  pending_profiling: number;
  complete_profiling: number;
  top_region: { name: string; count: number };
  top_category: { name: string; count: number };
  avg_threat_level: number;
  escalation_pct: number;
  escalation_dir: "up" | "down" | "neutral";
}

function KpiCard({
  label, value, sub, color = "#e2e8f0", accent = "#c41e3a", icon,
}: {
  label: string; value: string | number; sub?: string;
  color?: string; accent?: string; icon: string;
}) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderTop: `2px solid ${accent}`, borderRadius: 6,
      padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4,
      boxShadow: "var(--shadow-card)", transition: "border-color 0.2s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: ".14em" }}>
          {label}
        </span>
        <span style={{ fontSize: 16 }}>{icon}</span>
      </div>
      <div 
        title={String(value)}
        style={{ 
          fontFamily: "var(--font-mono)", 
          fontSize: typeof value === 'string' && value.length > 12 ? 18 : 26, 
          fontWeight: 700, 
          color, 
          lineHeight: 1.2, 
          marginTop: 4,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function threatLevelColor(level: number) {
  if (level >= 4) return "#f87171";
  if (level >= 3) return "#fb923c";
  if (level >= 2) return "#fbbf24";
  return "#a3e635";
}

export default function KpiCards() {
  const { period, periodLabel } = usePeriod();
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    try {
      setError(false);
      setData(await getStats(period));
    } catch (e) {
      console.error(e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  if (loading) {
    return (
      <div className="kpi-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 6, padding: "14px 16px", height: 90,
            animation: "pulse 1.5s ease-in-out infinite", opacity: 1 - i * 0.15,
          }} />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="kpi-grid">
        <div style={{
          gridColumn: "1 / -1",
          fontFamily: "var(--font-mono)", fontSize: 11,
          color: "#f87171", textAlign: "center", padding: "20px 0",
        }}>
          ⚠ Gagal memuat data — pastikan backend berjalan di port 8000
        </div>
      </div>
    );
  }

  const topRegion = data.top_region ?? { name: "—", count: 0 };
  const topCategory = data.top_category ?? { name: "—", count: 0 };

  const escalationColor = data.escalation_dir === "up" ? "#f87171" : data.escalation_dir === "down" ? "#34d399" : "#7a8899";
  const escalationAccent = data.escalation_dir === "up" ? "#c41e3a" : data.escalation_dir === "down" ? "#10b981" : "#1a2236";
  const escalationIcon = data.escalation_dir === "up" ? "↑" : data.escalation_dir === "down" ? "↓" : "→";
  const escalationLabel = data.escalation_dir === "up" ? "Situasi memburuk" : data.escalation_dir === "down" ? "Situasi mereda" : "Stabil";

  return (
    <div className="kpi-grid">
      <KpiCard
        label="TOTAL INSIDEN"
        value={data.total_incidents}
        sub={`${periodLabel} — ${data.total_crawled} crawled`}
        color="#f87171"
        accent="#c41e3a"
        icon="🚨"
      />
      <KpiCard
        label="WILAYAH TERPARAH"
        value={topRegion.name}
        sub={`${topRegion.count} insiden terdeteksi`}
        color="#fbbf24"
        accent="#f59e0b"
        icon="📍"
      />
      <KpiCard
        label="KATEGORI DOMINAN"
        value={topCategory.name}
        sub={`${topCategory.count} insiden`}
        color="#c084fc"
        accent="#8b5cf6"
        icon="🏷"
      />
      <KpiCard
        label="ESKALASI VS KEMARIN"
        value={`${escalationIcon} ${Math.abs(data.escalation_pct)}%`}
        sub={escalationLabel}
        color={escalationColor}
        accent={escalationAccent}
        icon="📈"
      />
    </div>
  );
}
