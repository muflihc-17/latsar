"use client";
import { useEffect, useState, useRef } from "react";
import { getNews } from "@/lib/api";
import { usePeriod } from "@/lib/PeriodContext";
import ProfilingModal from "@/components/ProfilingModal";

const CATEGORIES = [
  "MBG",
  "KDMP",
  "Jembatan Garuda",
  "TNI",
  "Politik & Korupsi",
  "Demo & Konsolidasi",
  "Bencana Alam",
  "Narkoba",
];

const categoryColors: Record<string, string> = {
  "MBG": "#06b6d4",
  "KDMP": "#10b981",
  "Jembatan Garuda": "#3b82f6",
  "TNI": "#ec4899",
  "Politik & Korupsi": "#8b5cf6",
  "Demo & Konsolidasi": "#ef4444",
  "Bencana Alam": "#f59e0b",
  "Narkoba": "#c41e3a",
};

const threatLevelColor = (level: number | null) => {
  if (!level) return "#3d4d61";
  if (level >= 4) return "#f87171";
  if (level === 3) return "#fbbf24";
  return "#a3e635";
};

const PAGE_SIZE = 20;

export default function NewsFeed() {
  const { period } = usePeriod();
  const [news, setNews] = useState<any[]>([]);
  const [filterCat, setFilterCat] = useState("SEMUA");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadNews = async (reset = false) => {
    try {
      const currentSkip = reset ? 0 : skip;
      if (reset) setLoading(true);
      else setLoadingMore(true);

      const data = await getNews({
        category: filterCat !== "SEMUA" ? filterCat : undefined,
        limit: PAGE_SIZE,
        skip: currentSkip,
        period,
      });

      if (reset) {
        setNews(data);
        setSkip(PAGE_SIZE);
        setNewCount(0);
      } else {
        setNews(prev => [...prev, ...data]);
        setSkip(prev => prev + PAGE_SIZE);
      }
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const silentRefresh = async () => {
    try {
      setRefreshing(true);
      const data = await getNews({
        category: filterCat !== "SEMUA" ? filterCat : undefined,
        limit: PAGE_SIZE,
        skip: 0,
        period,
      });

      setNews(prev => {
        if (prev.length === 0) return data;
        const existingIds = new Set(prev.map((n: any) => n.id));
        const brandNew = data.filter((n: any) => !existingIds.has(n.id));
        if (brandNew.length === 0) return prev;

        const el = scrollRef.current;
        const prevScrollTop = el?.scrollTop ?? 0;
        const prevScrollHeight = el?.scrollHeight ?? 0;
        setNewCount(c => c + brandNew.length);

        setTimeout(() => {
          if (el && prevScrollTop > 0) {
            el.scrollTop = prevScrollTop + (el.scrollHeight - prevScrollHeight);
          }
        }, 0);

        return [...brandNew, ...prev];
      });
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  };

  useEffect(() => {
    setSkip(0); setHasMore(true); setNewCount(0);
    loadNews(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCat, period]);

  useEffect(() => {
    const id = setInterval(silentRefresh, 15_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCat, period]);

  return (
    <>
      {selectedId && (
        <ProfilingModal newsId={selectedId} onClose={() => setSelectedId(null)} />
      )}

      <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <div className="card-title">
          🚨 Feed Ancaman
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            {refreshing && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", animation: "spin 1s linear infinite" }}>↻</span>
            )}
            {newCount > 0 && (
              <span
                onClick={() => setNewCount(0)}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 7px",
                  borderRadius: 10, background: "#c41e3a22", color: "#f87171",
                  border: "1px solid #c41e3a44", cursor: "pointer",
                  animation: "pulse 2s ease-in-out infinite",
                }}
              >
                +{newCount} baru ✕
              </span>
            )}
            <span className="badge badge-neg">{news.length} insiden</span>
          </div>
        </div>

        {/* Filter kategori */}
        <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
          {["SEMUA", ...CATEGORIES].map(cat => {
            const color = categoryColors[cat] || "var(--text-muted)";
            const isActive = filterCat === cat;
            return (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 8, padding: "2px 7px",
                  borderRadius: 2, cursor: "pointer", letterSpacing: ".06em",
                  background: isActive ? (cat === "SEMUA" ? "#c41e3a" : `${color}33`) : "#ffffff08",
                  color: isActive ? (cat === "SEMUA" ? "#fff" : color) : "var(--text-muted)",
                  border: `1px solid ${isActive ? (cat === "SEMUA" ? "#c41e3a" : `${color}66`) : "var(--border)"}`,
                  transition: "all .15s",
                }}
              >
                {cat === "SEMUA" ? "SEMUA" : cat.split("&")[0].trim()}
              </button>
            );
          })}
        </div>

        <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-muted)", marginBottom: 8 }}>
          💡 Klik berita untuk detail · 🔬 = belum dianalisis AI · ⚡ = sudah diprofile
        </div>

        <div
          ref={scrollRef}
          style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, overflowY: "auto", height: "100%" }}
        >
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{
                padding: "10px 12px", background: "#ffffff05",
                border: "1px solid var(--border)", borderLeft: "3px solid #1a2236",
                borderRadius: 3, animation: "pulse 1.5s ease-in-out infinite",
                opacity: 1 - i * 0.1,
              }}>
                <div style={{ height: 13, width: `${70 + (i % 3) * 10}%`, background: "#ffffff10", borderRadius: 2, marginBottom: 6 }} />
                <div style={{ height: 9, width: "40%", background: "#ffffff08", borderRadius: 2 }} />
              </div>
            ))
          ) : news.length === 0 ? (
            <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-muted)", padding: 16, textAlign: "center" }}>
              Belum ada berita negatif terdeteksi pada periode ini.
            </div>
          ) : (
            <>
              {news.map((n: any, i: number) => {
                const catColor = categoryColors[n.category] || "#4a5568";
                const isPending = n.profiling_status === "pending";
                return (
                  <div
                    key={n.id ?? i}
                    onClick={() => setSelectedId(n.id)}
                    style={{
                      display: "block", padding: "9px 12px",
                      background: "#ffffff04",
                      border: "1px solid var(--border)",
                      borderLeft: `3px solid ${catColor}`,
                      borderRadius: 3, cursor: "pointer",
                      transition: "background .15s",
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#ffffff0c"}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "#ffffff04"}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.4 }}>
                        {n.title}
                      </span>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                        {/* Profiling status badge */}
                        <span title={isPending ? "Belum dianalisis AI" : "Sudah diprofile"} style={{ fontSize: 12 }}>
                          {isPending ? "🔬" : "⚡"}
                        </span>
                        {/* Threat level indicator */}
                        {n.threat_level && (
                          <span style={{
                            fontFamily: "var(--font-mono)", fontSize: 9, padding: "1px 5px",
                            borderRadius: 2, background: `${threatLevelColor(n.threat_level)}22`,
                            color: threatLevelColor(n.threat_level),
                            border: `1px solid ${threatLevelColor(n.threat_level)}44`,
                          }}>
                            L{n.threat_level}
                          </span>
                        )}
                        <a
                          href={n.url} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{
                            fontFamily: "var(--font-mono)", fontSize: 9,
                            padding: "2px 5px", borderRadius: 2,
                            background: "#ffffff08", color: "var(--text-muted)",
                            border: "1px solid var(--border)", textDecoration: "none",
                          }}
                        >
                          🔗
                        </a>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-muted)" }}>
                        {n.published_at ? new Date(n.published_at).toLocaleString("id-ID") : "—"}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-secondary)" }}>
                        {n.source}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: catColor }}>
                        📍 {n.region}
                      </span>
                      {n.category && (
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: 8, padding: "1px 5px",
                          borderRadius: 2, background: `${catColor}22`, color: catColor,
                        }}>
                          {n.category}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {hasMore && (
                <button
                  onClick={() => loadNews(false)}
                  disabled={loadingMore}
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: 10, padding: "8px",
                    borderRadius: 2, cursor: loadingMore ? "not-allowed" : "pointer",
                    background: "#ffffff08", color: "var(--text-secondary)",
                    border: "1px solid var(--border)", letterSpacing: ".08em", marginTop: 4,
                  }}
                >
                  {loadingMore ? "⏳ MEMUAT..." : "⬇ LOAD MORE"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
