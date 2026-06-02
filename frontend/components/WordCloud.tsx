"use client";
import { useEffect, useState } from "react";
import { getKeywords } from "@/lib/api";
import { usePeriod } from "@/lib/PeriodContext";

interface WordEntry { word: string; count: number; }

function getWordStyle(count: number, maxCount: number, isMobile: boolean) {
  const ratio = count / maxCount;
  const maxFont = isMobile ? 18 : 30;
  const minFont = isMobile ? 10 : 10;
  const fontSize = Math.round(minFont + ratio * (maxFont - minFont));
  const opacity = 0.5 + ratio * 0.5;

  let color: string;
  if (ratio >= 0.7) color = "#f87171";
  else if (ratio >= 0.4) color = "#fbbf24";
  else if (ratio >= 0.2) color = "#a78bfa";
  else color = "#7a8899";

  return { fontSize, opacity, color };
}

export default function WordCloud() {
  const { period } = usePeriod();
  const [words, setWords] = useState<WordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const load = async () => {
    try {
      const data = await getKeywords(period);
      setWords(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const maxCount = words.length > 0 ? words[0].count : 1;

  // Batasi jumlah kata di mobile agar tidak terlalu penuh
  const displayWords = isMobile ? words.slice(0, 20) : words;
  const shuffled = [...displayWords].sort(() => Math.random() - 0.5);

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="card-title">
        ☁️ Word Cloud — Isu Dominan
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>
          {words.length} kata kunci
        </span>
      </div>
      {loading ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 0" }}>
          {Array.from({ length: isMobile ? 12 : 20 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 20, width: `${40 + (i % 5) * 20}px`,
                background: "#1a2236", borderRadius: 3,
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      ) : words.length === 0 ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", padding: "20px 0" }}>
          Belum ada keyword — crawling lebih banyak berita untuk mengisi word cloud.
        </div>
      ) : (
        <div
          className="word-cloud"
          style={{
            maxHeight: isMobile ? 160 : "none",
            overflowY: isMobile ? "hidden" : "visible",
          }}
        >
          {shuffled.map((entry, i) => {
            const { fontSize, opacity, color } = getWordStyle(entry.count, maxCount, isMobile);
            return (
              <span
                key={i}
                className="word-tag"
                title={`${entry.word}: ${entry.count}x`}
                style={{
                  fontSize,
                  opacity,
                  color,
                  background: `${color}11`,
                  border: `1px solid ${color}33`,
                  fontWeight: entry.count >= maxCount * 0.7 ? 700 : 400,
                  letterSpacing: fontSize >= 16 ? ".03em" : "0",
                }}
              >
                {entry.word}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
