"use client";

import dynamic from "next/dynamic";
import { PeriodProvider, usePeriod } from "@/lib/PeriodContext";

const Header           = dynamic(() => import("@/components/Header"),           { ssr: false });
const AlertPanel       = dynamic(() => import("@/components/AlertPanel"),       { ssr: false });
const ExecutiveSummary = dynamic(() => import("@/components/ExecutiveSummary"), { ssr: false });
const MapPanel         = dynamic(() => import("@/components/MapPanel"),         { ssr: false });
const NewsFeed         = dynamic(() => import("@/components/NewsFeed"),         { ssr: false });
const TrendCharts      = dynamic(() => import("@/components/TrendCharts"),      { ssr: false });

function PeriodFilter() {
  const { period, setPeriod, periodLabel } = usePeriod();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 16px", background: "#0a0d14",
      borderBottom: "1px solid #1c2535",
    }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: ".1em" }}>
        FILTER PERIODE:
      </span>
      {(["day", "week", "month"] as const).map(p => (
        <button key={p} onClick={() => setPeriod(p)} style={{
          fontFamily: "var(--font-mono)", fontSize: 9, padding: "3px 10px",
          borderRadius: 2, cursor: "pointer", letterSpacing: ".08em",
          background: period === p ? "#c41e3a" : "#ffffff0a",
          color: period === p ? "#fff" : "var(--text-secondary)",
          border: `1px solid ${period === p ? "#c41e3a" : "var(--border)"}`,
          transition: "all .15s",
        }}>
          {{ day: "HARI INI", week: "7 HARI", month: "30 HARI" }[p]}
        </button>
      ))}
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-secondary)", marginLeft: 8 }}>
        Menampilkan data: <span style={{ color: "#93c5fd" }}>{periodLabel}</span>
      </span>
    </div>
  );
}

function DashboardContent() {
  return (
    <div className="dashboard-root">
      <Header />
      <PeriodFilter />
      <main className="dashboard-grid">
        <section className="area-alert">  <AlertPanel />       </section>
        <section className="area-exec">   <ExecutiveSummary /> </section>
        <section className="area-map">    <MapPanel />         </section>
        <section className="area-feed">   <NewsFeed />         </section>
        <section className="area-charts"> <TrendCharts />      </section>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <PeriodProvider>
      <DashboardContent />
    </PeriodProvider>
  );
}
