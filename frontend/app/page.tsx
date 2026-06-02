"use client";

import dynamic from "next/dynamic";
import { PeriodProvider } from "@/lib/PeriodContext";

import { useState } from "react";

// Semua komponen di-load secara client-side (ssr: false)
const Header           = dynamic(() => import("@/components/Header"),           { ssr: false });
const KpiCards         = dynamic(() => import("@/components/KpiCards"),         { ssr: false });
const TopicHeatmap     = dynamic(() => import("@/components/TopicHeatmap"),     { ssr: false });
const WatchlistPanel   = dynamic(() => import("@/components/WatchlistPanel"),   { ssr: false });
const ThreatTrendChart = dynamic(() => import("@/components/ThreatTrendChart"), { ssr: false });
const CategoryDonut    = dynamic(() => import("@/components/CategoryDonut"),    { ssr: false });
const ThreatTypeBar    = dynamic(() => import("@/components/ThreatTypeBar"),    { ssr: false });
const RegionBar        = dynamic(() => import("@/components/RegionBar"),        { ssr: false });
const WordCloud        = dynamic(() => import("@/components/WordCloud"),        { ssr: false });
const SourceAnalysis   = dynamic(() => import("@/components/SourceAnalysis"),   { ssr: false });
const ComparativePeriod = dynamic(() => import("@/components/ComparativePeriod"), { ssr: false });
const HeatCalendar     = dynamic(() => import("@/components/HeatCalendar"),     { ssr: false });
const NewsFeed         = dynamic(() => import("@/components/NewsFeed"),         { ssr: false });

// Komponen baru
const Sidebar          = dynamic(() => import("@/components/Sidebar"),          { ssr: false });
const LaporanManager   = dynamic(() => import("@/components/LaporanManager"),   { ssr: false });

function DashboardContent({ activeMode, setMode }: { activeMode: "dashboard" | "laporan", setMode: any }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="dashboard-root" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Header onMenuClick={() => setIsSidebarOpen(true)} />
      
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        activeMode={activeMode}
        setMode={setMode}
      />

      {activeMode === "dashboard" ? (
        <main className="dashboard-grid">
          {/* Atas: KPI Cards (full width top) */}
          <section className="area-kpi">
            <KpiCards />
          </section>

          {/* Kiri (30%): Heatmap & Word Cloud */}
          <section className="area-left">
            <TopicHeatmap />
            <WordCloud />
          </section>

          {/* Tengah (40%): News Feed */}
          <section className="area-middle">
            <NewsFeed />
          </section>

          {/* Kanan (30%): Wilayah & Kategori */}
          <section className="area-right">
            <RegionBar />
            <CategoryDonut />
          </section>
        </main>
      ) : (
        <LaporanManager />
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [activeMode, setActiveMode] = useState<"dashboard" | "laporan">("dashboard");

  return (
    <PeriodProvider>
      <DashboardContent activeMode={activeMode} setMode={setActiveMode} />
    </PeriodProvider>
  );
}
