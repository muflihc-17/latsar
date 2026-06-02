"use client";
import { useEffect, useState } from "react";
import { getNewsProfiling, analyzeNewsDeep } from "@/lib/api";

interface ProfilingModalProps {
  newsId: string;
  onClose: () => void;
}

const categoryColors: Record<string, string> = {
  "Keamanan & Kamtibmas":        "#c41e3a",
  "Bencana Alam & Lingkungan":   "#f59e0b",
  "Konflik Sosial & Demonstrasi": "#ef4444",
  "Politik & Pemerintahan":      "#8b5cf6",
  "Ekonomi & Infrastruktur":     "#3b82f6",
  "Program Pemerintah & MBG":    "#06b6d4",
  "Isu Internal TNI":            "#ec4899",
  "Oknum & Penyimpangan Aparat": "#f97316",
  "Kesehatan & Kemanusiaan":     "#10b981",
  "Lainnya":                     "#4a5568",
};

const threatLevelData = (level: number) => {
  if (level >= 5) return { color: "#f87171", label: "KRITIS",      width: "100%" };
  if (level === 4) return { color: "#fb923c", label: "TINGGI",     width: "80%"  };
  if (level === 3) return { color: "#fbbf24", label: "SEDANG",     width: "60%"  };
  if (level === 2) return { color: "#a3e635", label: "SEDANG-RENDAH", width: "40%" };
  return               { color: "#34d399", label: "RENDAH",        width: "20%"  };
};

