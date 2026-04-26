import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory cache
let cachedArticles: Article[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Trust level: 1 (low) - 5 (top tier official)
const RSS_FEEDS = [
  // General trusted media
  { url: "https://rss.kompas.com/tekno", source: "Kompas Tekno", defaultCategory: "teknologi", trust: 4 },
  { url: "https://rss.kompas.com/edukasi", source: "Kompas Edukasi", defaultCategory: "pendidikan", trust: 5 },
  { url: "https://rss.kompas.com/nasional", source: "Kompas Nasional", defaultCategory: "isu_global", trust: 4 },
  { url: "https://rss.detik.com/index.php/detikinet", source: "Detik iNET", defaultCategory: "teknologi", trust: 4 },
  { url: "https://rss.detik.com/index.php/detiknews", source: "Detik News", defaultCategory: "isu_global", trust: 4 },
  { url: "https://rss.detik.com/index.php/edu", source: "Detik Edu", defaultCategory: "pendidikan", trust: 5 },
  { url: "https://rss.detik.com/index.php/finance", source: "Detik Finance", defaultCategory: "isu_global", trust: 4 },
  { url: "https://www.antaranews.com/rss/terkini.xml", source: "Antara News", defaultCategory: "isu_global", trust: 4 },
  { url: "https://www.antaranews.com/rss/pendidikan.xml", source: "Antara Pendidikan", defaultCategory: "pendidikan", trust: 5 },
  { url: "https://www.antaranews.com/rss/tekno.xml", source: "Antara Tekno", defaultCategory: "teknologi", trust: 4 },
  { url: "https://www.cnbcindonesia.com/tech/rss", source: "CNBC Indonesia Tech", defaultCategory: "teknologi", trust: 4 },
  // Education-focused
  { url: "https://www.republika.co.id/rss/pendidikan", source: "Republika Pendidikan", defaultCategory: "pendidikan", trust: 4 },
  // Job portals (RSS / aggregator)
  { url: "https://www.jobstreet.co.id/id/jobs.xml", source: "JobStreet ID", defaultCategory: "lowongan_kerja", trust: 5 },
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  penipuan: ["penipuan", "tipu", "scam", "fraud", "modus", "korban penipuan", "phishing"],
  cybercrime: ["hack", "hacker", "ransomware", "malware", "cyber", "serangan siber", "data breach", "kebocoran data"],
  teknologi: ["teknologi", "digital", "ai", "artificial intelligence", "startup", "gadget", "software", "aplikasi", "internet", "cloud", "robot"],
  pendidikan: ["pendidikan", "sekolah", "universitas", "kampus", "guru", "siswa", "mahasiswa", "belajar", "kurikulum", "ujian", "kuliah", "pmb", "pendaftaran mahasiswa"],
  beasiswa: ["beasiswa", "scholarship", "lpdp", "bantuan pendidikan", "kuliah gratis", "kip kuliah", "bidikmisi", "djarum"],
  rpl: ["rpl", "rekognisi pembelajaran lampau", "alih kredit", "transfer kredit", "konversi sks"],
  lowongan_kerja: ["lowongan", "loker", "karir", "career", "hiring", "rekrutmen", "fresh graduate", "magang", "internship", "developer", "programmer", "data analyst", "helpdesk", "it support", "admin"],
  keamanan_digital: ["keamanan", "security", "privasi", "password", "enkripsi", "vpn", "firewall", "proteksi"],
  isu_global: ["global", "dunia", "internasional", "pbb", "who", "perubahan iklim", "geopolitik", "ekonomi global"],
};

// Keyword expansion for search relevance
const KEYWORD_EXPANSION: Record<string, string[]> = {
  rpl: ["rekognisi pembelajaran lampau", "alih kredit", "transfer kredit", "konversi sks"],
  beasiswa: ["scholarship", "lpdp", "kse", "djarum", "bidikmisi", "kip kuliah", "kip-k"],
  "beasiswa s1": ["beasiswa sarjana", "kip kuliah", "bidikmisi", "djarum"],
  "beasiswa s2": ["beasiswa magister", "lpdp", "chevening", "fulbright", "australia awards"],
  lpdp: ["beasiswa lpdp", "lembaga pengelola dana pendidikan"],
  kampus: ["universitas", "perguruan tinggi", "ptn", "pts", "institut"],
  pmb: ["penerimaan mahasiswa baru", "pendaftaran mahasiswa", "snbp", "snbt", "utbk"],
  "lowongan it": ["developer", "programmer", "software engineer", "helpdesk", "it support", "data analyst", "devops"],
  "fresh graduate": ["lulusan baru", "fresh grad", "entry level", "junior"],
  magang: ["internship", "intern", "kerja praktik"],
  pendidikan: ["sekolah", "universitas", "kampus", "kuliah", "edukasi"],
  pendaftaran: ["registrasi", "buka pendaftaran", "open registration"],
  deadline: ["batas akhir", "berakhir", "tutup pendaftaran", "due date"],
};

// Tags auto-detection
const TAG_PATTERNS: { tag: string; keywords: string[] }[] = [
  { tag: "Kampus", keywords: ["kampus", "universitas", "perguruan tinggi", "institut", "politeknik", "ptn", "pts"] },
  { tag: "RPL", keywords: ["rpl", "rekognisi pembelajaran", "alih kredit", "transfer kredit"] },
  { tag: "Beasiswa", keywords: ["beasiswa", "scholarship", "lpdp", "kip kuliah", "bidikmisi", "djarum"] },
  { tag: "LPDP", keywords: ["lpdp", "lembaga pengelola dana pendidikan"] },
  { tag: "Pendidikan", keywords: ["pendidikan", "sekolah", "kuliah", "edukasi", "kurikulum"] },
  { tag: "Pendaftaran", keywords: ["pendaftaran", "pmb", "registrasi", "buka pendaftaran", "snbt", "snbp", "utbk"] },
  { tag: "Deadline", keywords: ["deadline", "batas akhir", "berakhir", "tutup pendaftaran", "ditutup"] },
  { tag: "Pengumuman", keywords: ["pengumuman", "diumumkan", "hasil seleksi", "pengumuman kelulusan"] },
  { tag: "Lowongan Kerja", keywords: ["lowongan", "loker", "hiring", "rekrutmen", "career", "karir", "we are hiring"] },
  { tag: "Magang", keywords: ["magang", "internship", "intern", "kerja praktik"] },
  { tag: "Fresh Graduate", keywords: ["fresh graduate", "fresh grad", "lulusan baru", "entry level", "junior"] },
  { tag: "IT", keywords: ["developer", "programmer", "software engineer", "helpdesk", "it support", "data analyst", "devops", "frontend", "backend", "fullstack"] },
];

interface Article {
  title: string;
  summary: string;
  source: string;
  category: string;
  published_date: string;
  location: string;
  source_url: string;
  image_url?: string;
  trust: number;
  tags: string[];
  is_urgent: boolean;
  is_job: boolean;
  relevance_score?: number;
}

function stripHtml(html: string): string {
  return html
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function categorize(title: string, description: string, defaultCategory: string): string {
  const text = `${title} ${description}`.toLowerCase();
  let bestMatch = defaultCategory;
  let bestScore = 0;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter(kw => text.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = cat;
    }
  }
  return bestMatch;
}

function detectTags(title: string, summary: string): string[] {
  const text = `${title} ${summary}`.toLowerCase();
  const tags = new Set<string>();
  for (const { tag, keywords } of TAG_PATTERNS) {
    if (keywords.some(kw => text.includes(kw))) tags.add(tag);
  }
  return Array.from(tags);
}

function detectUrgent(title: string, summary: string, publishedDate: string): boolean {
  const text = `${title} ${summary}`.toLowerCase();
  const urgentWords = ["deadline", "batas akhir", "berakhir", "tutup pendaftaran", "ditutup", "segera", "terakhir", "pengumuman"];
  const hasUrgentWord = urgentWords.some(w => text.includes(w));
  // Within 7 days
  const daysSince = (Date.now() - new Date(publishedDate).getTime()) / (1000 * 60 * 60 * 24);
  return hasUrgentWord && daysSince <= 14;
}

function expandQuery(query: string): string[] {
  const q = query.toLowerCase().trim();
  const expanded = new Set<string>([q]);
  // Direct expansion match
  for (const [key, values] of Object.entries(KEYWORD_EXPANSION)) {
    if (q.includes(key)) values.forEach(v => expanded.add(v));
    // Reverse: query contains a value → add the key
    for (const v of values) if (q.includes(v)) expanded.add(key);
  }
  // Also add individual words from the query
  q.split(/\s+/).filter(w => w.length >= 3).forEach(w => expanded.add(w));
  return Array.from(expanded);
}

function scoreRelevance(article: Article, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 0;
  const title = article.title.toLowerCase();
  const summary = article.summary.toLowerCase();
  let score = 0;
  for (const term of queryTerms) {
    if (title.includes(term)) score += 10;
    if (summary.includes(term)) score += 5;
  }
  // Recency boost
  const daysSince = (Date.now() - new Date(article.published_date).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 1) score += 8;
  else if (daysSince <= 7) score += 4;
  else if (daysSince <= 30) score += 1;
  // Trust boost
  score += article.trust;
  // Urgent boost
  if (article.is_urgent) score += 3;
  return score;
}

function parseDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch { /* ignore */ }
  return new Date().toISOString();
}

