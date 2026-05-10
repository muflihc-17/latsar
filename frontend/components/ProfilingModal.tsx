"use client";
import { useEffect, useState } from "react";
import { getNewsProfiling, reanalyzeNews, overrideSentiment } from "@/lib/api";

interface ProfilingModalProps {
  newsId: string;
  onClose: () => void;
}

const sentimentStyle: Record<string, { color: string; bg: string; border: string; label: string }> = {
  positif: { color: "#4ade80", bg: "#1db95422", border: "#1db95455", label: "POSITIF" },
  netral:  { color: "#93c5fd", bg: "#3b82f622", border: "#3b82f655", label: "NETRAL"  },
  negatif: { color: "#f87171", bg: "#c41e3a22", border: "#c41e3a55", label: "NEGATIF" },
};

const threatLevelColor = (level: number) => {
  if (level >= 8) return "#c41e3a";
  if (level >= 5) return "#f59e0b";
  return "#4ade80";
};

const threatLevelLabel = (level: number) => {
  if (level >= 8) return "TINGGI";
  if (level >= 5) return "SEDANG";
  return "RENDAH";
};

export default function ProfilingModal({ newsId, onClose }: ProfilingModalProps) {
  const [data, setData]               = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [actionLoading, setActionLoading] = useState(""); // "reanalyze" | "override" | ""
  const [actionMsg, setActionMsg]     = useState("");

  const loadProfiling = (id: string) => {
    setLoading(true);
    setError("");
    getNewsProfiling(id)
      .then(setData)
      .catch(() => setError("Gagal memuat profiling. Silakan coba lagi."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProfiling(newsId); }, [newsId]);

  const handleReanalyze = async () => {
    setActionLoading("reanalyze");
    setActionMsg("");
    try {
      await reanalyzeNews(newsId);
      setActionMsg("✅ Re-analisis selesai. Memuat ulang data...");
      setTimeout(() => loadProfiling(newsId), 800);
    } catch {
      setActionMsg("❌ Re-analisis gagal. Coba lagi.");
    } finally {
      setActionLoading("");
    }
  };

  const handleOverride = async (sentiment: "positif" | "netral" | "negatif") => {
    setActionLoading("override");
    setActionMsg("");
    try {
      await overrideSentiment(newsId, sentiment);
      setActionMsg(`✅ Sentimen diubah ke "${sentiment}". Memuat ulang...`);
      setTimeout(() => loadProfiling(newsId), 800);
    } catch {
      setActionMsg("❌ Override gagal. Coba lagi.");
    } finally {
      setActionLoading("");
    }
  };

  // Tutup saat klik backdrop
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Tutup dengan Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const sent = data ? (sentimentStyle[data.sentiment] || sentimentStyle.netral) : null;

  /** URL valid jika ada, bukan Google redirect, dan diawali http */
  const isValidArticleUrl = (url?: string) =>
    !!url && url.startsWith("http") && !url.includes("news.google.com");

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div style={{
        background: "#0d1117",
        border: "1px solid #1c2535",
        borderRadius: 6,
        width: "100%", maxWidth: 680,
        maxHeight: "90vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 25px 60px rgba(0,0,0,0.8)",
        overflow: "hidden",
      }}>
        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid #1c2535",
          background: "#080b0f",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
              letterSpacing: ".15em", color: "#e2e8f0",
            }}>
              🔍 ANALISA BERITA
            </span>
            {sent && (
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 8px",
                borderRadius: 2, background: sent.bg, color: sent.color, border: `1px solid ${sent.border}`,
              }}>
                {sent.label}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "#ffffff0a", border: "1px solid #2a3545",
              color: "#8892a0", cursor: "pointer", fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all .15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "#c41e3a33";
              (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "#ffffff0a";
              (e.currentTarget as HTMLButtonElement).style.color = "#8892a0";
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Body (scrollable) ── */}
        <div style={{ overflowY: "auto", flex: 1, padding: "18px" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{
                  height: i === 0 ? 40 : 20, width: `${90 - i * 8}%`,
                  background: "#ffffff08", borderRadius: 3,
                  animation: "pulse 1.5s ease-in-out infinite",
                }} />
              ))}
            </div>
          ) : error ? (
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 13, color: "#f87171",
              textAlign: "center", padding: "24px 0",
            }}>
              {error}
            </div>
          ) : data && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* ── Judul & Meta ── */}
              <div>
                <p style={{
                  fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700,
                  color: "#e2e8f0", lineHeight: 1.5, marginBottom: 8,
                }}>
                  {data.title}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <MetaTag icon="📍" value={data.region} />
                  <MetaTag icon="🏷" value={data.category} />
                  <MetaTag icon="📰" value={data.source} />
                  {data.published_at && (
                    <MetaTag icon="📅" value={new Date(data.published_at).toLocaleString("id-ID")} />
                  )}
                </div>
              </div>

              <Divider />

              {/* ── Fakta-Fakta ── */}
              <Section title="📋 FAKTA-FAKTA" color="#93c5fd">
                {data.facts?.length > 0 ? (
                  <ul style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 0, listStyle: "none" }}>
                    {data.facts.map((fact: string, i: number) => (
                      <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: 9, color: "#93c5fd",
                          marginTop: 2, flexShrink: 0,
                        }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "#c8d4e0", lineHeight: 1.5 }}>
                          {fact}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyText text="Tidak ada fakta tersedia" />
                )}
              </Section>

              {/* ── Analisis Ancaman (hanya negatif) ── */}
              {data.sentiment === "negatif" && (
                <>
                  <Divider />
                  <Section title="⚠️ ANALISIS ANCAMAN" color="#f87171">
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>


                      {/* Jenis Ancaman */}
                      {data.threat_type && (
                        <InfoRow label="JENIS ANCAMAN" value={data.threat_type} valueColor="#fbbf24" />
                      )}

                      {/* Potensi Eskalasi */}
                      {data.escalation_potential && (
                        <div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: ".1em", marginBottom: 4 }}>
                            POTENSI ESKALASI
                          </div>
                          <p style={{
                            fontFamily: "var(--font-display)", fontSize: 13, color: "#c8d4e0",
                            lineHeight: 1.6, padding: "8px 10px",
                            background: "#f59e0b11", borderLeft: "2px solid #f59e0b55",
                            borderRadius: "0 3px 3px 0",
                          }}>
                            {data.escalation_potential}
                          </p>
                        </div>
                      )}

                      {/* Rekomendasi */}
                      {data.recommended_action && (
                        <div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: ".1em", marginBottom: 4 }}>
                            REKOMENDASI TINDAKAN
                          </div>
                          <p style={{
                            fontFamily: "var(--font-display)", fontSize: 13, color: "#c8d4e0",
                            lineHeight: 1.6, padding: "8px 10px",
                            background: "#c41e3a11", borderLeft: "2px solid #c41e3a55",
                            borderRadius: "0 3px 3px 0",
                          }}>
                            {data.recommended_action}
                          </p>
                        </div>
                      )}
                    </div>
                  </Section>
                </>
              )}

              <Divider />

              {/* ── Entitas ── */}
              <Section title="🗺 ENTITAS TERLIBAT" color="#a78bfa">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <EntitasRow icon="📍" label="Lokasi" items={data.entities?.locations} />
                  <EntitasRow icon="👤" label="Tokoh" items={data.entities?.persons} />
                  <EntitasRow icon="🏛" label="Organisasi" items={data.entities?.organizations} />
                </div>
              </Section>

              {/* ── Kata Kunci ── */}
              {data.keywords?.length > 0 && (
                <>
                  <Divider />
                  <Section title="🔠 KATA KUNCI" color="#34d399">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {data.keywords.map((kw: string, i: number) => (
                        <span key={i} style={{
                          fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 8px",
                          borderRadius: 2, background: "#34d39922", color: "#34d399",
                          border: "1px solid #34d39944",
                        }}>
                          {kw}
                        </span>
                      ))}
                    </div>
                  </Section>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {!loading && !error && data && (
          <div style={{
            padding: "12px 18px",
            borderTop: "1px solid #1c2535",
            background: "#080b0f",
            display: "flex", flexDirection: "column", gap: 8,
            flexShrink: 0,
          }}>
            {/* Action message */}
            {actionMsg && (
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                color: actionMsg.startsWith("✅") ? "#4ade80" : "#f87171",
                textAlign: "center", padding: "4px 0",
              }}>
                {actionMsg}
              </div>
            )}

            {/* Override sentimen */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: ".08em" }}>
                OVERRIDE:
              </span>
              {(["positif", "netral", "negatif"] as const).map((s) => {
                const colors = {
                  positif: { bg: "#1db95422", color: "#4ade80", border: "#1db95455" },
                  netral:  { bg: "#3b82f622", color: "#93c5fd", border: "#3b82f655" },
                  negatif: { bg: "#c41e3a22", color: "#f87171", border: "#c41e3a55" },
                }[s];
                const isActive = data.sentiment === s;
                return (
                  <button
                    key={s}
                    disabled={actionLoading !== "" || isActive}
                    onClick={() => handleOverride(s)}
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: 9, padding: "4px 10px",
                      borderRadius: 2, background: isActive ? colors.bg : "#ffffff08",
                      color: isActive ? colors.color : "var(--text-muted)",
                      border: `1px solid ${isActive ? colors.border : "#2a3545"}`,
                      cursor: isActive ? "default" : "pointer",
                      transition: "all .15s", opacity: actionLoading !== "" ? 0.5 : 1,
                      letterSpacing: ".08em", textTransform: "uppercase",
                    }}
                  >
                    {s}
                  </button>
                );
              })}

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Re-analisis tombol */}
              <button
                disabled={actionLoading !== ""}
                onClick={handleReanalyze}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, padding: "4px 10px",
                  borderRadius: 2,
                  background: actionLoading === "reanalyze" ? "#f59e0b33" : "#f59e0b22",
                  color: "#fbbf24", border: "1px solid #f59e0b55",
                  cursor: actionLoading !== "" ? "not-allowed" : "pointer",
                  transition: "all .15s", opacity: actionLoading !== "" ? 0.6 : 1,
                  letterSpacing: ".08em",
                }}
              >
                {actionLoading === "reanalyze" ? "⏳ LOADING..." : "🔄 RE-ANALISIS AI"}
              </button>

              {/* Buka artikel */}
              {isValidArticleUrl(data.url) ? (
                <a
                  href={data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: 9, padding: "4px 10px",
                    borderRadius: 2, background: "#3b82f622", color: "#93c5fd",
                    border: "1px solid #3b82f655", textDecoration: "none",
                    letterSpacing: ".08em", transition: "all .15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#3b82f633")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#3b82f622")}
                >
                  🔗 ARTIKEL ASLI
                </a>
              ) : (
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, padding: "4px 10px",
                  borderRadius: 2, background: "#ffffff08", color: "#4a5568",
                  border: "1px solid #2a3545", letterSpacing: ".08em",
                  cursor: "not-allowed",
                }}>
                  🔗 URL TIDAK TERSEDIA
                </span>
              )}
            </div>

            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>
              Dianalisis: {data.analyzed_at ? new Date(data.analyzed_at).toLocaleString("id-ID") : "-"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
        letterSpacing: ".12em", color, marginBottom: 10,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#1c2535" }} />;
}

function MetaTag({ icon, value }: { icon: string; value: string }) {
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-secondary)",
      display: "flex", alignItems: "center", gap: 3,
    }}>
      {icon} {value}
    </span>
  );
}

function InfoRow({ label, value, valueColor = "#e2e8f0" }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: ".1em" }}>
        {label}
      </span>
      <span style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 600, color: valueColor }}>
        {value}
      </span>
    </div>
  );
}

function EntitasRow({ icon, label, items }: { icon: string; label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", minWidth: 80, marginTop: 1 }}>
        {icon} {label}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {items.map((item: string, i: number) => (
          <span key={i} style={{
            fontFamily: "var(--font-display)", fontSize: 12, padding: "2px 6px",
            borderRadius: 2, background: "#ffffff08", color: "#c8d4e0",
            border: "1px solid #2a3545",
          }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <p style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
      {text}
    </p>
  );
}
