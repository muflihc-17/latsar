"use client";
import { useEffect, useState } from "react";
import { getStats, getLatestReport, triggerReport } from "@/lib/api";

export default function ExecutiveSummary() {
  const [stats, setStats]   = useState({ total: 0, positive: 0, neutral: 0, negative: 0 });
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadData = async () => {
    try {
      const [s, r] = await Promise.all([getStats(), getLatestReport()]);
      setStats(s);
      setReport(r);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
    const id = setInterval(loadData, 30_000); // background silent
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await triggerReport();
      await loadData();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">
        🧠 Ringkasan Eksekutif AI
        <button onClick={handleGenerate} disabled={generating} style={{
          marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9,
          padding: "3px 8px", borderRadius: 2, cursor: generating ? "not-allowed" : "pointer",
          background: "#3b82f622", color: "#93c5fd", border: "1px solid #3b82f655",
          letterSpacing: ".08em",
        }}>
          {generating ? "⏳ GENERATING..." : "✨ GENERATE"}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 7, marginBottom: 11 }}>
        {[
          { l: "TOTAL", v: stats.total, c: "var(--text-primary)" },
          { l: "POSITIF", v: stats.positive, c: "#4ade80" },
          { l: "NETRAL", v: stats.neutral, c: "#93c5fd" },
          { l: "NEGATIF", v: stats.negative, c: "#f87171" },
        ].map(s => (
          <div key={s.l} style={{ flex: 1, padding: "7px 8px", background: "#ffffff08", borderRadius: 3, border: "1px solid var(--border)", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 500, color: s.c }}>{s.v}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-muted)", letterSpacing: ".08em", marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* AI Summary */}
      {loading ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", padding: "10px 12px" }}>
          Memuat ringkasan...
        </div>
      ) : report?.summary ? (
        <>
          <p style={{
            fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-secondary)",
            lineHeight: 1.6, marginBottom: 11, padding: "10px 12px",
            background: "#ffffff05", borderRadius: 3, borderLeft: "2px solid #3b82f6",
          }}>
            {report.summary}
          </p>

          {/* Alert Level */}
          <div style={{ marginBottom: 10 }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
              padding: "3px 10px", borderRadius: 2, letterSpacing: ".1em",
              background: report.alert_level === "kritis" ? "#c41e3a33" : report.alert_level === "waspada" ? "#f59e0b33" : "#1db95433",
              color: report.alert_level === "kritis" ? "#f87171" : report.alert_level === "waspada" ? "#fbbf24" : "#4ade80",
              border: `1px solid ${report.alert_level === "kritis" ? "#c41e3a55" : report.alert_level === "waspada" ? "#f59e0b55" : "#1db95455"}`,
            }}>
              STATUS: {report.alert_level?.toUpperCase()}
            </span>
          </div>

          {/* Top Issues */}
          {report.top_issues?.length > 0 && (
            <>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: ".1em", marginBottom: 7 }}>
                TOP ISSUES HARI INI
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {report.top_issues.slice(0, 5).map((issue: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", minWidth: 14 }}>{i + 1}.</span>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 12, flex: 1, color: "var(--text-primary)" }}>{issue.title}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-secondary)" }}>{issue.region}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-muted)", padding: "10px 12px", textAlign: "center" }}>
          Belum ada laporan. Klik GENERATE untuk membuat ringkasan AI.
        </div>
      )}
    </div>
  );
}
