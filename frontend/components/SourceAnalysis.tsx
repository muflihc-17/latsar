"use client";
import { useEffect, useState } from "react";
import { getSources } from "@/lib/api";
import { usePeriod } from "@/lib/PeriodContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const ttStyle = {
  contentStyle: {
    background: "#0b0f17", border: "1px solid #1a2236",
    borderRadius: 4, fontFamily: "JetBrains Mono,monospace", fontSize: 10,
  },
};

export default function SourceAnalysis() {
  const { period } = usePeriod();
  const [data, setData] = useState<any[]>([]);

  const load = async () => {
    try {
      const sources = await getSources(period);
      setData(
        sources.slice(0, 10).map((s: any) => ({
          source: s.source.length > 18 ? s.source.slice(0, 16) + ".." : s.source,
          fullName: s.source,
          count: s.count,
        }))
      );
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <div className="card">
      <div className="card-title">📰 Sumber Berita</div>
      {data.length === 0 ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", textAlign: "center", paddingTop: 40 }}>
          Belum ada data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2236" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#3d4d61", fontSize: 9, fontFamily: "JetBrains Mono" }} allowDecimals={false} />
            <YAxis
              type="category" dataKey="source" width={110}
              tick={{ fill: "#7a8899", fontSize: 8, fontFamily: "JetBrains Mono" }}
            />
            <Tooltip
              {...ttStyle}
              formatter={(v: any, _: string, props: any) => [v, props.payload.fullName]}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[0, 2, 2, 0]} barSize={12} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
