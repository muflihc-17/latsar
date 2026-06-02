"use client";
import { useEffect, useState } from "react";
import { getTrend } from "@/lib/api";
import { usePeriod } from "@/lib/PeriodContext";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

const ttStyle = {
  contentStyle: {
    background: "#0b0f17", border: "1px solid #1a2236",
    borderRadius: 4, fontFamily: "JetBrains Mono,monospace", fontSize: 10,
  },
  labelStyle: { color: "#e2e8f0" },
};

export default function ThreatTrendChart() {
  const { period, periodLabel } = usePeriod();
  const [data, setData] = useState<any[]>([]);
  const [avg, setAvg] = useState(0);

  const load = async () => {
    try {
      const trend = await getTrend(period);
      setData(trend);
      if (trend.length > 0) {
        const sum = trend.reduce((a: number, b: any) => a + (b.negatif || 0), 0);
        setAvg(Math.round((sum / trend.length) * 10) / 10);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <div className="card">
      <div className="card-title">
        📈 Tren Insiden — {periodLabel.toUpperCase()}
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>
          avg {avg}/jam
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2236" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#3d4d61", fontSize: 8, fontFamily: "JetBrains Mono" }}
            dy={10}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#3d4d61", fontSize: 9, fontFamily: "JetBrains Mono" }}
            allowDecimals={false}
          />
          <Tooltip {...ttStyle} formatter={(v: any) => [v, "Insiden"]} />
          {avg > 0 && (
            <ReferenceLine
              y={avg}
              stroke="#f59e0b55"
              strokeDasharray="6 3"
              label={{ value: "avg", fill: "#f59e0b", fontSize: 8, fontFamily: "JetBrains Mono" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="negatif"
            stroke="#c41e3a"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#f87171", strokeWidth: 0 }}
            name="Insiden"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