function extractImageFromContent(content: string): string | null {
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function parseRssXml(xml: string, feedSource: string, defaultCategory: string, trust: number): Article[] {
  const items: Article[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const getTag = (tag: string) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
      const m = block.match(r);
      return m ? stripHtml(m[1]) : "";
    };

    const title = getTag("title");
    const link = getTag("link") || getTag("guid");
    const description = getTag("description");
    const pubDate = getTag("pubDate") || getTag("dc:date");
    const content = block.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i)?.[1] || "";

    if (!title || !link || !isValidUrl(link)) continue;

    const summary = description.slice(0, 300) || "Tidak ada ringkasan tersedia.";
    const image = extractImageFromContent(content) || extractImageFromContent(block);
    const publishedDate = parseDate(pubDate);
    const category = categorize(title, description, defaultCategory);
    const tags = detectTags(title, summary);
    const isJob = category === "lowongan_kerja" || tags.includes("Lowongan Kerja");

    items.push({
      title: title.slice(0, 200),
      summary,
      source: feedSource,
      category,
      published_date: publishedDate,
      location: "Indonesia",
      source_url: link,
      ...(image ? { image_url: image } : {}),
      trust,
      tags,
      is_urgent: detectUrgent(title, summary, publishedDate),
      is_job: isJob,
    });
  }
  return items;
}

