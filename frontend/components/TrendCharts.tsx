"use client";
import { useEffect, useState } from "react";
import { getTrend, getByRegion, getStats } from "@/lib/api";
import { usePeriod } from "@/lib/PeriodContext";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const ttStyle = {
  contentStyle: { background: "#0d1117", border: "1px solid #1c2535", borderRadius: 3, fontFamily: "JetBrains Mono,monospace", fontSize: 10 },
  labelStyle: { color: "#e2e8f0" },
};

export default function TrendCharts() {
  const { period, periodLabel } = usePeriod();
  const [trend,   setTrend]   = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [pie,     setPie]     = useState([
    { name: "Positif", value: 0, color: "#1db954" },
    { name: "Netral",  value: 0, color: "#3b82f6" },
    { name: "Negatif", value: 0, color: "#c41e3a" },
  ]);

  const loadData = async () => {
    try {
      const [t, r, s] = await Promise.all([getTrend(period), getByRegion(period), getStats(period)]);
      setTrend(t.map((item: any) => ({
        time: item.label,
        pos: item.positif || 0,
        neu: item.netral  || 0,
        neg: item.negatif || 0,
      })));
      setRegions(r.slice(0, 8).map((item: any) => ({
        region: item.region.length > 8 ? item.region.slice(0, 8) + ".." : item.region,
        neg: item.negatif || 0,
        neu: item.netral  || 0,
        pos: item.positif || 0,
      })));
      setPie([
        { name: "Positif", value: s.positive || 0, color: "#1db954" },
        { name: "Netral",  value: s.neutral   || 0, color: "#3b82f6" },
        { name: "Negatif", value: s.negative  || 0, color: "#c41e3a" },
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 15_000);
    return () => clearInterval(id);
  }, [period]);

  return (
    <div className="card">
      <div className="card-title">📈 Grafik & Statistik Tren</div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", gap: 20 }}>

        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: ".1em", marginBottom: 8 }}>
            TREN SENTIMEN — {periodLabel.toUpperCase()}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2535" />
              <XAxis dataKey="time" tick={{ fill: "#4a5568", fontSize: 8, fontFamily: "JetBrains Mono" }} />
              <YAxis tick={{ fill: "#4a5568", fontSize: 9, fontFamily: "JetBrains Mono" }} />
              <Tooltip {...ttStyle} />
              <Legend wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: 9 }} />
              <Line type="monotone" dataKey="pos" stroke="#1db954" strokeWidth={2} dot={false} name="Positif" />
              <Line type="monotone" dataKey="neu" stroke="#3b82f6" strokeWidth={2} dot={false} name="Netral"  />
              <Line type="monotone" dataKey="neg" stroke="#c41e3a" strokeWidth={2} dot={false} name="Negatif" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: ".1em", marginBottom: 8 }}>
            INTENSITAS BERITA PER WILAYAH — {periodLabel.toUpperCase()}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={regions} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2535" />
              <XAxis dataKey="region" tick={{ fill: "#4a5568", fontSize: 8, fontFamily: "JetBrains Mono" }} />
              <YAxis tick={{ fill: "#4a5568", fontSize: 9, fontFamily: "JetBrains Mono" }} />
              <Tooltip {...ttStyle} />
              <Legend wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: 9 }} />
              <Bar dataKey="neg" stackId="a" fill="#c41e3a" name="Negatif" />
              <Bar dataKey="neu" stackId="a" fill="#3b82f6" name="Netral"  />
              <Bar dataKey="pos" stackId="a" fill="#1db954" name="Positif" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: ".1em", marginBottom: 8 }}>
            DISTRIBUSI SENTIMEN
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <PieChart>
              <Pie data={pie} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
                {pie.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip {...ttStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
            {pie.map(d => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: 1, background: d.color, display: "inline-block" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-secondary)", flex: 1 }}>{d.name}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: d.color }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
