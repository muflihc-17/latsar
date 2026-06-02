"use client";
import { useEffect, useState } from "react";
import { getStats } from "@/lib/api";
import { usePeriod } from "@/lib/PeriodContext";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const CATEGORY_COLORS: Record<string, string> = {
  "MBG": "#06b6d4",
  "KDMP": "#10b981",
  "Jembatan Garuda": "#3b82f6",
  "TNI": "#ec4899",
  "Politik & Korupsi": "#8b5cf6",
  "Demo & Konsolidasi": "#ef4444",
  "Bencana Alam": "#f59e0b",
  "Narkoba": "#c41e3a",
};

const ttStyle = {
  contentStyle: {
    background: "#0b0f17", border: "1px solid #1a2236",
    borderRadius: 4, fontFamily: "JetBrains Mono,monospace", fontSize: 10,
    color: "#e2e8f0",
  },
  labelStyle: { color: "#e2e8f0" },
  itemStyle: { color: "#e2e8f0" },
};

export default function CategoryDonut() {
  const { period } = usePeriod();
  const [data, setData] = useState<any[]>([]);

  const load = async () => {
    try {
      const apiBase =
        typeof window !== "undefined"
          ? `http://${window.location.hostname}:8000`
          : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
      const news = await fetch(
        `${apiBase}/api/news/?period=${period}&limit=200`,
        { cache: "no-store" }
      ).then(r => r.json());

      const counter: Record<string, number> = {};
      for (const item of news) {
        const cat = item.category || "Lainnya";
        counter[cat] = (counter[cat] || 0) + 1;
      }

      setData(
        Object.entries(counter)
          .map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] || "#4a5568" }))
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
    <div className="card" style={{ display: "flex", flexDirection: "column" }}>
      <div className="card-title">🏷 Kategori Ancaman</div>
      {data.length === 0 ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", textAlign: "center", paddingTop: 40 }}>
          Belum ada data
        </div>
      ) : (
        <>
          <div style={{ flex: 1, minHeight: 200, position: "relative", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <PieChart>
                <Pie
                  data={data} cx="50%" cy="50%"
                  innerRadius="45%" outerRadius="70%"
                  dataKey="value" paddingAngle={2}
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip {...ttStyle} formatter={(v: any, name: string) => [v, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
            {data.slice(0, 5).map(d => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: 1, background: d.color, flexShrink: 0, display: "inline-block" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {d.name}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: d.color }}>
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
