"use client";
import { useEffect, useState } from "react";
import { usePeriod } from "@/lib/PeriodContext";

const API =
  typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000`
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");

// Singkatan label topik agar muat di kolom sempit
const TOPIC_SHORT: Record<string, string> = {
  "MBG": "MBG",
  "KDMP": "KDMP",
  "Jembatan Garuda": "JBT",
  "TNI": "TNI",
  "Politik & Korupsi": "POL",
  "Demo & Konsolidasi": "DEMO",
  "Bencana Alam": "BNC",
  "Narkoba": "NRK",
};

function cellColor(count: number, max: number): string {
  if (count === 0) return "transparent";
  const ratio = count / Math.max(max, 1);
  if (ratio >= 0.75) return "#c41e3a";
  if (ratio >= 0.5)  return "#ef4444";
  if (ratio >= 0.25) return "#f59e0b";
  return "#fbbf2455";
}

function cellTextColor(count: number, max: number): string {
  if (count === 0) return "var(--text-muted)";
  const ratio = count / Math.max(max, 1);
  return ratio >= 0.25 ? "#fff" : "#fbbf24";
}

export default function TopicHeatmap() {
  const { period } = usePeriod();
  const [data, setData] = useState<{
    topics: string[];
    regions: string[];
    matrix: Record<string, Record<string, number>>;
    max: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch(`${API}/api/news/heatmap?period=${period}`, { cache: "no-store" });
      setData(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <div className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div className="card-title">🗺 Heat Map Topik × Wilayah</div>

      {loading ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", textAlign: "center", paddingTop: 24 }}>
          Memuat data...
        </div>
      ) : !data ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", textAlign: "center", paddingTop: 24 }}>
          Gagal memuat data
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "22%" }} />
              {data.topics.map(t => <col key={t} style={{ width: `${78 / data.topics.length}%` }} />)}
            </colgroup>
            <thead>
              <tr>
                <th style={{
                  fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-muted)",
                  textAlign: "left", paddingBottom: 6, letterSpacing: ".1em"
                }}>WILAYAH</th>
                {data.topics.map(topic => (
                  <th key={topic} title={topic} style={{
                    fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-secondary)",
                    textAlign: "center", paddingBottom: 6, letterSpacing: ".06em",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {TOPIC_SHORT[topic] ?? topic}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.regions.map((region, ri) => {
                const rowData = data.matrix[region] ?? {};
                const rowTotal = Object.values(rowData).reduce((s, v) => s + v, 0);
                return (
                  <tr key={region} style={{ borderTop: "1px solid #1a2236" }}>
                    <td style={{
                      fontFamily: "var(--font-mono)", fontSize: 8, color: rowTotal > 0 ? "#e2e8f0" : "var(--text-muted)",
                      paddingRight: 4, paddingTop: 4, paddingBottom: 4,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      fontWeight: rowTotal > 0 ? 600 : 400,
                    }}>
                      {region}
                    </td>
                    {data.topics.map(topic => {
                      const count = rowData[topic] ?? 0;
                      return (
                        <td key={topic} title={`${region} — ${topic}: ${count}`} style={{
                          textAlign: "center",
                          padding: "3px 2px",
                        }}>
                          <div style={{
                            background: cellColor(count, data.max),
                            borderRadius: 2,
                            padding: "2px 0",
                            fontFamily: "var(--font-mono)",
                            fontSize: 8,
                            fontWeight: 700,
                            color: cellTextColor(count, data.max),
                            minHeight: 18,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}>
                            {count > 0 ? count : "·"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          {/* Legenda — fix di bawah, tidak ikut scroll */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, paddingTop: 6, borderTop: "1px solid #1a2236", flexShrink: 0 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-muted)", letterSpacing: ".1em" }}>INTENSITAS:</span>
            {[
              { color: "#fbbf2455", label: "Rendah" },
              { color: "#f59e0b",   label: "Sedang" },
              { color: "#ef4444",   label: "Tinggi" },
              { color: "#c41e3a",   label: "Kritis" },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-muted)" }}>{label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
