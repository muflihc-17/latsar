"use client";
import { useEffect, useState } from "react";
import { getWatchlist, getWatchlistHits, addWatchlistTerm, deleteWatchlistTerm } from "@/lib/api";
import { usePeriod } from "@/lib/PeriodContext";

const TYPE_ICONS: Record<string, string> = {
  person: "👤", organization: "🏛", keyword: "🔑", location: "📍",
};

export default function WatchlistPanel() {
  const { period } = usePeriod();
  const [hits, setHits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState(false);
  const [newTerm, setNewTerm] = useState("");
  const [newType, setNewType] = useState("keyword");
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      const data = await getWatchlistHits(period);
      setHits(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const handleAdd = async () => {
    if (!newTerm.trim()) return;
    setAdding(true);
    setMsg("");
    try {
      await addWatchlistTerm(newTerm.trim(), newType);
      setMsg(`✅ "${newTerm}" ditambahkan`);
      setNewTerm("");
      setAddMode(false);
      await load();
    } catch {
      setMsg("❌ Gagal atau term sudah ada");
    } finally {
      setAdding(false);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const handleDelete = async (id: string, term: string) => {
    try {
      await deleteWatchlistTerm(id);
      setMsg(`🗑 "${term}" dihapus`);
      await load();
    } catch {
      setMsg("❌ Gagal menghapus");
    }
    setTimeout(() => setMsg(""), 2000);
  };

  return (
    <div className="card" style={{ borderLeft: "3px solid #8b5cf6" }}>
      <div className="card-title">
        🎯 Watchlist
        <button
          onClick={() => setAddMode(!addMode)}
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 8px",
            borderRadius: 2, cursor: "pointer",
            background: addMode ? "#8b5cf622" : "#ffffff08",
            color: addMode ? "#c084fc" : "var(--text-muted)",
            border: `1px solid ${addMode ? "#8b5cf644" : "var(--border)"}`,
            transition: "all .15s",
          }}
        >
          {addMode ? "✕ BATAL" : "+ TAMBAH"}
        </button>
      </div>

      {/* Add form */}
      {addMode && (
        <div style={{ marginBottom: 10, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={newTerm}
            onChange={e => setNewTerm(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="Ketik nama/keyword..."
            style={{
              flex: 1, minWidth: 120,
              fontFamily: "var(--font-mono)", fontSize: 10,
              background: "#0f1520", border: "1px solid #1a2236",
              borderRadius: 3, padding: "4px 8px", color: "#e2e8f0", outline: "none",
            }}
          />
          <select
            value={newType}
            onChange={e => setNewType(e.target.value)}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 9,
              background: "#0f1520", border: "1px solid #1a2236",
              borderRadius: 3, padding: "4px 6px", color: "var(--text-secondary)", cursor: "pointer",
            }}
          >
            <option value="keyword">🔑 Keyword</option>
            <option value="person">👤 Tokoh</option>
            <option value="organization">🏛 Organisasi</option>
            <option value="location">📍 Lokasi</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={adding || !newTerm.trim()}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 9, padding: "4px 10px",
              borderRadius: 2, cursor: adding ? "not-allowed" : "pointer",
              background: "#8b5cf622", color: "#c084fc", border: "1px solid #8b5cf644",
            }}
          >
            {adding ? "..." : "SIMPAN"}
          </button>
        </div>
      )}

      {msg && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: msg.startsWith("✅") ? "#34d399" : msg.startsWith("🗑") ? "#93c5fd" : "#f87171", marginBottom: 8 }}>
          {msg}
        </div>
      )}

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ height: 36, background: "#1a2236", borderRadius: 3, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))
        ) : hits.length === 0 ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", textAlign: "center", padding: 16 }}>
            Watchlist kosong. Tambah term untuk memulai monitoring.
          </div>
        ) : (
          hits.map(item => (
            <div
              key={item.id}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 10px",
                background: item.hit_count > 0 ? "#8b5cf611" : "#ffffff05",
                border: `1px solid ${item.hit_count > 0 ? "#8b5cf633" : "var(--border)"}`,
                borderLeft: `3px solid ${item.hit_count > 0 ? "#8b5cf6" : "#1a2236"}`,
                borderRadius: 3,
              }}
            >
              <span style={{ fontSize: 12 }}>{TYPE_ICONS[item.term_type] || "🔑"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.term}
                </div>
                {item.hit_count > 0 && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#a78bfa", marginTop: 1 }}>
                    {item.hit_count} kemunculan
                  </div>
                )}
              </div>
              {item.hit_count > 0 && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#c084fc" }}>
                  {item.hit_count}
                </span>
              )}
              <button
                onClick={() => handleDelete(item.id, item.term)}
                title="Hapus"
                style={{
                  width: 20, height: 20, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 10,
                  transition: "color .15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
