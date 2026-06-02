"use client";
import { useEffect, useState } from "react";
import { triggerCrawl, getVelocity } from "@/lib/api";
import { usePeriod } from "@/lib/PeriodContext";

interface VelocityData {
  is_spike: boolean;
  recent_count: number;
  avg_per_hour: number;
  total_today: number;
}

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { period, setPeriod } = usePeriod();
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [lastCrawl, setLastCrawl] = useState<string | null>(null);
  const [velocity, setVelocity] = useState<VelocityData | null>(null);

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
      setDate(now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Velocity polling (tiap 2 menit)
  useEffect(() => {
    const checkVelocity = async () => {
      try { setVelocity(await getVelocity()); }
      catch { /* silent */ }
    };
    checkVelocity();
    const id = setInterval(checkVelocity, 120_000);
    return () => clearInterval(id);
  }, []);

  const handleManualCrawl = async () => {
    setCrawling(true);
    try {
      await triggerCrawl();
      setLastCrawl(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      console.error(e);
    } finally {
      setCrawling(false);
    }
  };

  const PERIODS: { key: "day" | "week" | "month"; label: string }[] = [
    { key: "day", label: "Hari Ini" },
    { key: "week", label: "7 Hari" },
    { key: "month", label: "30 Hari" },
  ];

  return (
    <div>
      {/* Velocity Spike Banner */}
      {velocity?.is_spike && (
        <div className="velocity-banner">
          <div className="velocity-dot" />
          <span style={{ color: "#f87171", fontWeight: 700 }}>LONJAKAN TERDETEKSI</span>
          <span style={{ color: "var(--text-secondary)" }}>—</span>
          <span style={{ color: "#fbbf24" }}>
            {velocity.recent_count} insiden dalam 1 jam terakhir
          </span>
          <span style={{ color: "var(--text-muted)" }}>
            (rata-rata: {velocity.avg_per_hour}/jam)
          </span>
        </div>
      )}

      <header style={{
        background: "#08090f",
        borderBottom: "1px solid #1a2236",
        padding: "10px 16px",
        display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 16,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Hamburger Menu Icon */}
          <button
            onClick={onMenuClick}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              padding: "4px 0", display: "flex", flexDirection: "column", gap: 4,
            }}
            title="Menu"
          >
            <div style={{ width: 20, height: 2, background: "#e2e8f0", borderRadius: 2 }} />
            <div style={{ width: 20, height: 2, background: "#e2e8f0", borderRadius: 2 }} />
            <div style={{ width: 20, height: 2, background: "#e2e8f0", borderRadius: 2 }} />
          </button>
          
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src="/logokodam.svg"
              alt="Kodam Logo"
              style={{ width: 40, height: 40, objectFit: "contain" }}
            />
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: ".1em", lineHeight: 1 }}>
                KODAM V / BRAWIJAYA
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#c41e3a", letterSpacing: ".15em", marginTop: 2 }}>
                THREAT INTELLIGENCE DASHBOARD
              </div>
            </div>
          </div>
        </div>

        {/* Status Indicators */}
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          {[
            { label: "CRAWLING", value: "AKTIF", color: "#10b981" },
            { label: "HARI INI", value: velocity ? `${velocity.total_today} insiden` : "—", color: "#f87171" },
            { label: "STATUS AI", value: "ONLINE", color: "#10b981" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-muted)", letterSpacing: ".12em" }}>
                {s.label}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: s.color, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.color, display: "inline-block", animation: "pulse 2s infinite" }} />
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Period Selector */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-muted)", letterSpacing: ".1em", marginRight: 4 }}>
            PERIODE:
          </span>
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 9, padding: "4px 10px",
                borderRadius: 2, cursor: "pointer", letterSpacing: ".08em",
                background: period === p.key ? "#c41e3a" : "#ffffff0a",
                color: period === p.key ? "#fff" : "var(--text-secondary)",
                border: `1px solid ${period === p.key ? "#c41e3a" : "var(--border)"}`,
                transition: "all .15s",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Manual Crawl */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={handleManualCrawl}
            disabled={crawling}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 9, padding: "5px 12px",
              borderRadius: 2, cursor: crawling ? "not-allowed" : "pointer",
              background: crawling ? "#1a2236" : "#c41e3a22",
              color: crawling ? "var(--text-muted)" : "#f87171",
              border: `1px solid ${crawling ? "var(--border)" : "#c41e3a55"}`,
              letterSpacing: ".08em", transition: "all .15s",
            }}
          >
            {crawling ? "⏳ CRAWLING..." : "🔄 CRAWL MANUAL"}
          </button>
          {lastCrawl && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-muted)" }}>
              terakhir: {lastCrawl}
            </span>
          )}
        </div>

        {/* Clock */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 600, letterSpacing: ".04em" }}>
            {time}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-secondary)", marginTop: 1 }}>
            {date}
          </div>
        </div>
      </header>
    </div>
  );
}