async function fetchFeed(feed: typeof RSS_FEEDS[0]): Promise<Article[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(feed.url, {
      signal: controller.signal,
      headers: { "User-Agent": "GlobalQuizTimeHub/1.0 RSS Reader" },
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      console.warn(`Feed ${feed.source} returned ${resp.status}`);
      return [];
    }
    const xml = await resp.text();
    return parseRssXml(xml, feed.source, feed.defaultCategory, feed.trust);
  } catch (e) {
    console.warn(`Feed ${feed.source} failed:`, e instanceof Error ? e.message : e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { query, category, tag, sort } = body as { query?: string; category?: string; tag?: string; sort?: "relevance" | "recent" };

    const now = Date.now();
    let articles: Article[];

    if (cachedArticles.length > 0 && now - cacheTimestamp < CACHE_TTL) {
      console.log("Serving from cache");
      articles = [...cachedArticles];
    } else {
      console.log("Fetching fresh RSS feeds...");
      const results = await Promise.allSettled(RSS_FEEDS.map(fetchFeed));
      const allItems: Article[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") allItems.push(...r.value);
      }

      // Deduplicate by URL
      const seen = new Set<string>();
      articles = [];
      for (const item of allItems) {
        if (!seen.has(item.source_url)) {
          seen.add(item.source_url);
          articles.push(item);
        }
      }

      // Default sort: by date desc
      articles.sort((a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime());

      cachedArticles = articles;
      cacheTimestamp = now;
      console.log(`Cached ${articles.length} articles from RSS`);
    }

    // Filter by category
    if (category && category !== "semua") {
      articles = articles.filter(a => a.category === category);
    }

    // Filter by tag
    if (tag) {
      articles = articles.filter(a => a.tags.includes(tag));
    }

    // Search with keyword expansion + relevance scoring
    if (query && query.trim()) {
      const terms = expandQuery(query);
      articles = articles
        .map(a => ({ ...a, relevance_score: scoreRelevance(a, terms) }))
        .filter(a => (a.relevance_score ?? 0) > 0);

      if (sort !== "recent") {
        articles.sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));
      }
    } else if (sort === "relevance") {
      // No query but relevance: prioritize urgent + trust
      articles.sort((a, b) => {
        const sa = (a.is_urgent ? 5 : 0) + a.trust;
        const sb = (b.is_urgent ? 5 : 0) + b.trust;
        return sb - sa;
      });
    }

    // Return top 50
    const result = articles.slice(0, 50);

    return new Response(JSON.stringify({
      articles: result,
      total: cachedArticles.length,
      filtered: articles.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("news-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", articles: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