export default function ProfilingModal({ newsId, onClose }: ProfilingModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState("");

  const loadProfiling = (id: string) => {
    setLoading(true);
    setError("");
    getNewsProfiling(id)
      .then(setData)
      .catch(() => setError("Gagal memuat data berita."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProfiling(newsId); }, [newsId]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeMsg("🧠 Menganalisis... harap tunggu (15-60 detik)");
    try {
      await analyzeNewsDeep(newsId);
      setAnalyzeMsg("✅ Analisis selesai! Memuat hasil...");
      setTimeout(() => {
        setAnalyzeMsg("");
        loadProfiling(newsId);
      }, 1000);
    } catch {
      setAnalyzeMsg("❌ Analisis gagal. Coba lagi.");
      setTimeout(() => setAnalyzeMsg(""), 3000);
    } finally {
      setAnalyzing(false);
    }
  };

  const isValidUrl = (url?: string) =>
    !!url && url.startsWith("http") && !url.includes("news.google.com");

  const catColor = data ? (categoryColors[data.category] || "#4a5568") : "#4a5568";
  const isPending = data?.profiling_status === "pending" || data?.profiling_status === "failed";

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div style={{
        background: "#0b0f17", border: "1px solid #1a2236",
        borderTop: `3px solid ${catColor}`,
        borderRadius: 8, width: "100%", maxWidth: 700,
        maxHeight: "90vh", display: "flex", flexDirection: "column",
        boxShadow: "0 30px 80px rgba(0,0,0,0.85)",
        overflow: "hidden",
      }}>

        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderBottom: "1px solid #1a2236",
          background: "#080a10", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: ".15em", color: "#e2e8f0" }}>
              🔍 DETAIL ANCAMAN
            </span>
            {data && (
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 8px",
                borderRadius: 2, background: `${catColor}22`, color: catColor, border: `1px solid ${catColor}44`,
              }}>
                {data.category}
              </span>
            )}
            {data && (
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 8px", borderRadius: 2,
                background: isPending ? "#f59e0b22" : "#10b98122",
                color: isPending ? "#fbbf24" : "#34d399",
                border: `1px solid ${isPending ? "#f59e0b44" : "#10b98144"}`,
              }}>
                {isPending ? "🔬 BELUM DIPROFILE" : "⚡ SUDAH DIPROFILE"}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "#ffffff0a", border: "1px solid #1a2236",
              color: "#7a8899", cursor: "pointer", fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#c41e3a33"; (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#ffffff0a"; (e.currentTarget as HTMLButtonElement).style.color = "#7a8899"; }}
          >
            ✕
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ overflowY: "auto", flex: 1, padding: 18 }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ height: i === 0 ? 40 : 20, width: `${90 - i * 8}%`, background: "#ffffff08", borderRadius: 3, animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : error ? (
            <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "#f87171", textAlign: "center", padding: "24px 0" }}>
              {error}
            </div>
          ) : data && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Judul & Meta */}
              <div>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.5, marginBottom: 8 }}>
                  {data.title}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {[
                    { icon: "📍", v: data.region },
                    { icon: "📰", v: data.source },
                    { icon: "📅", v: data.published_at ? new Date(data.published_at).toLocaleString("id-ID") : "—" },
                  ].map((m, i) => (
                    <span key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-secondary)", display: "flex", gap: 3 }}>
                      {m.icon} {m.v}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ height: 1, background: "#1a2236" }} />

              {/* ─── STATE 1: PENDING — Tampilkan tombol Analisa AI ─── */}
              {isPending && (
                <div style={{
                  padding: 20, textAlign: "center",
                  background: "#f59e0b08", border: "1px solid #f59e0b22",
                  borderLeft: "3px solid #f59e0b", borderRadius: 4,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🔬</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "#fbbf24", marginBottom: 6 }}>
                    Belum Ada Analisis Mendalam
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
                    Berita ini baru terdeteksi sebagai ancaman (kategori: {data.category}).<br />
                    Klik tombol di bawah untuk memulai profiling intelijen mendalam oleh AI.
                  </div>

                  {analyzeMsg && (
                    <div style={{
                      fontFamily: "var(--font-mono)", fontSize: 10, marginBottom: 12,
                      color: analyzeMsg.startsWith("✅") ? "#34d399" : analyzeMsg.startsWith("❌") ? "#f87171" : "#fbbf24",
                    }}>
                      {analyzeMsg}
                    </div>
                  )}

                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: 11, padding: "10px 24px",
                      borderRadius: 4, cursor: analyzing ? "not-allowed" : "pointer",
                      background: analyzing ? "#1a2236" : "linear-gradient(135deg, #c41e3a, #e8234a)",
                      color: analyzing ? "var(--text-muted)" : "#fff",
                      border: `1px solid ${analyzing ? "var(--border)" : "#c41e3a"}`,
                      letterSpacing: ".1em", fontWeight: 700,
                      transition: "all .2s",
                      boxShadow: analyzing ? "none" : "0 0 20px rgba(196,30,58,0.3)",
                    }}
                  >
                    {analyzing ? "⏳ MENGANALISIS..." : "🧠 ANALISA AI SEKARANG"}
                  </button>

                  {analyzing && (
                    <div style={{ marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>
                      Proses scraping + analisis AI biasanya 15-60 detik
                    </div>
                  )}
                </div>
              )}

              {/* ─── STATE 2: COMPLETE — Tampilkan hasil profiling ─── */}
              {!isPending && (
                <>
                  {/* Threat Level Bar */}
                  {data.threat_level && (() => {
                    const tld = threatLevelData(data.threat_level);
                    return (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: ".1em" }}>
                            TINGKAT ANCAMAN
                          </span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: tld.color }}>
                            {data.threat_level}/5 — {tld.label}
                          </span>
                        </div>
                        <div style={{ height: 6, background: "#1a2236", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: tld.width, background: tld.color, borderRadius: 3, transition: "width 0.5s ease" }} />
                        </div>
                        {data.threat_type && (
                          <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 9, color: tld.color }}>
                            ⚠️ {data.threat_type}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div style={{ height: 1, background: "#1a2236" }} />

                  {/* Fakta */}
                  {data.facts?.length > 0 && (
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: ".12em", color: "#93c5fd", marginBottom: 8 }}>
                        📋 FAKTA-FAKTA
                      </div>
                      <ul style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 0, listStyle: "none" }}>
                        {data.facts.map((fact: string, i: number) => (
                          <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#93c5fd", marginTop: 2, flexShrink: 0 }}>
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "#c8d4e0", lineHeight: 1.5 }}>
                              {fact}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Eskalasi & Rekomendasi */}
                  {(data.escalation_potential || data.recommended_action) && (
                    <>
                      <div style={{ height: 1, background: "#1a2236" }} />
                      <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: ".12em", color: "#f87171", marginBottom: 8 }}>
                          ⚠️ ANALISIS ANCAMAN
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {data.escalation_potential && (
                            <div>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: ".1em", marginBottom: 4 }}>
                                ANALISIS
                              </div>
                              <p style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "#c8d4e0", lineHeight: 1.6, padding: "8px 10px", background: "#f59e0b11", borderLeft: "2px solid #f59e0b55", borderRadius: "0 3px 3px 0" }}>
                                {data.escalation_potential}
                              </p>
                            </div>
                          )}
                          {data.recommended_action && (
                            <div>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: ".1em", marginBottom: 4 }}>
                                REKOMENDASI TINDAKAN
                              </div>
                              <p style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "#c8d4e0", lineHeight: 1.6, padding: "8px 10px", background: "#c41e3a11", borderLeft: "2px solid #c41e3a55", borderRadius: "0 3px 3px 0" }}>
                                {data.recommended_action}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Entitas */}
                  {data.entities && (
                    <>
                      <div style={{ height: 1, background: "#1a2236" }} />
                      <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: ".12em", color: "#a78bfa", marginBottom: 8 }}>
                          🗺 ENTITAS TERLIBAT
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {[
                            { icon: "📍", label: "Lokasi", items: data.entities.locations },
                            { icon: "👤", label: "Tokoh", items: data.entities.persons },
                            { icon: "🏛", label: "Organisasi", items: data.entities.organizations },
                          ].map(row => {
                            if (!row.items?.length) return null;
                            return (
                              <div key={row.label} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", minWidth: 80, marginTop: 1 }}>
                                  {row.icon} {row.label}
                                </span>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                  {row.items.map((item: string, i: number) => (
                                    <span key={i} style={{ fontFamily: "var(--font-display)", fontSize: 11, padding: "2px 6px", borderRadius: 2, background: "#ffffff08", color: "#c8d4e0", border: "1px solid #1a2236" }}>
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Keywords */}
                  {data.keywords?.length > 0 && (
                    <>
                      <div style={{ height: 1, background: "#1a2236" }} />
                      <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: ".12em", color: "#34d399", marginBottom: 8 }}>
                          🔠 KATA KUNCI
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {data.keywords.map((kw: string, i: number) => (
                            <span key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 8px", borderRadius: 2, background: "#34d39922", color: "#34d399", border: "1px solid #34d39944" }}>
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {!loading && !error && data && (
          <div style={{ padding: "12px 18px", borderTop: "1px solid #1a2236", background: "#080a10", display: "flex", gap: 8, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
            {!isPending && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                title="Jalankan ulang analisis AI"
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, padding: "4px 10px", borderRadius: 2,
                  background: "#f59e0b22", color: "#fbbf24", border: "1px solid #f59e0b44",
                  cursor: analyzing ? "not-allowed" : "pointer", letterSpacing: ".08em",
                }}
              >
                {analyzing ? "⏳ LOADING..." : "🔄 RE-ANALISIS"}
              </button>
            )}
            <div style={{ flex: 1 }} />
            {isValidUrl(data.url) ? (
              <a
                href={data.url} target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: "var(--font-mono)", fontSize: 9, padding: "4px 10px", borderRadius: 2, background: "#3b82f622", color: "#93c5fd", border: "1px solid #3b82f644", textDecoration: "none", letterSpacing: ".08em" }}
              >
                🔗 ARTIKEL ASLI
              </a>
            ) : (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, padding: "4px 10px", borderRadius: 2, background: "#ffffff08", color: "#3d4d61", border: "1px solid var(--border)", letterSpacing: ".08em", cursor: "not-allowed" }}>
                🔗 URL TIDAK TERSEDIA
              </span>
            )}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-muted)" }}>
              {data.profiled_at
                ? `Diprofile: ${new Date(data.profiled_at).toLocaleString("id-ID")}`
                : `Dianalisis: ${data.analyzed_at ? new Date(data.analyzed_at).toLocaleString("id-ID") : "—"}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
