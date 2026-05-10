const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const getNews = (params?: {
  region?: string;
  sentiment?: string;
  category?: string;
  limit?: number;
  skip?: number;
  period?: string;
}) => {
  const q = new URLSearchParams();
  if (params?.region)    q.set("region", params.region);
  if (params?.sentiment) q.set("sentiment", params.sentiment);
  if (params?.category)  q.set("category", params.category);
  if (params?.limit)     q.set("limit", String(params.limit));
  if (params?.skip)      q.set("skip", String(params.skip));
  if (params?.period)    q.set("period", params.period);
  return fetchAPI(`/api/news/?${q.toString()}`);
};

export const getStats    = (period = "day") => fetchAPI(`/api/news/stats?period=${period}`);
export const getByRegion = (period = "day") => fetchAPI(`/api/news/by-region?period=${period}`);
export const getTrend    = (period = "day") => fetchAPI(`/api/news/trend?period=${period}`);
export const getNewsProfiling = (newsId: string) => fetchAPI(`/api/news/${newsId}/profiling`);

export const getLatestReport = () => fetchAPI("/api/report/latest");
export const getCrawlLogs    = () => fetchAPI("/api/crawl/logs?limit=10");

export const chatWithAgent  = (message: string) =>
  fetchAPI("/api/agent/chat", { method: "POST", body: JSON.stringify({ message }) });

export const triggerCrawl   = () => fetchAPI("/api/crawl/manual",    { method: "POST" });
export const triggerAnalyze = () => fetchAPI("/api/analyze/all",     { method: "POST" });
export const triggerReport  = () => fetchAPI("/api/report/generate", { method: "POST" });

// Re-analisis ulang berita individual (hapus analisis lama + jalankan AI lagi)
export const reanalyzeNews = (newsId: string) =>
  fetchAPI(`/api/news/${newsId}/reanalyze`, { method: "POST" });

// Override sentimen manual tanpa re-analisis AI
export const overrideSentiment = (newsId: string, sentiment: "positif" | "netral" | "negatif") =>
  fetchAPI(`/api/news/${newsId}/sentiment`, {
    method: "PATCH",
    body: JSON.stringify({ sentiment }),
  });
