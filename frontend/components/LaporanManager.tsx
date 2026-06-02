"use client";
import { useState, useEffect } from "react";
import { usePeriod } from "@/lib/PeriodContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Mode = "list" | "select_type" | "select_news" | "edit_report";
type ReportType = "pagi" | "malam";

const REPORT_TYPE_INFO = {
  pagi: {
    label: "Laporan Pagi",
    icon: "🌅",
    desc: "Patroli siber 17.00 (kemarin) s.d. 05.00 (hari ini)",
    detail: "Dilaporkan kepada Kasansidam pukul 04.00 – 05.00 WIB",
    color: "#f59e0b",
  },
  malam: {
    label: "Laporan Malam",
    icon: "🌙",
    desc: "Patroli siber 05.00 s.d. 17.00 (hari ini)",
    detail: "Dilaporkan kepada Kasansidam pukul 16.00 – 17.00 WIB",
    color: "#6366f1",
  },
};

export default function LaporanManager() {
  const { period } = usePeriod();
  const [mode, setMode] = useState<Mode>("list");
  const [reportType, setReportType] = useState<ReportType>("pagi");
  const [reports, setReports] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [draftContent, setDraftContent] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (mode === "list") fetchReports();
    if (mode === "select_news") fetchNews();
  }, [mode, period]);

  const fetchReports = async () => {
    try {
      const res = await fetch(`${API}/api/reports`);
      setReports(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchNews = async () => {
    try {
      const res = await fetch(`${API}/api/news/?limit=50&period=${period}`);
      setNews(await res.json());
    } catch (e) { console.error(e); }
  };

  const deleteReport = async (id: string) => {
    if (!confirm("Hapus laporan ini?")) return;
    try {
      await fetch(`${API}/api/reports/${id}`, { method: "DELETE" });
      fetchReports();
    } catch (e) { console.error(e); }
  };

  const handleSelectType = (type: ReportType) => {
    setReportType(type);
    setSelectedIds(new Set());
    setMode("select_news");
  };

  const handleGenerate = async () => {
    if (selectedIds.size === 0) return alert("Pilih minimal 1 berita!");
    setIsGenerating(true);
    setMode("edit_report");
    try {
      const res = await fetch(`${API}/api/reports/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ news_ids: Array.from(selectedIds), report_type: reportType })
      });
      const data = await res.json();
      setDraftId(data.id);
      setDraftTitle(data.title);
      setDraftContent(data.content);
    } catch (e) {
      console.error(e);
      alert("Gagal meng-generate laporan.");
      setMode("select_news");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!draftId) return;
    try {
      await fetch(`${API}/api/reports/${draftId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draftTitle, content: draftContent })
      });
      alert("Laporan disimpan!");
      setMode("list");
      setSelectedIds(new Set());
    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan.");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(draftContent);
    alert("Dicopy ke clipboard!");
  };

  const typeInfo = REPORT_TYPE_INFO[reportType];

  // ─── Breadcrumb helper ───
  const stepLabel = {
    list: "Daftar Laporan",
    select_type: "Pilih Jenis Laporan",
    select_news: `Pilih Berita — ${REPORT_TYPE_INFO[reportType].label}`,
    edit_report: `Edit Laporan — ${draftTitle || "..."}`,
  };

  return (
    <div style={{ padding: "24px 40px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", margin: 0 }}>Laporan Pimpinan</h2>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            {stepLabel[mode]}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {mode === "list" && (
            <button
              onClick={() => setMode("select_type")}
              style={{ padding: "8px 16px", background: "#c41e3a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "var(--font-mono)", fontWeight: 600 }}
            >
              + Buat Laporan Baru
            </button>
          )}
          {mode !== "list" && (
            <button
              onClick={() => setMode(mode === "select_news" ? "select_type" : mode === "edit_report" && !isGenerating ? "select_news" : "list")}
              style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 6, cursor: "pointer", fontFamily: "var(--font-mono)" }}
            >
              ← Kembali
            </button>
          )}
        </div>
      </div>

      {/* ── MODE: LIST ── */}
      {mode === "list" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reports.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              Belum ada laporan. Klik <strong>+ Buat Laporan Baru</strong> untuk memulai.
            </div>
          ) : (
            reports.map(r => {
              const isPagi = r.title?.toLowerCase().includes("pagi");
              const badgeColor = isPagi ? "#f59e0b" : "#6366f1";
              const badgeIcon = isPagi ? "🌅" : "🌙";
              return (
                <div key={r.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${badgeColor}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                      {badgeIcon}
                    </div>
                    <div>
                      <h3 style={{ margin: "0 0 4px 0", fontSize: 15 }}>{r.title}</h3>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>
                        Dibuat: {new Date(r.created_at).toLocaleString("id-ID")}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => {
                      setDraftId(r.id); setDraftTitle(r.title); setDraftContent(r.content); setMode("edit_report");
                    }} style={{ background: "#ffffff11", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11 }}>Lihat</button>
                    <button onClick={() => deleteReport(r.id)} style={{ background: "#c41e3a22", border: "none", color: "#f87171", padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11 }}>Hapus</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── MODE: PILIH JENIS LAPORAN ── */}
      {mode === "select_type" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)", margin: 0 }}>
            Pilih jenis laporan yang akan dibuat:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 640 }}>
            {(Object.entries(REPORT_TYPE_INFO) as [ReportType, typeof REPORT_TYPE_INFO.pagi][]).map(([key, info]) => (
              <button
                key={key}
                onClick={() => handleSelectType(key)}
                style={{
                  background: "#0d111d",
                  border: `2px solid ${info.color}44`,
                  borderRadius: 10,
                  padding: "28px 24px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = info.color)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = `${info.color}44`)}
              >
                <div style={{ fontSize: 32 }}>{info.icon}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "#e2e8f0", fontWeight: 700 }}>{info.label}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: info.color }}>{info.desc}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{info.detail}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── MODE: PILIH BERITA ── */}
      {mode === "select_news" && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
          {/* Badge tipe laporan */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>{typeInfo.icon}</span>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "#e2e8f0", fontWeight: 600 }}>{typeInfo.label}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: typeInfo.color }}>{typeInfo.desc}</div>
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={selectedIds.size === 0}
              style={{ padding: "8px 18px", background: selectedIds.size > 0 ? "#10b981" : "#1a2236", color: "#fff", border: "none", borderRadius: 6, cursor: selectedIds.size > 0 ? "pointer" : "not-allowed", fontFamily: "var(--font-mono)", fontWeight: 600 }}
            >
              Generate Laporan ({selectedIds.size})
            </button>
          </div>

          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
            Pilih berita yang akan dimasukkan ke dalam laporan:
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", flex: 1, paddingRight: 8 }}>
            {news.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                Tidak ada berita negatif pada periode ini.
              </div>
            ) : news.map(n => (
              <label key={n.id} style={{
                display: "flex", gap: 12, padding: 12,
                background: selectedIds.has(n.id) ? "#c41e3a11" : "#ffffff04",
                border: `1px solid ${selectedIds.has(n.id) ? "#c41e3a55" : "var(--border)"}`,
                borderRadius: 6, cursor: "pointer", transition: "all 0.15s"
              }}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(n.id)}
                  onChange={e => {
                    const newSet = new Set(selectedIds);
                    if (e.target.checked) newSet.add(n.id);
                    else newSet.delete(n.id);
                    setSelectedIds(newSet);
                  }}
                  style={{ marginTop: 4, accentColor: "#c41e3a" }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 13, marginBottom: 4 }}>{n.title}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>
                    {n.region} • {n.category} • {new Date(n.crawled_at).toLocaleString("id-ID")}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── MODE: EDIT LAPORAN ── */}
      {mode === "edit_report" && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
          {isGenerating ? (
            <div style={{ textAlign: "center", padding: 60, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
              Sedang generate laporan dan analisa AI...<br />
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, display: "block" }}>Proses ini bisa memakan waktu 1–2 menit tergantung jumlah berita.</span>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <input
                  value={draftTitle}
                  onChange={e => setDraftTitle(e.target.value)}
                  style={{ background: "transparent", border: "none", borderBottom: "1px solid var(--border)", color: "#fff", fontSize: 17, fontFamily: "var(--font-display)", padding: "4px 0", outline: "none", width: 400 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleCopy} style={{ background: "#ffffff11", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 12 }}>Salin Teks</button>
                  <button onClick={handleSave} style={{ background: "#c41e3a", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 12 }}>Simpan</button>
                </div>
              </div>
              <textarea
                value={draftContent}
                onChange={e => setDraftContent(e.target.value)}
                style={{
                  flex: 1, width: "100%", background: "#08090f", border: "1px solid var(--border)",
                  borderRadius: 4, padding: 16, color: "#e2e8f0", fontFamily: "var(--font-mono)",
                  fontSize: 12, lineHeight: 1.7, resize: "none", outline: "none", minHeight: 400
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
