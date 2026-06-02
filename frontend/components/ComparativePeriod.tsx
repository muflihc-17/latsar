"use client";
import { useEffect, useState } from "react";
import { getCompare } from "@/lib/api";
import { usePeriod } from "@/lib/PeriodContext";

interface CompareRow {
  category: string;
  current: number;
  previous: number;
  delta: number;
  delta_pct: number;
}

export default function ComparativePeriod() {
  const { period } = usePeriod();
  const [data, setData] = useState<CompareRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const rows = await getCompare(period);
      setData(rows);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const periodLabel = period === "day" ? "Kemarin" : period === "week" ? "Minggu Lalu" : "Bulan Lalu";

  return (
    <div className="card">
      <div className="card-title">
        📊 Komparasi Periode
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>
          vs {periodLabel}
        </span>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height: 24, background: "#1a2236", borderRadius: 3, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", padding: "16px 0" }}>
          Belum cukup data untuk perbandingan
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 40px 60px", gap: 4, padding: "4px 6px", borderBottom: "1px solid #1a2236", marginBottom: 4 }}>
            {["KATEGORI", "INI", "LALU", "Δ"].map(h => (
              <span key={h} style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-muted)", letterSpacing: ".1em" }}>
                {h}
              </span>
            ))}
          </div>

          <div style={{ maxHeight: 190, overflowY: "auto" }}>
            {data.map((row) => {
              const isUp = row.delta > 0;
              const isDown = row.delta < 0;
              const deltaColor = isUp ? "#f87171" : isDown ? "#34d399" : "var(--text-muted)";
              const deltaIcon = isUp ? "↑" : isDown ? "↓" : "→";

              return (
                <div
                  key={row.category}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 40px 40px 60px",
                    gap: 4, padding: "5px 6px",
                    borderBottom: "1px solid #1a2236",
                    background: isUp ? "#c41e3a08" : "transparent",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.category}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#e2e8f0", textAlign: "right" }}>
                    {row.current}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", textAlign: "right" }}>
                    {row.previous}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: deltaColor, textAlign: "right" }}>
                    {deltaIcon}{Math.abs(row.delta)} ({Math.abs(row.delta_pct)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
