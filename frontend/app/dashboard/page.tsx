"use client";

import dynamic from "next/dynamic";

// Disable SSR untuk semua komponen agar data langsung load tanpa perlu refresh
const Header           = dynamic(() => import("@/components/Header"),           { ssr: false });
const AlertPanel       = dynamic(() => import("@/components/AlertPanel"),       { ssr: false });
const ExecutiveSummary = dynamic(() => import("@/components/ExecutiveSummary"), { ssr: false });
const MapPanel         = dynamic(() => import("@/components/MapPanel"),         { ssr: false });
const NewsFeed         = dynamic(() => import("@/components/NewsFeed"),         { ssr: false });
const TrendCharts      = dynamic(() => import("@/components/TrendCharts"),      { ssr: false });

export default function DashboardPage() {
  return (
    <div className="dashboard-root">
      <Header />
      <main className="dashboard-grid">
        <section className="area-alert">
          <AlertPanel />
        </section>
        <section className="area-exec">
          <ExecutiveSummary />
        </section>
        <section className="area-map">
          <MapPanel />
        </section>
        <section className="area-feed">
          <NewsFeed />
        </section>
        <section className="area-charts">
          <TrendCharts />
        </section>
      </main>
    </div>
  );
}
