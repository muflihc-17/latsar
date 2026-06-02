"use client";
import { useEffect, useState } from "react";
import { getByRegion } from "@/lib/api";
import { usePeriod } from "@/lib/PeriodContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const levelColor: Record<string, string> = {
  kritis:  "#c41e3a",
  waspada: "#f59e0b",
  aman:    "#10b981",
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

export default function RegionBar() {
  const { period } = usePeriod();
  const [data, setData] = useState<any[]>([]);

  const load = async () => {
    try {
      const regions = await getByRegion(period);
      setData(
        regions.slice(0, 5).map((r: any) => ({
          region: r.region.length > 10 ? r.region.slice(0, 9) + "." : r.region,
          fullName: r.region,
          total: r.total,
          level: r.level,
          top_category: r.top_category,
          color: levelColor[r.level] || "#4a5568",
        }))
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
      <div className="card-title">
        📍 Top 5 Wilayah Rawan
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {Object.entries(levelColor).map(([level, color]) => (
            <span key={level} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: 1, background: color, display: "inline-block" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-muted)", textTransform: "uppercase" }}>
                {level}
              </span>
            </span>
          ))}
        </div>
      </div>
      {data.length === 0 ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", textAlign: "center", paddingTop: 40 }}>
          Belum ada data
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 200, position: "relative", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 10, left: -15, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2236" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#3d4d61", fontSize: 9, fontFamily: "JetBrains Mono" }} allowDecimals={false} />
              <YAxis
                type="category" dataKey="region" width={55}
                tick={{ fill: "#7a8899", fontSize: 8, fontFamily: "JetBrains Mono" }}
              />
              <Tooltip
                {...ttStyle}
                formatter={(v: any, _: string, props: any) => [
                  `${v} insiden (${props.payload.level.toUpperCase()})`,
                  props.payload.fullName,
                ]}
              />
              <Bar dataKey="total" radius={[0, 2, 2, 0]} barSize={18}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
