"use client";
import { useEffect, useState } from "react";
import { getByRegion } from "@/lib/api";
import { usePeriod } from "@/lib/PeriodContext";

export default function AlertPanel() {
  const { period }          = usePeriod();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const data = await getByRegion(period);
      const filtered = data
        .filter((r: any) => r.level === "waspada" || r.level === "kritis")
        .sort((a: any, b: any) => b.negatif - a.negatif)
        .slice(0, 5);
      setAlerts(filtered);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchAlerts().finally(() => setLoading(false));
    const id = setInterval(fetchAlerts, 30_000); // background silent
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const levelConfig: Record<string, { color: string; label: string }> = {
    kritis:  { color: "#c41e3a", label: "KRITIS"  },
    waspada: { color: "#f59e0b", label: "WASPADA" },
  };

  const kritisCount = alerts.filter(a => a.level === "kritis").length;

  return (
    <div className="card" style={{ borderLeft: "3px solid #c41e3a", minHeight: 220 }}>
      <div className="card-title">
        ⚡ Alert & Notifikasi
        {kritisCount > 0 && (
          <span className="badge badge-neg" style={{ marginLeft: "auto" }}>{kritisCount} KRITIS</span>
        )}
      </div>

      {loading ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>Memuat alert...</div>
      ) : alerts.length === 0 ? (
        <div style={{ padding: "12px", background: "#1db95411", border: "1px solid #1db95433", borderLeft: "3px solid #1db954", borderRadius: 3 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#4ade80", fontWeight: 700 }}>KONDUSIF</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            Semua wilayah dalam status aman.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {alerts.map((alert: any, i: number) => {
            const cfg = levelConfig[alert.level];
            return (
              <div key={i} style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                padding: "8px 10px",
                background: cfg.color + "0d",
                border: `1px solid ${cfg.color}33`,
                borderLeft: `3px solid ${cfg.color}`,
                borderRadius: 3,
              }}>
                <div style={{ minWidth: 64 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: cfg.color, letterSpacing: ".08em" }}>
                    {cfg.label}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
                    {alert.negatif} negatif
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 600, color: "#e2e8f0", marginBottom: 2 }}>
                    📍 {alert.region}
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    {alert.total} berita — <span style={{ color: "#4ade80" }}>▲{alert.positif}</span> <span style={{ color: "#93c5fd" }}>●{alert.netral}</span> <span style={{ color: "#f87171" }}>▼{alert.negatif}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
