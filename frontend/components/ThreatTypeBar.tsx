"use client";
import { useEffect, useState } from "react";
import { usePeriod } from "@/lib/PeriodContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const THREAT_COLORS: Record<string, string> = {
  "Bencana Alam":                  "#f59e0b",
  "Kriminalitas":                  "#ef4444",
  "Konflik Sosial":                "#f97316",
  "Separatisme":                   "#c41e3a",
  "Terorisme":                     "#dc2626",
  "Instabilitas Politik":          "#8b5cf6",
  "Keresahan Ekonomi":             "#3b82f6",
  "Gangguan Kamtibmas":            "#ec4899",
  "Penyimpangan Oknum TNI/Polri":  "#06b6d4",
  "Isu Viral & Citra Institusi TNI": "#a855f7",
  "Keracunan & Kesehatan Publik":  "#10b981",
  "Lainnya":                       "#4a5568",
};

const ttStyle = {
  contentStyle: {
    background: "#0b0f17", border: "1px solid #1a2236",
    borderRadius: 4, fontFamily: "JetBrains Mono,monospace", fontSize: 10,
  },
};

export default function ThreatTypeBar() {
  const { period } = usePeriod();
  const [data, setData] = useState<any[]>([]);

  const load = async () => {
    try {
      const news = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/news/?period=${period}&limit=200`,
        { cache: "no-store" }
      ).then(r => r.json());

      const counter: Record<string, number> = {};
      for (const item of news) {
        if (item.threat_type) {
          counter[item.threat_type] = (counter[item.threat_type] || 0) + 1;
        }
      }

      setData(
        Object.entries(counter)
          .map(([name, value]) => ({
            name: name.length > 20 ? name.slice(0, 18) + ".." : name,
            fullName: name, value,
            color: THREAT_COLORS[name] || "#4a5568",
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8)
      );
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <div className="card">
      <div className="card-title">⚠️ Jenis Ancaman</div>
      {data.length === 0 ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", textAlign: "center", paddingTop: 40 }}>
          Belum ada data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2236" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#3d4d61", fontSize: 9, fontFamily: "JetBrains Mono" }} />
            <YAxis
              type="category" dataKey="name" width={100}
              tick={{ fill: "#7a8899", fontSize: 8, fontFamily: "JetBrains Mono" }}
            />
            <Tooltip
              {...ttStyle}
              formatter={(v: any, _: string, props: any) => [v, props.payload.fullName]}
            />
            <Bar dataKey="value" radius={[0, 2, 2, 0]} barSize={12}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
