"use client";
import { useEffect, useState } from "react";
import { triggerCrawl, triggerAnalyze } from "@/lib/api";

export default function Header() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [lastCrawl, setLastCrawl] = useState<string | null>(null);

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

  const handleManualCrawl = async () => {
    setCrawling(true);
    try {
      await triggerCrawl();
      await triggerAnalyze();
      setLastCrawl(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      console.error(e);
    } finally {
      setCrawling(false);
    }
  };

  return (
    <header style={{
      background: "#0a0d14", borderBottom: "1px solid #1c2535",
      padding: "10px 16px", display: "flex", alignItems: "center",
      justifyContent: "space-between", gap: 16, position: "sticky", top: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img 
          src="/logokodam.svg" 
          alt="Kodam Logo" 
          style={{ width: 44, height: 44, objectFit: "contain" }} 
        />
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: ".08em", lineHeight: 1 }}>
            KODAM V / BRAWIJAYA
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-secondary)", letterSpacing: ".1em", marginTop: 2 }}>
            SISTEM ANALISIS SITUASI JAWA TIMUR
          </div>
        </div>
      </div>

      {/* Status */}
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        {[
          { label: "CRAWLING", value: "AKTIF", color: "#1db954" },
          { label: "INTERVAL", value: "10 MENIT", color: "#3b82f6" },
          { label: "AI AGENT", value: "ONLINE", color: "#1db954" },
        ].map(s => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: ".1em" }}>{s.label}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: s.color, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, display: "inline-block", animation: "pulse 2s infinite" }} />
              {s.value}
            </div>
          </div>
        ))}

        {/* Manual crawl button */}
        <button
          onClick={handleManualCrawl}
          disabled={crawling}
          style={{
            fontFamily: "var(--font-mono)", fontSize: 10, padding: "5px 12px",
            borderRadius: 2, cursor: crawling ? "not-allowed" : "pointer",
            background: crawling ? "#1a2535" : "#c41e3a22",
            color: crawling ? "var(--text-muted)" : "#f87171",
            border: "1px solid " + (crawling ? "var(--border)" : "#c41e3a55"),
            letterSpacing: ".08em", transition: "all .15s",
          }}
        >
          {crawling ? "⏳ CRAWLING..." : "🔄 CRAWL MANUAL"}
        </button>
        {lastCrawl && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>
            terakhir: {lastCrawl}
          </span>
        )}
      </div>

      {/* Jam */}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, letterSpacing: ".04em" }}>{time}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-secondary)", marginTop: 1 }}>{date}</div>
      </div>

      <style jsx>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>
    </header>
  );
}
