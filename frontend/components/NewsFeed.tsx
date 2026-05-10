"use client";
import { useEffect, useState, useRef } from "react";
import { getNews } from "@/lib/api";
import { usePeriod } from "@/lib/PeriodContext";
import ProfilingModal from "@/components/ProfilingModal";

const sentimentMap: Record<string, { cls: string; label: string }> = {
  positif: { cls: "badge-pos", label: "POSITIF" },
  netral:  { cls: "badge-neu", label: "NETRAL"  },
  negatif: { cls: "badge-neg", label: "NEGATIF" },
};

const categoryColors: Record<string, string> = {
  "Keamanan & Kamtibmas":      "#c41e3a",
  "Bencana Alam & Lingkungan": "#f59e0b",
  "Konflik Sosial":            "#ef4444",
  "Politik & Pemerintahan":    "#8b5cf6",
  "Ekonomi & Infrastruktur":   "#3b82f6",
  "Kesehatan & Kemanusiaan":   "#1db954",
  "Lainnya":                   "#4a5568",
};

const PAGE_SIZE = 20;

export default function NewsFeed() {
  const { period }                    = usePeriod();
  const [news, setNews]               = useState<any[]>([]);
  const [filterSent, setFilterSent]   = useState("SEMUA");
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [skip, setSkip]               = useState(0);
  const [hasMore, setHasMore]         = useState(true);
  const [newCount, setNewCount]       = useState(0);
  const [refreshing, setRefreshing]   = useState(false);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const scrollRef                     = useRef<HTMLDivElement>(null);

  const loadNews = async (reset = false) => {
    try {
      const currentSkip = reset ? 0 : skip;
      if (reset) setLoading(true);
      else setLoadingMore(true);

      const sentiment = filterSent !== "SEMUA" ? filterSent.toLowerCase() : undefined;
      const data = await getNews({ sentiment, limit: PAGE_SIZE, skip: currentSkip, period });

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
      const sentiment = filterSent !== "SEMUA" ? filterSent.toLowerCase() : undefined;
      const data = await getNews({ sentiment, limit: PAGE_SIZE, skip: 0, period });

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
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setSkip(0);
    setHasMore(true);
    setNewCount(0);
    loadNews(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSent, period]);

  useEffect(() => {
    const id = setInterval(silentRefresh, 15_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSent, period]);

  return (
    <>
      {/* Profiling Modal */}
      {selectedId && (
        <ProfilingModal
          newsId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}

      <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 400 }}>
        <div className="card-title">
          📰 Feed Berita
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            {refreshing && (
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)",
                display: "inline-block", opacity: 0.6,
                animation: "spin 1s linear infinite",
              }}>↻</span>
            )}
            {newCount > 0 && (
              <span
                onClick={() => setNewCount(0)}
                title="Klik untuk sembunyikan"
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 7px",
                  borderRadius: 10, background: "#3b82f622", color: "#93c5fd",
                  border: "1px solid #3b82f655", cursor: "pointer",
                  animation: "pulse 2s ease-in-out infinite",
                }}
              >+{newCount} baru ✕</span>
            )}
            <span className="badge badge-neu">{news.length} berita</span>
          </div>
        </div>

        {/* Filter sentiment */}
        <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
          {["SEMUA", "POSITIF", "NETRAL", "NEGATIF"].map(s => (
            <button key={s} onClick={() => setFilterSent(s)} style={{
              fontFamily: "var(--font-mono)", fontSize: 9, padding: "3px 8px",
              borderRadius: 2, cursor: "pointer", letterSpacing: ".08em",
              background: filterSent === s ? "#c41e3a" : "#ffffff0a",
              color: filterSent === s ? "#fff" : "var(--text-secondary)",
              border: `1px solid ${filterSent === s ? "#c41e3a" : "var(--border)"}`,
              transition: "all .15s",
            }}>{s}</button>
          ))}
        </div>

        {/* Hint klik */}
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)",
          marginBottom: 8, letterSpacing: ".05em",
        }}>
          💡 Klik berita untuk melihat Analisa Berita
        </div>

        {/* List berita */}
        <div
          ref={scrollRef}
          style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, overflowY: "auto", maxHeight: 380 }}
        >
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{
                padding: "10px 12px", background: "#ffffff05",
                border: "1px solid var(--border)", borderLeft: "3px solid #ffffff15",
                borderRadius: 3, opacity: 1 - i * 0.15,
                animation: "pulse 1.5s ease-in-out infinite",
              }}>
                <div style={{ height: 13, width: `${70 + (i % 3) * 10}%`, background: "#ffffff10", borderRadius: 2, marginBottom: 6 }} />
                <div style={{ height: 9, width: "40%", background: "#ffffff08", borderRadius: 2 }} />
              </div>
            ))
          ) : news.length === 0 ? (
            <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-muted)", padding: 12, textAlign: "center" }}>
              Belum ada berita yang sudah dianalisis.
            </div>
          ) : (
            <>
              {news.map((n: any, i: number) => {
                const sent = sentimentMap[n.sentiment] || { cls: "badge-neu", label: "NETRAL" };
                const catColor = categoryColors[n.category] || "#4a5568";
                return (
                  <div
                    key={n.id ?? i}
                    onClick={() => setSelectedId(n.id)}
                    style={{
                      display: "block", padding: "10px 12px",
                      background: "#ffffff05",
                      border: "1px solid var(--border)",
                      borderLeft: `3px solid ${catColor}`,
                      borderRadius: 3,
                      cursor: "pointer",
                      transition: "background .15s, border-color .15s",
                      position: "relative",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.background = "#ffffff0d";
                      (e.currentTarget as HTMLDivElement).style.borderColor = catColor + "88";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.background = "#ffffff05";
                      (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                      (e.currentTarget as HTMLDivElement).style.borderLeftColor = catColor;
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.4 }}>
                        {n.title}
                      </span>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                        <span className={`badge ${sent.cls}`} style={{ whiteSpace: "nowrap" }}>{sent.label}</span>
                        {/* Tombol buka artikel langsung (kecil di pojok) */}
                        <a
                          href={n.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          title="Buka artikel asli"
                          style={{
                            fontFamily: "var(--font-mono)", fontSize: 9,
                            padding: "2px 5px", borderRadius: 2,
                            background: "#ffffff08", color: "var(--text-muted)",
                            border: "1px solid var(--border)", textDecoration: "none",
                            transition: "all .15s",
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLAnchorElement).style.color = "#93c5fd";
                            (e.currentTarget as HTMLAnchorElement).style.borderColor = "#3b82f655";
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)";
                            (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
                          }}
                        >
                          🔗
                        </a>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>
                        {n.published_at ? new Date(n.published_at).toLocaleString("id-ID") : "-"}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-secondary)" }}>{n.source}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: catColor }}>📍 {n.region}</span>
                      {n.category && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, padding: "1px 5px", borderRadius: 2, background: catColor + "22", color: catColor }}>
                          {n.category}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {hasMore && (
                <button onClick={() => loadNews(false)} disabled={loadingMore} style={{
                  fontFamily: "var(--font-mono)", fontSize: 10, padding: "8px",
                  borderRadius: 2, cursor: loadingMore ? "not-allowed" : "pointer",
                  background: "#ffffff08", color: "var(--text-secondary)",
                  border: "1px solid var(--border)", letterSpacing: ".08em", marginTop: 4,
                }}>
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
