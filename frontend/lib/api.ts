// Gunakan hostname browser secara dinamis agar bisa diakses dari laptop lain di jaringan yang sama.
// Kalau diakses dari localhost → localhost:8000
// Kalau diakses dari 192.168.1.146:3000 → 192.168.1.146:8000
const API_URL =
  typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000`
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");

async function fetchAPI(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── News Feed ───
export const getNews = (params?: {
  region?: string;
  category?: string;
  profiling_status?: string;
  limit?: number;
  skip?: number;
  period?: string;
}) => {
  const q = new URLSearchParams();
  if (params?.region)           q.set("region", params.region);
  if (params?.category)         q.set("category", params.category);
  if (params?.profiling_status) q.set("profiling_status", params.profiling_status);
  if (params?.limit)            q.set("limit", String(params.limit));
  if (params?.skip)             q.set("skip", String(params.skip));
  if (params?.period)           q.set("period", params.period);
  return fetchAPI(`/api/news/?${q.toString()}`);
};

// ─── Dashboard Stats & Charts ───
export const getStats       = (period = "day") => fetchAPI(`/api/news/stats?period=${period}`);
export const getByRegion    = (period = "day") => fetchAPI(`/api/news/by-region?period=${period}`);
export const getTrend       = (period = "day") => fetchAPI(`/api/news/trend?period=${period}`);
export const getKeywords    = (period = "day") => fetchAPI(`/api/news/keywords?period=${period}`);
export const getEntities    = (period = "day") => fetchAPI(`/api/news/entities?period=${period}`);
export const getSources     = (period = "day") => fetchAPI(`/api/news/sources?period=${period}`);
export const getVelocity    = ()                => fetchAPI(`/api/news/velocity`);
export const getHeatCalendar = ()               => fetchAPI(`/api/news/heat-calendar`);
export const getHeatmap      = (period = "day") => fetchAPI(`/api/news/heatmap?period=${period}`);
export const getCompare     = (period = "week") => fetchAPI(`/api/news/compare?period=${period}`);

// ─── Profiling ───
export const getNewsProfiling = (newsId: string) => fetchAPI(`/api/news/${newsId}/profiling`);
export const analyzeNewsDeep  = (newsId: string) =>
  fetchAPI(`/api/news/${newsId}/analyze`, { method: "POST" });

// ─── Watchlist ───
export const getWatchlist     = ()                        => fetchAPI("/api/watchlist/");
export const getWatchlistHits = (period = "day")          => fetchAPI(`/api/watchlist/hits?period=${period}`);
export const addWatchlistTerm = (term: string, term_type: string) =>
  fetchAPI("/api/watchlist/", { method: "POST", body: JSON.stringify({ term, term_type }) });
export const deleteWatchlistTerm = (id: string) =>
  fetchAPI(`/api/watchlist/${id}`, { method: "DELETE" });

// ─── Reports & Crawl ───
export const getLatestReport = (period = "day") => fetchAPI(`/api/report/latest?period=${period}`);
export const getCrawlLogs    = ()               => fetchAPI("/api/crawl/logs?limit=10");
export const triggerCrawl    = ()               => fetchAPI("/api/crawl/manual",    { method: "POST" });
export const triggerAnalyze  = ()               => fetchAPI("/api/analyze/all",     { method: "POST" });
export const triggerReport   = ()               => fetchAPI("/api/report/generate", { method: "POST" });

// ─── Agent ───
export const chatWithAgent = (message: string) =>
  fetchAPI("/api/agent/chat", { method: "POST", body: JSON.stringify({ message }) });
