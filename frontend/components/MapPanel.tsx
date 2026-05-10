"use client";
import { useEffect, useRef, useState } from "react";
import { getByRegion } from "@/lib/api";
import { usePeriod } from "@/lib/PeriodContext";

// Koordinat kota-kota di Jawa Timur
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "Surabaya":    { lat: -7.2575,  lng: 112.7521 },
  "Malang":      { lat: -7.9797,  lng: 112.6304 },
  "Jember":      { lat: -8.1845,  lng: 113.6800 },
  "Sidoarjo":    { lat: -7.4458,  lng: 112.7181 },
  "Gresik":      { lat: -7.1566,  lng: 112.6521 },
  "Kediri":      { lat: -7.8168,  lng: 111.9649 },
  "Mojokerto":   { lat: -7.4700,  lng: 112.4338 },
  "Pasuruan":    { lat: -7.6453,  lng: 112.9075 },
  "Banyuwangi":  { lat: -8.2195,  lng: 114.3691 },
  "Probolinggo": { lat: -7.7543,  lng: 113.2159 },
  "Lumajang":    { lat: -8.1314,  lng: 113.2230 },
  "Blitar":      { lat: -8.0953,  lng: 112.1608 },
  "Madiun":      { lat: -7.6298,  lng: 111.5232 },
  "Sampang":     { lat: -7.1786,  lng: 113.2488 },
  "Pamekasan":   { lat: -7.1569,  lng: 113.4686 },
  "Sumenep":     { lat: -6.9987,  lng: 113.8597 },
  "Bangkalan":   { lat: -7.0414,  lng: 112.7305 },
  "Jawa Timur":  { lat: -7.5360,  lng: 112.2380 },
};

const levelConfig: Record<string, { color: string; label: string; radius: number }> = {
  kritis:  { color: "#c41e3a", label: "KRITIS",  radius: 12 },
  waspada: { color: "#f59e0b", label: "WASPADA", radius: 9  },
  aman:    { color: "#1db954", label: "AMAN",    radius: 6  },
};

export default function MapPanel() {
  const mapRef     = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef  = useRef<any[]>([]);
  const { period }  = usePeriod();
  const [regionData, setRegionData] = useState<any[]>([]);
  const [summary, setSummary]       = useState({ kritis: 0, waspada: 0, aman: 0 });

  // Load data dari backend
  useEffect(() => {
    const load = async () => {
      try {
        const data = await getByRegion(period);
        setRegionData(data);
        setSummary({
          kritis:  data.filter((r: any) => r.level === "kritis").length,
          waspada: data.filter((r: any) => r.level === "waspada").length,
          aman:    data.filter((r: any) => r.level === "aman").length,
        });
      } catch (e) {
        console.error(e);
      }
    };
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [period]);

  // Init peta Leaflet
  useEffect(() => {
    if (typeof window === "undefined") return;
    let mounted = true;

    const initMap = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (!mapRef.current || !mounted) return;
      if (mapInstance.current) return;

      mapInstance.current = L.map(mapRef.current, {
        center: [-7.536, 112.238],
        zoom: 8,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 13,
      }).addTo(mapInstance.current);
    };

    initMap();
    return () => { mounted = false; };
  }, []);

  // Update marker saat data berubah
  useEffect(() => {
    if (!mapInstance.current || regionData.length === 0) return;
    if (typeof window === "undefined") return;

    const updateMarkers = async () => {
      const L = (await import("leaflet")).default;

      // Hapus marker lama
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      regionData.forEach((region: any) => {
        const coords = CITY_COORDS[region.region];
        if (!coords) return;

        const cfg = levelConfig[region.level] || levelConfig.aman;

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="position:relative;width:${cfg.radius * 2}px;height:${cfg.radius * 2}px">
              <div style="
                width:${cfg.radius * 2}px;height:${cfg.radius * 2}px;
                border-radius:50%;background:${cfg.color};opacity:0.3;
                position:absolute;top:0;left:0;
                animation:pulse 2s infinite;
              "></div>
              <div style="
                width:${cfg.radius}px;height:${cfg.radius}px;
                border-radius:50%;background:${cfg.color};
                position:absolute;
                top:${cfg.radius / 2}px;left:${cfg.radius / 2}px;
                box-shadow:0 0 8px ${cfg.color};
                border:1.5px solid white;
              "></div>
            </div>
          `,
          iconSize: [cfg.radius * 2, cfg.radius * 2],
          iconAnchor: [cfg.radius, cfg.radius],
        });

        const marker = L.marker([coords.lat, coords.lng], { icon })
          .addTo(mapInstance.current)
          .bindPopup(`
            <div style="font-family:JetBrains Mono,monospace;font-size:11px;background:#0d1117;color:#e2e8f0;padding:8px 10px;border-radius:3px;min-width:160px">
              <div style="font-weight:700;margin-bottom:6px;font-size:13px">${region.region}</div>
              <div style="color:${cfg.color};font-weight:700;margin-bottom:4px">${cfg.label}</div>
              <div style="color:#4a5568;margin-bottom:4px">Total: ${region.total} berita</div>
              <div style="display:flex;gap:8px;">
                <span style="color:#4ade80">▲ ${region.positif}</span>
                <span style="color:#93c5fd">● ${region.netral}</span>
                <span style="color:#f87171">▼ ${region.negatif}</span>
              </div>
            </div>
          `, { className: "custom-popup" });

        markersRef.current.push(marker);
      });
    };

    updateMarkers();
  }, [regionData]);

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 400 }}>
      <div className="card-title">
        🗺️ Peta Situasi Jawa Timur
        <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
          {[
            { l: "KRITIS",  v: summary.kritis,  c: "#f87171" },
            { l: "WASPADA", v: summary.waspada, c: "#fbbf24" },
            { l: "AMAN",    v: summary.aman,    c: "#4ade80"  },
          ].map(s => (
            <span key={s.l} style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: s.c }}>
              {s.l}: {s.v}
            </span>
          ))}
        </div>
      </div>

      {/* Leaflet Map */}
      <div ref={mapRef} style={{ flex: 1, borderRadius: 3, minHeight: 300, border: "1px solid var(--border)" }} />

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 8, justifyContent: "center", flexWrap: "wrap" }}>
        {Object.entries(levelConfig).map(([key, cfg]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, display: "inline-block", boxShadow: `0 0 6px ${cfg.color}` }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-secondary)", letterSpacing: ".08em" }}>
              {cfg.label}
            </span>
          </div>
        ))}
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>
          * Klik marker untuk detail
        </span>
      </div>

      <style jsx>{`
        @keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:0.8} }
      `}</style>
    </div>
  );
}
