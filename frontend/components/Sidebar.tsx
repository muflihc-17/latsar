"use client";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeMode: "dashboard" | "laporan";
  setMode: (mode: "dashboard" | "laporan") => void;
}

export default function Sidebar({ isOpen, onClose, activeMode, setMode }: SidebarProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0, 0, 0, 0.5)", zIndex: 999,
          backdropFilter: "blur(2px)"
        }}
      />
      
      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: 280,
        background: "#08090f", borderRight: "1px solid #1a2236",
        zIndex: 1000, display: "flex", flexDirection: "column",
        boxShadow: "4px 0 24px rgba(0,0,0,0.5)",
        transform: isOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s ease",
      }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #1a2236", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: ".1em", color: "#e2e8f0" }}>
            MENU UTAMA
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 20 }}>
            ×
          </button>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={() => { setMode("dashboard"); onClose(); }}
            style={{
              padding: "12px 16px", borderRadius: 4, textAlign: "left",
              fontFamily: "var(--font-mono)", fontSize: 13, cursor: "pointer",
              background: activeMode === "dashboard" ? "#c41e3a22" : "transparent",
              color: activeMode === "dashboard" ? "#f87171" : "var(--text-secondary)",
              border: `1px solid ${activeMode === "dashboard" ? "#c41e3a55" : "transparent"}`,
              transition: "all .2s"
            }}
          >
            📊 Dashboard
          </button>
          
          <button
            onClick={() => { setMode("laporan"); onClose(); }}
            style={{
              padding: "12px 16px", borderRadius: 4, textAlign: "left",
              fontFamily: "var(--font-mono)", fontSize: 13, cursor: "pointer",
              background: activeMode === "laporan" ? "#c41e3a22" : "transparent",
              color: activeMode === "laporan" ? "#f87171" : "var(--text-secondary)",
              border: `1px solid ${activeMode === "laporan" ? "#c41e3a55" : "transparent"}`,
              transition: "all .2s"
            }}
          >
            📝 Laporan Pimpinan
          </button>
        </div>
      </div>
    </>
  );
}
