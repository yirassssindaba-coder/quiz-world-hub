import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ── helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  let text = html.replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1");
  for (let i = 0; i < 2; i++) {
    text = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, " ");
  }
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}

// ── /api/media-embed ─────────────────────────────────────────────────────────

function parseYouTube(url: string) {
  let m = url.match(/(?:youtube\.com\/watch\?.*v=)([\w-]{11})/);
  if (m) return { valid: true, platform: "youtube", type: "video", id: m[1], embed_url: `https://www.youtube.com/embed/${m[1]}` };
  m = url.match(/youtu\.be\/([\w-]{11})/);
  if (m) return { valid: true, platform: "youtube", type: "video", id: m[1], embed_url: `https://www.youtube.com/embed/${m[1]}` };
  m = url.match(/youtube\.com\/embed\/([\w-]{11})/);
  if (m) return { valid: true, platform: "youtube", type: "video", id: m[1], embed_url: `https://www.youtube.com/embed/${m[1]}` };
  m = url.match(/youtube\.com\/playlist\?.*list=([\w-]+)/);
  if (m) return { valid: true, platform: "youtube", type: "playlist", id: m[1], embed_url: `https://www.youtube.com/embed/videoseries?list=${m[1]}` };
  m = url.match(/youtube\.com\/shorts\/([\w-]{11})/);
  if (m) return { valid: true, platform: "youtube", type: "video", id: m[1], embed_url: `https://www.youtube.com/embed/${m[1]}` };
  return null;
}

function parseSpotify(url: string) {
  let m = url.match(/open\.spotify\.com\/(track|album|playlist|artist|episode|show)\/([\w]+)/);
  if (m) return { valid: true, platform: "spotify", type: m[1], id: m[2], embed_url: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0` };
  m = url.match(/spotify:(track|album|playlist|artist|episode|show):([\w]+)/);
  if (m) return { valid: true, platform: "spotify", type: m[1], id: m[2], embed_url: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0` };
  return null;
}

app.post("/api/media-embed", async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ valid: false, error: "URL is required" });
  }
  const trimmed = url.trim();
  const result = parseYouTube(trimmed) || parseSpotify(trimmed);
  if (!result) return res.json({ valid: false, error: "URL tidak dikenali. Gunakan link YouTube atau Spotify." });

  if (result.platform === "youtube" && result.id) {
    try {
      const oembedUrl = result.type === "playlist"
        ? `https://www.youtube.com/oembed?url=https://www.youtube.com/playlist?list=${result.id}&format=json`
        : `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${result.id}&format=json`;
      const oembedRes = await fetch(oembedUrl, { signal: AbortSignal.timeout(4000) });
      if (oembedRes.ok) {
        const oembed = await oembedRes.json() as { title?: string; thumbnail_url?: string };
        if (oembed.title) (result as any).title = oembed.title;
        if (oembed.thumbnail_url) (result as any).thumbnail = oembed.thumbnail_url;
      }
    } catch {
      // silently skip — client will derive thumbnail from embed_url
    }
  }

  return res.json(result);
});

// ── /api/job-validate ─────────────────────────────────────────────────────────

const TRUSTED_PORTALS = [
  "jobstreet.co.id","jobstreet.com","glints.com","linkedin.com",
  "karir.com","kalibrr.com","indeed.com","topkarir.com","loker.id",
  "kemnaker.go.id","bkn.go.id",
];
const RED_FLAG_PATTERNS = [
  { pattern: /bayar (pendaftaran|administrasi|deposit|biaya)/i, weight: -30, reason: "Meminta pembayaran/biaya pendaftaran" },
  { pattern: /transfer (uang|sejumlah|biaya)/i, weight: -30, reason: "Meminta transfer uang" },
  { pattern: /(kirim|berikan) (ktp|foto ktp|selfie ktp|nomor rekening|pin atm)/i, weight: -25, reason: "Meminta data sensitif" },
  { pattern: /gaji.{0,20}(50|60|70|80|90|100).?(juta|jt)/i, weight: -15, reason: "Tawaran gaji tidak wajar" },
  { pattern: /(bit\.ly|tinyurl|t\.co|goo\.gl|cutt\.ly|s\.id)\//i, weight: -25, reason: "Menggunakan URL pemendek" },
  { pattern: /(whatsapp|wa).{0,30}(saja|only|langsung)/i, weight: -10, reason: "Kontak hanya melalui WhatsApp" },
  { pattern: /tanpa (interview|wawancara|tes|seleksi)/i, weight: -20, reason: "Tidak ada proses seleksi" },
  { pattern: /langsung (kerja|cair|gaji)/i, weight: -10, reason: "Janji langsung kerja/cair" },
  { pattern: /(jaminan|garansi).{0,20}(diterima|lolos)/i, weight: -15, reason: "Jaminan diterima tidak wajar" },
];
const GREEN_FLAG_PATTERNS = [
  { pattern: /(deskripsi pekerjaan|job description|tugas|tanggung jawab)/i, weight: 8, reason: "Deskripsi pekerjaan jelas" },
  { pattern: /(persyaratan|requirements|kualifikasi)/i, weight: 8, reason: "Mencantumkan persyaratan" },
  { pattern: /(benefit|tunjangan|asuransi|bpjs|thr)/i, weight: 5, reason: "Mencantumkan benefit" },
  { pattern: /(pengalaman|experience).{0,30}(tahun|years|bulan)/i, weight: 5, reason: "Pengalaman dibutuhkan jelas" },
  { pattern: /(lokasi|location|wfh|wfo|hybrid|remote)/i, weight: 3, reason: "Lokasi kerja jelas" },
  { pattern: /(s1|s2|d3|sma|smk|fresh graduate|lulusan)/i, weight: 4, reason: "Pendidikan minimum jelas" },
];

function getDomain(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

function validateJob(title: string, summary: string, sourceUrl: string) {
  const text = `${title} ${summary}`;
  let score = 50;
  const reasons: string[] = [];
  const trustSignals: string[] = [];
  const redFlags: string[] = [];
  const domain = getDomain(sourceUrl);
  if (domain && TRUSTED_PORTALS.some(d => domain === d || domain.endsWith("." + d))) {
    score += 25; trustSignals.push(`Sumber dari portal kerja terpercaya (${domain})`);
  } else if (domain && (domain.endsWith(".go.id") || domain.endsWith(".ac.id"))) {
    score += 30; trustSignals.push(`Sumber dari domain resmi (${domain})`);
  } else if (domain && domain.endsWith(".co.id")) {
    score += 8; trustSignals.push(`Domain perusahaan Indonesia (${domain})`);
  } else if (!domain) {
    score -= 10; redFlags.push("URL tidak valid");
  }
  for (const { pattern, weight, reason } of RED_FLAG_PATTERNS) {
    if (pattern.test(text)) { score += weight; redFlags.push(reason); }
  }
  let greenCount = 0;
  for (const { pattern, weight, reason } of GREEN_FLAG_PATTERNS) {
    if (pattern.test(text)) { score += weight; trustSignals.push(reason); greenCount++; }
  }
  if (greenCount === 0 && summary.length < 80) {
    score -= 10; redFlags.push("Deskripsi terlalu singkat");
  }
  score = Math.max(0, Math.min(100, score));
  const verdict = score >= 70 ? "verified" : score >= 40 ? "caution" : "suspicious";
  reasons.push(...trustSignals.slice(0, 3));
  if (redFlags.length) reasons.push(...redFlags.slice(0, 3));
  return { verdict, score, reasons, trust_signals: trustSignals, red_flags: redFlags };
}

app.post("/api/job-validate", (req, res) => {
  const { jobs } = req.body;
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return res.status(400).json({ error: "Array 'jobs' diperlukan" });
  }
  if (jobs.length > 100) {
    return res.status(400).json({ error: "Maksimum 100 lowongan per request" });
  }
  const results = jobs.map((job: any) => ({
    source_url: job.source_url,
    ...validateJob(job.title || "", job.summary || "", job.source_url || ""),
  }));
  return res.json({ results });
});

// ── /api/job-ai-analyze ───────────────────────────────────────────────────────

app.post("/api/job-ai-analyze", async (req, res) => {
  try {
    const { title, summary, source_url, source } = req.body;
    if (!title) return res.status(400).json({ error: "title diperlukan" });
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return res.status(503).json({ error: "AI tidak tersedia" });

    const domain = source_url ? (() => { try { return new URL(source_url).hostname; } catch { return ""; } })() : "";
    const prompt = `Kamu adalah pakar analisis keamanan lowongan kerja di Indonesia. Analisis lowongan berikut dan tentukan apakah aman atau mencurigakan.

Judul: ${title}
Ringkasan: ${summary || "(tidak ada ringkasan)"}
Domain sumber: ${domain || "(tidak ada URL)"}
Portal sumber: ${source || "(tidak diketahui)"}

Berikan analisis singkat dalam JSON dengan format:
{
  "verdict": "safe" | "suspicious",
  "confidence": 0-100,
  "analysis": "penjelasan singkat 1-2 kalimat dalam bahasa Indonesia",
  "red_flags": ["flag1","flag2"],
  "safe_signs": ["tanda1","tanda2"]
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Kamu adalah analis keamanan lowongan kerja. Balas hanya dengan JSON valid." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 400,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return res.status(429).json({ error: "Rate limited" });
      throw new Error(`AI error: ${response.status}`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response from AI");
    const parsed = JSON.parse(content);
    return res.json(parsed);
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
});

// ── /api/news-search ──────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  penipuan: ["penipuan","tipu","scam","fraud","modus","korban penipuan","phishing"],
  cybercrime: ["hack","hacker","ransomware","malware","cyber","serangan siber","data breach","kebocoran data"],
  teknologi: ["teknologi","digital","ai","artificial intelligence","startup","gadget","software","aplikasi","internet","cloud","robot"],
  pendidikan: ["pendidikan","sekolah","universitas","kampus","guru","siswa","mahasiswa","belajar","kurikulum","ujian","kuliah","pmb"],
  beasiswa: ["beasiswa","scholarship","lpdp","bantuan pendidikan","kuliah gratis","kip kuliah","bidikmisi","djarum"],
  rpl: ["rpl","rekognisi pembelajaran lampau","alih kredit","transfer kredit","konversi sks"],
  lowongan_kerja: ["lowongan","loker","karir","career","hiring","rekrutmen","fresh graduate","magang","internship","developer","programmer","data analyst"],
  keamanan_digital: ["keamanan","security","privasi","password","enkripsi","vpn","firewall","proteksi"],
  isu_global: ["global","dunia","internasional","pbb","who","perubahan iklim","geopolitik","ekonomi global"],
};
const TAG_PATTERNS = [
  { tag: "Kampus", keywords: ["kampus","universitas","perguruan tinggi","institut","politeknik","ptn","pts"] },
  { tag: "RPL", keywords: ["rpl","rekognisi pembelajaran","alih kredit","transfer kredit"] },
  { tag: "Beasiswa", keywords: ["beasiswa","scholarship","lpdp","kip kuliah","bidikmisi","djarum"] },
  { tag: "LPDP", keywords: ["lpdp","lembaga pengelola dana pendidikan"] },
  { tag: "Pendidikan", keywords: ["pendidikan","sekolah","kuliah","edukasi","kurikulum"] },
  { tag: "Pendaftaran", keywords: ["pendaftaran","pmb","registrasi","buka pendaftaran","snbt","snbp","utbk"] },
  { tag: "Deadline", keywords: ["deadline","batas akhir","tutup pendaftaran","ditutup pendaftaran","pendaftaran ditutup"] },
  { tag: "Pengumuman", keywords: ["pengumuman","diumumkan","hasil seleksi","pengumuman kelulusan"] },
  { tag: "Lowongan Kerja", keywords: ["lowongan","loker","hiring","rekrutmen","career","karir","we are hiring"] },
  { tag: "Magang", keywords: ["magang","internship","intern","kerja praktik"] },
  { tag: "Fresh Graduate", keywords: ["fresh graduate","fresh grad","lulusan baru","entry level","junior"] },
  { tag: "IT", keywords: ["developer","programmer","software engineer","helpdesk","it support","data analyst","devops","frontend","backend","fullstack"] },
];
const KEYWORD_EXPANSION: Record<string, string[]> = {
  rpl: ["rekognisi pembelajaran lampau","alih kredit","transfer kredit","konversi sks"],
  beasiswa: ["scholarship","lpdp","kse","djarum","bidikmisi","kip kuliah","kip-k"],
  lpdp: ["beasiswa lpdp","lembaga pengelola dana pendidikan"],
  kampus: ["universitas","perguruan tinggi","ptn","pts","institut"],
  pmb: ["penerimaan mahasiswa baru","pendaftaran mahasiswa","snbp","snbt","utbk"],
  "lowongan it": ["developer","programmer","software engineer","helpdesk","it support","data analyst","devops"],
  "fresh graduate": ["lulusan baru","fresh grad","entry level","junior"],
  magang: ["internship","intern","kerja praktik"],
  pendidikan: ["sekolah","universitas","kampus","kuliah","edukasi"],
};
const EDUCATION_CATEGORIES = new Set(["pendidikan", "beasiswa", "rpl"]);
const EDUCATION_TAGS = new Set(["Kampus", "RPL", "Beasiswa", "LPDP", "Pendidikan", "Pendaftaran", "Deadline", "Pengumuman"]);
const EDUCATION_STRONG_KEYWORDS = [
  "kampus","universitas","perguruan tinggi","institut","politeknik","sekolah","dosen","guru","siswa","mahasiswa",
  "beasiswa","lpdp","kip kuliah","scholarship","pmb","penerimaan mahasiswa baru","pendaftaran mahasiswa","akademik",
  "rpl","rekognisi pembelajaran lampau","alih kredit","transfer kredit","konversi sks","snbp","snbt","utbk",
  "kementerian pendidikan","kemendikbud","kemendiktisaintek","kurikulum","ujian","kuliah","edukasi",
  "deadline akademik","seleksi mahasiswa","daftar ulang","program studi","fakultas","sks","diploma","sarjana",
  "pascasarjana","s2","s3","ppdb","asesmen","akreditasi","nisn","dapodik","merdeka belajar"
];
const EDUCATION_OFFTOPIC_KEYWORDS = [
  "warteg","kuliner","makanan","masakan","restoran","rumah makan","cafe","kafe","resep","chef","menu","makan","minuman",
  "jajanan","kopi","bakso","mie ayam","nasi goreng","ayam goreng","seblak","street food","wisata kuliner",
  "hiburan","gosip","seleb","artis","film","drama","konser","musik","cerai","pernikahan","pasangan",
  "otomotif","mobil","motor","balap","sepak bola","bola","transfer pemain","iphone","android","gadget",
  "saham","bursa","kripto","properti","rumah","kesehatan","kebugaran","zodiak","ramalan","viral"
];
const EDUCATION_SOURCE_KEYWORDS = ["edukasi","pendidikan","beasiswa","lpdp","rpl","kampus"];
const ALTERNATIVE_SOCIAL_DOMAINS = ["linkedin.com", "x.com", "twitter.com", "instagram.com", "facebook.com", "t.me", "telegram.me", "youtube.com", "youtu.be"];
const ALTERNATIVE_PUBLIC_DOMAINS = ["medium.com", "blogspot.com", "wordpress.com", "github.io", "glints.com", "jobstreet.co.id", "karir.com", "kalibrr.com", "kemdikbud.go.id", "kemdiktisaintek.go.id", "lpdp.kemenkeu.go.id"];
const OFFICIAL_SOURCE_TERMS = ["official","resmi","kementerian","kemendikbud","kemdiktisaintek","lpdp","universitas","university","kampus","career","karir"];
const SPAM_PATTERNS = [
  /slot|gacor|judi|casino|pinjol|paylater/i,
  /transfer.{0,25}(admin|biaya|uang|dana)/i,
  /(dijamin|jaminan).{0,25}(lolos|diterima|kerja)/i,
  /(whatsapp|wa).{0,25}(saja|langsung|only)/i,
  /klik.{0,20}(hadiah|bonus|claim|klaim)/i,
  /(giveaway|airdrop|bonus).{0,25}(klik|claim|klaim|daftar)/i,
  /(dm|inbox|chat).{0,25}(admin|nomor|wa|whatsapp)/i,
  /(tanpa seleksi|tanpa interview|tanpa tes).{0,40}(diterima|lolos|kerja)/i,
  /(bayar|biaya).{0,30}(pendaftaran|administrasi|deposit|jaminan)/i,
];
const RSS_FEEDS = [
  { url: "https://rss.kompas.com/tekno", source: "Kompas Tekno", defaultCategory: "teknologi", trust: 4 },
  { url: "https://rss.kompas.com/edukasi", source: "Kompas Edukasi", defaultCategory: "pendidikan", trust: 5 },
  { url: "https://rss.kompas.com/nasional", source: "Kompas Nasional", defaultCategory: "isu_global", trust: 4 },
  { url: "https://rss.detik.com/index.php/detikinet", source: "Detik iNET", defaultCategory: "teknologi", trust: 4 },
  { url: "https://rss.detik.com/index.php/detiknews", source: "Detik News", defaultCategory: "isu_global", trust: 4 },
  { url: "https://rss.detik.com/index.php/edu", source: "Detik Edu", defaultCategory: "pendidikan", trust: 5 },
  { url: "https://www.antaranews.com/rss/terkini.xml", source: "Antara News", defaultCategory: "isu_global", trust: 4 },
  { url: "https://www.antaranews.com/rss/pendidikan.xml", source: "Antara Pendidikan", defaultCategory: "pendidikan", trust: 5 },
  { url: "https://www.cnbcindonesia.com/tech/rss", source: "CNBC Indonesia Tech", defaultCategory: "teknologi", trust: 4 },
  { url: "https://www.cnbcindonesia.com/lifestyle/rss", source: "CNBC Indonesia Lifestyle", defaultCategory: "isu_global", trust: 4 },
  { url: "https://rss.kompas.com/money", source: "Kompas Money", defaultCategory: "isu_global", trust: 4 },
  { url: "https://rss.detik.com/index.php/detikfinance", source: "Detik Finance", defaultCategory: "isu_global", trust: 4 },
  { url: "https://mediaindonesia.com/rss/get/pendidikan", source: "Media Indonesia Pendidikan", defaultCategory: "pendidikan", trust: 4 },
  { url: "https://www.republika.co.id/rss/pendidikan", source: "Republika Pendidikan", defaultCategory: "pendidikan", trust: 4 },
  { url: "https://kumparan.com/topic/beasiswa/rss", source: "Kumparan Beasiswa", defaultCategory: "beasiswa", trust: 4 },
  { url: "https://kumparan.com/topic/lowongan-kerja/rss", source: "Kumparan Loker", defaultCategory: "lowongan_kerja", trust: 3 },
  { url: "https://kumparan.com/topic/lpdp/rss", source: "Kumparan LPDP", defaultCategory: "beasiswa", trust: 4 },
  { url: "https://kumparan.com/topic/rpl/rss", source: "Kumparan RPL", defaultCategory: "rpl", trust: 4 },
  { url: "https://blog.glints.com/id/rss/", source: "Glints Blog", defaultCategory: "lowongan_kerja", trust: 4 },
  { url: "https://news.google.com/rss/search?q=beasiswa%20LPDP%20OR%20beasiswa%20S2%20OR%20beasiswa%20pemerintah%20when%3A30d&hl=id&gl=ID&ceid=ID:id", source: "Google News Beasiswa", defaultCategory: "beasiswa", trust: 3 },
  { url: "https://news.google.com/rss/search?q=RPL%20OR%20%22rekognisi%20pembelajaran%20lampau%22%20OR%20%22alih%20kredit%22%20OR%20%22transfer%20kredit%22%20when%3A60d&hl=id&gl=ID&ceid=ID:id", source: "Google News RPL", defaultCategory: "rpl", trust: 3 },
  { url: "https://news.google.com/rss/search?q=kampus%20OR%20universitas%20OR%20PMB%20OR%20%22pendaftaran%20mahasiswa%22%20when%3A30d&hl=id&gl=ID&ceid=ID:id", source: "Google News Pendidikan", defaultCategory: "pendidikan", trust: 3 },
];

interface Article {
  title: string; summary: string; source: string; category: string;
  published_date: string; location: string; source_url: string;
  image_url?: string; trust: number; tags: string[];
  is_urgent: boolean; is_job: boolean; relevance_score?: number;
  is_related?: boolean; related_reason?: string;
  is_alternative?: boolean; platform?: string; verification_level?: "Resmi" | "Terverifikasi" | "Komunitas" | "Belum Terverifikasi";
  relevance_reason?: string; validation_notes?: string[]; disclaimer?: string;
}

let cachedArticles: Article[] = [];
let cacheTimestamp = 0;
const alternativeCache = new Map<string, { timestamp: number; articles: Article[] }>();
const CACHE_TTL = 5 * 60 * 1000;

function categorize(title: string, description: string, defaultCategory: string): string {
  const text = `${title} ${description}`.toLowerCase();
  let bestMatch = defaultCategory, bestScore = 0;
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = kws.filter(kw => textHasTerm(text, kw)).length;
    if (score > bestScore) { bestScore = score; bestMatch = cat; }
  }
  return bestMatch;
}
function detectTags(title: string, summary: string): string[] {
  const text = `${title} ${summary}`.toLowerCase();
  const tags = new Set<string>();
  for (const { tag, keywords } of TAG_PATTERNS) {
    if (keywords.some(kw => textHasTerm(text, kw))) tags.add(tag);
  }
  return Array.from(tags);
}
function detectUrgent(title: string, summary: string, publishedDate: string): boolean {
  const text = `${title} ${summary}`.toLowerCase();
  const urgentWords = ["deadline","batas akhir","tutup pendaftaran","ditutup pendaftaran","pendaftaran ditutup","segera daftar","hari terakhir","pengumuman seleksi","pengumuman kelulusan"];
  const hasUrgentWord = urgentWords.some(w => text.includes(w));
  const hasRelevantContext = EDUCATION_STRONG_KEYWORDS.some(w => textHasTerm(text, w)) || CATEGORY_KEYWORDS.lowongan_kerja.some(w => textHasTerm(text, w));
  const daysSince = (Date.now() - new Date(publishedDate).getTime()) / (1000 * 60 * 60 * 24);
  return hasUrgentWord && hasRelevantContext && daysSince <= 14;
}
function expandQuery(query: string): string[] {
  const q = query.toLowerCase().trim();
  const expanded = new Set<string>([q]);
  for (const [key, values] of Object.entries(KEYWORD_EXPANSION)) {
    if (textHasTerm(q, key)) values.forEach(v => expanded.add(v));
    for (const v of values) if (textHasTerm(q, v)) expanded.add(key);
  }
  q.split(/\s+/).filter(w => w.length >= 3).forEach(w => expanded.add(w));
  return Array.from(expanded);
}
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function textHasTerm(text: string, term: string): boolean {
  const normalizedText = text.toLowerCase();
  const normalizedTerm = term.toLowerCase().trim();
  if (!normalizedTerm) return false;
  if (/[\s-]/.test(normalizedTerm)) return normalizedText.includes(normalizedTerm);
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedTerm)}([^a-z0-9]|$)`, "i").test(normalizedText);
}
function articleText(article: Article): string {
  return `${article.title} ${article.summary} ${article.tags.join(" ")} ${article.source} ${article.category}`.toLowerCase();
}
function articleContentText(article: Article): string {
  return `${article.title} ${article.summary} ${article.tags.join(" ")}`.toLowerCase();
}
function countTermMatches(value: string, terms: string[]): number {
  return terms.reduce((count, term) => count + (textHasTerm(value, term) ? 1 : 0), 0);
}
function getMeaningfulQueryTerms(query?: string): string[] {
  if (!query) return [];
  const stopWords = new Set(["dan","atau","yang","untuk","dari","dengan","info","update","terbaru","tahun"]);
  return query
    .toLowerCase()
    .split(/\s+/)
    .map(term => term.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(term => term.length >= 3 && !stopWords.has(term) && !/^\d{4}$/.test(term));
}
function matchesOriginalQueryCoverage(article: Article, originalTerms: string[]): boolean {
  if (originalTerms.length === 0) return true;
  const text = articleContentText(article);
  const matched = countTermMatches(text, originalTerms);
  return matched >= Math.min(originalTerms.length, originalTerms.length <= 2 ? 1 : 2);
}
function requestsAlternativeChannel(query?: string): boolean {
  const q = (query || "").toLowerCase();
  return ["linkedin","instagram","facebook","twitter","x.com","telegram","youtube","forum","blog","sosial","social"].some(term => textHasTerm(q, term));
}
function getSearchContext(query?: string, category?: string, tag?: string) {
  const q = (query || "").toLowerCase().trim();
  const explicitEducationIntent = ["pendidikan","pendaftaran","pmb","kampus","rpl","beasiswa","lpdp","kuliah","sekolah","universitas"].some(term => textHasTerm(q, term));
  const educationIntent =
    (category ? EDUCATION_CATEGORIES.has(category) : false) ||
    (tag ? EDUCATION_TAGS.has(tag) : false) ||
    explicitEducationIntent ||
    EDUCATION_STRONG_KEYWORDS.some(term => textHasTerm(q, term));
  const specificIntent =
    (category === "rpl" || textHasTerm(q, "rpl") || textHasTerm(q, "rekognisi pembelajaran lampau") || textHasTerm(q, "alih kredit") || textHasTerm(q, "transfer kredit")) ? "rpl" :
    (category === "beasiswa" || textHasTerm(q, "beasiswa") || textHasTerm(q, "lpdp") || textHasTerm(q, "scholarship") || tag === "Beasiswa" || tag === "LPDP") ? "beasiswa" :
    (tag === "Kampus" || textHasTerm(q, "kampus") || textHasTerm(q, "universitas")) ? "kampus" :
    (tag === "Pendaftaran" || textHasTerm(q, "pendaftaran") || textHasTerm(q, "pmb")) ? "pendaftaran" :
    (category === "pendidikan" || tag === "Pendidikan" || textHasTerm(q, "pendidikan")) ? "pendidikan" :
    null;
  return { query: q, category, tag, educationIntent, specificIntent };
}
function domainMatches(domain: string | null, candidates: string[]): boolean {
  return !!domain && candidates.some(candidate => domain === candidate || domain.endsWith("." + candidate));
}
function hasEducationOfftopic(article: Article): boolean {
  const text = articleContentText(article);
  return EDUCATION_OFFTOPIC_KEYWORDS.some(term => textHasTerm(text, term));
}
function assessEducationFit(article: Article) {
  const contentText = articleContentText(article);
  let positive = 0;
  let negative = 0;
  let strongMatches = 0;
  let contentFields = 0;
  const tagText = article.tags.join(" ");
  for (const term of EDUCATION_STRONG_KEYWORDS) {
    if (textHasTerm(article.title, term)) { positive += 18; strongMatches++; contentFields += 2; }
    if (textHasTerm(article.summary, term)) { positive += 9; strongMatches++; contentFields++; }
    if (textHasTerm(tagText, term)) { positive += 16; strongMatches++; contentFields += 2; }
  }
  if (EDUCATION_CATEGORIES.has(article.category)) positive += 8;
  if (article.tags.some(tag => EDUCATION_TAGS.has(tag))) positive += 10;
  if (EDUCATION_SOURCE_KEYWORDS.some(term => textHasTerm(article.source, term))) positive += 6;
  for (const term of EDUCATION_OFFTOPIC_KEYWORDS) {
    if (textHasTerm(contentText, term)) negative += 80;
  }
  if (article.is_job && !countTermMatches(contentText, ["dosen","guru","kampus","universitas","sekolah","pendidikan","akademik"])) negative += 70;
  if (!EDUCATION_CATEGORIES.has(article.category) && strongMatches === 0) negative += 35;
  if (contentFields === 0) negative += 45;
  const blacklisted = negative >= 70 || positive - negative < 16 || contentFields === 0;
  return { positive, negative, strongMatches, contentFields, blacklisted };
}
function allowedForEducationContext(article: Article, context: ReturnType<typeof getSearchContext>, allowRelated: boolean): boolean {
  if (!context.educationIntent) return true;
  if (hasEducationOfftopic(article)) return false;
  const fit = assessEducationFit(article);
  if (fit.blacklisted) return false;
  if (fit.strongMatches < (allowRelated ? 1 : 2) && fit.contentFields < (allowRelated ? 2 : 3)) return false;
  if (fit.positive < (allowRelated ? 28 : 40)) return false;
  return matchesSpecificIntent(article, context.specificIntent, allowRelated);
}
function matchesSpecificIntent(article: Article, specificIntent: string | null, allowRelated: boolean): boolean {
  if (!specificIntent) return true;
  const text = articleContentText(article);
  const groups: Record<string, string[]> = {
    rpl: allowRelated
      ? ["rpl","rekognisi pembelajaran lampau","alih kredit","transfer kredit","konversi sks","pmb","pendaftaran mahasiswa","kampus","universitas","sks"]
      : ["rpl","rekognisi pembelajaran lampau","alih kredit","transfer kredit","konversi sks"],
    beasiswa: allowRelated
      ? ["beasiswa","lpdp","scholarship","kip kuliah","pendanaan studi","beasiswa s2","beasiswa s3","bantuan pendidikan","kuliah gratis"]
      : ["beasiswa","lpdp","scholarship","kip kuliah","pendanaan studi","kuliah gratis"],
    kampus: ["kampus","universitas","perguruan tinggi","institut","politeknik","mahasiswa","pmb","kuliah"],
    pendaftaran: ["pendaftaran","pmb","registrasi","penerimaan mahasiswa baru","snbp","snbt","utbk","deadline","batas akhir","daftar ulang","seleksi mahasiswa"],
    pendidikan: ["pendidikan","sekolah","kampus","universitas","mahasiswa","dosen","guru","kurikulum","kuliah","beasiswa","rpl"],
  };
  const matches = countTermMatches(text, groups[specificIntent] || []);
  return matches >= (allowRelated ? 1 : 1);
}
function sourceWeight(article: Article, educationIntent: boolean): number {
  if (!educationIntent) return article.trust;
  if (EDUCATION_SOURCE_KEYWORDS.some(term => textHasTerm(article.source, term))) return article.trust + 8;
  if (/lifestyle|hiburan|tekno|inet|finance|money/i.test(article.source)) return -8;
  return article.trust;
}
function detectPlatform(source: string, url: string): string {
  const text = `${source} ${url}`.toLowerCase();
  if (/linkedin/.test(text)) return "LinkedIn";
  if (/(^|\W)(x\.com|twitter)(\W|$)/.test(text)) return "X/Twitter";
  if (/instagram/.test(text)) return "Instagram";
  if (/facebook/.test(text)) return "Facebook";
  if (/(telegram|t\.me)/.test(text)) return "Telegram";
  if (/youtube|youtu\.be/.test(text)) return "YouTube";
  if (/medium|blogspot|wordpress|blog/.test(text)) return "Blog/Forum";
  if (/jobstreet|glints|karir|kalibrr|linkedin jobs/.test(text)) return "Job Portal";
  if (/go\.id|ac\.id|sch\.id|lpdp|kemdikbud|kemdiktisaintek/.test(text)) return "Situs Resmi";
  return "Kanal Publik";
}
function verificationFor(source: string, url: string, platform: string): Article["verification_level"] {
  const domain = getDomain(url);
  const text = `${source} ${url}`.toLowerCase();
  if ((domain && (domain.endsWith(".go.id") || domain.endsWith(".ac.id") || domain.endsWith(".sch.id"))) || OFFICIAL_SOURCE_TERMS.some(term => textHasTerm(text, term))) return "Resmi";
  if (domainMatches(domain, ["linkedin.com", "jobstreet.co.id", "glints.com", "karir.com", "kalibrr.com", "youtube.com"]) || /linkedin|jobstreet|glints|karir|kalibrr|youtube/i.test(source)) return "Terverifikasi";
  if (["Telegram", "Blog/Forum", "Facebook"].includes(platform)) return "Komunitas";
  return "Belum Terverifikasi";
}
function hasSpamSignals(title: string, summary: string, url: string): boolean {
  const text = `${title} ${summary} ${url}`;
  const linkCount = (text.match(/https?:\/\//gi) || []).length;
  const repeatedPunctuation = /[!?]{4,}/.test(text);
  const tooShort = `${title} ${summary}`.replace(/\s+/g, " ").trim().length < 35;
  const spamPattern = SPAM_PATTERNS.some(pattern => pattern.test(text));
  return spamPattern || linkCount > 4 || repeatedPunctuation || tooShort;
}
function buildRelevanceReason(article: Article, queryTerms: string[], relatedTerms: string[], context: ReturnType<typeof getSearchContext>): string {
  const text = articleContentText(article);
  const matched = [...queryTerms, ...relatedTerms].filter((term, index, arr) => arr.indexOf(term) === index && textHasTerm(text, term)).slice(0, 4);
  if (context.specificIntent) return `Cocok dengan intent ${context.specificIntent}${matched.length ? `: ${matched.join(", ")}` : ""}.`;
  if (matched.length) return `Memuat kata kunci/topik terkait: ${matched.join(", ")}.`;
  if (context.category && article.category === context.category) return `Selaras dengan kategori ${context.category}.`;
  return "Dinilai relevan dari kemiripan topik, sumber, dan konteks pencarian.";
}
function scoreRelevance(article: Article, queryTerms: string[], context: ReturnType<typeof getSearchContext>): number {
  if (queryTerms.length === 0) return 0;
  const text = articleContentText(article);
  let score = 0;
  let matchedSignals = 0;
  let contentSignals = 0;
  for (const term of queryTerms) {
    if (textHasTerm(article.title, term)) { score += 34; matchedSignals++; contentSignals += 2; }
    if (textHasTerm(article.summary, term)) { score += 15; matchedSignals++; contentSignals++; }
    if (article.tags.some(tag => textHasTerm(tag, term))) { score += 24; matchedSignals++; contentSignals += 2; }
    if (textHasTerm(article.category, term)) { score += 10; matchedSignals++; }
    if (textHasTerm(article.source, term)) { score += 2; matchedSignals++; }
  }
  if (matchedSignals === 0) return 0;
  if (context.educationIntent && contentSignals === 0) return 0;
  if (context.category && context.category !== "semua" && article.category === context.category) score += 20;
  if (context.tag && article.tags.includes(context.tag)) score += 20;
  if (context.educationIntent) {
    const fit = assessEducationFit(article);
    if (!allowedForEducationContext(article, context, false)) return 0;
    score += fit.positive - fit.negative + sourceWeight(article, true);
    if (context.specificIntent && matchesSpecificIntent(article, context.specificIntent, false)) score += 24;
  } else {
    for (const term of EDUCATION_OFFTOPIC_KEYWORDS) if (textHasTerm(text, term)) score -= 10;
    score += sourceWeight(article, false);
  }
  const daysSince = (Date.now() - new Date(article.published_date).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 1) score += 8;
  else if (daysSince <= 7) score += 4;
  else if (daysSince <= 30) score += 1;
  if (article.is_urgent) score += 3;
  return score;
}
function scoreAlternative(article: Article, queryTerms: string[], relatedTerms: string[], context: ReturnType<typeof getSearchContext>): number {
  const base = scoreRelated(article, queryTerms, relatedTerms, context);
  if (base <= 0) return 0;
  let score = base;
  if (article.verification_level === "Resmi") score += 18;
  else if (article.verification_level === "Terverifikasi") score += 10;
  else if (article.verification_level === "Komunitas") score += 2;
  else score -= 5;
  if (article.platform === "Situs Resmi") score += 12;
  if (article.platform === "Job Portal" && (context.category === "lowongan_kerja" || queryTerms.some(term => CATEGORY_KEYWORDS.lowongan_kerja.some(jobTerm => textHasTerm(term, jobTerm))))) score += 10;
  if (hasSpamSignals(article.title, article.summary, article.source_url)) return 0;
  return score;
}
function buildRelatedTerms(query?: string, category?: string): string[] {
  const q = (query || "").toLowerCase().trim();
  const related = new Set<string>();
  const add = (terms: string[]) => terms.forEach(term => related.add(term));
  if (q) add(expandQuery(q));
  if (category && CATEGORY_KEYWORDS[category]) add(CATEGORY_KEYWORDS[category]);
  if (textHasTerm(q, "rpl") || category === "rpl") add(["alih kredit","rekognisi pembelajaran lampau","transfer kredit","konversi sks","pendaftaran kampus","pmb","mahasiswa baru"]);
  if (textHasTerm(q, "lpdp") || textHasTerm(q, "beasiswa") || category === "beasiswa") add(["beasiswa s2","beasiswa pemerintah","pendanaan studi","deadline pendidikan","kip kuliah","scholarship","pengumuman beasiswa"]);
  if (textHasTerm(q, "lowongan it") || textHasTerm(q, "loker it") || category === "lowongan_kerja") add(["helpdesk","it support","admin it","developer","programmer","fresh graduate","magang","internship","software engineer"]);
  if (textHasTerm(q, "kampus") || textHasTerm(q, "pmb") || category === "pendidikan") add(["pendaftaran kampus","penerimaan mahasiswa baru","universitas","alih kredit","transfer kredit","pengumuman pendidikan"]);
  return Array.from(related).filter(term => term.length >= 3);
}
function scoreRelated(article: Article, queryTerms: string[], relatedTerms: string[], context: ReturnType<typeof getSearchContext>): number {
  const text = articleContentText(article);
  let score = 0;
  let matchedSignals = 0;
  let contentSignals = 0;
  for (const term of relatedTerms) {
    if (textHasTerm(article.title, term)) { score += 18; matchedSignals++; contentSignals += 2; }
    if (textHasTerm(article.summary, term)) { score += 8; matchedSignals++; contentSignals++; }
    if (article.tags.some(tag => textHasTerm(tag, term))) { score += 14; matchedSignals++; contentSignals += 2; }
  }
  if (context.category && article.category === context.category) { score += 14; matchedSignals++; }
  if (context.tag && article.tags.includes(context.tag)) { score += 14; matchedSignals++; }
  if (queryTerms.some(term => textHasTerm(text, term))) { score += 10; matchedSignals++; contentSignals++; }
  if (matchedSignals === 0) return 0;
  if (context.educationIntent && contentSignals === 0) return 0;
  if (context.educationIntent) {
    const fit = assessEducationFit(article);
    if (!allowedForEducationContext(article, context, true)) return 0;
    score += fit.positive - fit.negative + sourceWeight(article, true);
  } else {
    score += sourceWeight(article, false);
  }
  const daysSince = (Date.now() - new Date(article.published_date).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 7) score += 5;
  else if (daysSince <= 30) score += 2;
  if (article.is_urgent) score += 3;
  if (article.source_url && isValidUrl(article.source_url)) score += 2;
  return score;
}
function scoreCategoryRelevance(article: Article, context: ReturnType<typeof getSearchContext>): number {
  let score = sourceWeight(article, context.educationIntent);
  if (context.category && article.category === context.category) score += 25;
  if (context.tag && article.tags.includes(context.tag)) score += 25;
  if (article.is_urgent) score += 3;
  if (context.educationIntent) {
    const fit = assessEducationFit(article);
    if (!allowedForEducationContext(article, context, false)) return 0;
    score += fit.positive - fit.negative;
  }
  return score;
}
function parseDate(dateStr: string): string {
  try { const d = new Date(dateStr); if (!isNaN(d.getTime())) return d.toISOString(); } catch { /* ignore */ }
  return new Date().toISOString();
}
function extractImage(content: string): string | null {
  const m = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}
function parseRssXml(xml: string, feedSource: string, defaultCategory: string, trust: number): Article[] {
  const items: Article[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const getTag = (tag: string) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
      const m2 = block.match(r);
      return m2 ? stripHtml(m2[1]) : "";
    };
    const title = getTag("title");
    const link = getTag("link") || getTag("guid");
    const description = getTag("description");
    const pubDate = getTag("pubDate") || getTag("dc:date");
    const content = block.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i)?.[1] || "";
    if (!title || !link || !isValidUrl(link)) continue;
    const summary = description.slice(0, 300) || "Tidak ada ringkasan tersedia.";
    const image = extractImage(content) || extractImage(block);
    const publishedDate = parseDate(pubDate);
    const category = categorize(title, description, defaultCategory);
    const tags = detectTags(title, summary);
    const isJob = category === "lowongan_kerja" || tags.includes("Lowongan Kerja");
    items.push({
      title: title.slice(0, 200), summary, source: feedSource, category,
      published_date: publishedDate, location: "Indonesia", source_url: link,
      ...(image ? { image_url: image } : {}),
      trust, tags, is_urgent: detectUrgent(title, summary, publishedDate), is_job: isJob,
    });
  }
  return items;
}
function parseAlternativeRssXml(xml: string, fallbackSource: string, defaultCategory: string, trust: number): Article[] {
  const items: Article[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const getTag = (tag: string) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
      const m2 = block.match(r);
      return m2 ? stripHtml(m2[1]) : "";
    };
    const title = getTag("title");
    const link = getTag("link") || getTag("guid");
    const description = getTag("description");
    const pubDate = getTag("pubDate") || getTag("dc:date");
    const sourceLabel = getTag("source") || fallbackSource;
    if (!title || !link || !isValidUrl(link) || hasSpamSignals(title, description, link)) continue;
    const summary = description.slice(0, 300) || "Ringkasan belum tersedia dari kanal publik ini.";
    const publishedDate = parseDate(pubDate);
    const category = categorize(title, description, defaultCategory);
    const tags = detectTags(title, summary);
    const platform = detectPlatform(sourceLabel, link);
    const verificationLevel = verificationFor(sourceLabel, link, platform);
    const validationNotes = ["URL tersedia dari indeks publik", "Konten lolos pemeriksaan spam dasar"];
    if (verificationLevel === "Resmi") validationNotes.push("Sumber terindikasi resmi");
    else if (verificationLevel === "Belum Terverifikasi") validationNotes.push("Sumber belum dapat dipastikan resmi");
    const isJob = category === "lowongan_kerja" || tags.includes("Lowongan Kerja");
    items.push({
      title: title.slice(0, 200),
      summary,
      source: sourceLabel,
      category,
      published_date: publishedDate,
      location: "Publik",
      source_url: link,
      trust,
      tags,
      is_urgent: detectUrgent(title, summary, publishedDate),
      is_job: isJob,
      is_alternative: true,
      platform,
      verification_level: verificationLevel,
      validation_notes: validationNotes,
      disclaimer: verificationLevel === "Resmi" || verificationLevel === "Terverifikasi" ? undefined : "Informasi dari kanal sosial/komunitas perlu dicek ulang ke sumber resmi sebelum digunakan.",
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
    if (!resp.ok) return [];
    const xml = await resp.text();
    return parseRssXml(xml, feed.source, feed.defaultCategory, feed.trust);
  } catch { return []; }
}
function buildAlternativeQueries(query: string | undefined, category: string | undefined, tag: string | undefined): string[] {
  const baseTerms = new Set<string>();
  if (query?.trim()) expandQuery(query).slice(0, 6).forEach(term => baseTerms.add(term));
  if (category && CATEGORY_KEYWORDS[category]) CATEGORY_KEYWORDS[category].slice(0, 5).forEach(term => baseTerms.add(term));
  if (tag) baseTerms.add(tag);
  if (baseTerms.size === 0) return [];
  const compact = Array.from(baseTerms).slice(0, 8).map(term => term.includes(" ") ? `"${term}"` : term).join(" OR ");
  const socialSites = "(site:linkedin.com OR site:x.com OR site:twitter.com OR site:instagram.com OR site:facebook.com OR site:t.me OR site:youtube.com)";
  const officialSites = "(site:go.id OR site:ac.id OR site:sch.id OR site:lpdp.kemenkeu.go.id OR site:kemdikbud.go.id OR site:kemdiktisaintek.go.id)";
  const publicSites = "(site:medium.com OR site:blogspot.com OR site:wordpress.com OR site:glints.com OR site:jobstreet.co.id OR site:karir.com OR site:kalibrr.com)";
  return [
    `${compact} ${officialSites} when:60d`,
    `${compact} ${socialSites} when:30d`,
    `${compact} ${publicSites} when:45d`,
  ];
}
async function fetchAlternativeFeeds(query: string | undefined, category: string | undefined, tag: string | undefined, context: ReturnType<typeof getSearchContext>, queryTerms: string[], relatedTerms: string[]): Promise<Article[]> {
  const queries = buildAlternativeQueries(query, category, tag);
  if (queries.length === 0) return [];
  const cacheKey = JSON.stringify({ query, category, tag });
  const cached = alternativeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return [...cached.articles];
  const results = await Promise.allSettled(queries.map(async q => {
    const url = `https://news.google.com/rss/search?${new URLSearchParams({ q, hl: "id", gl: "ID", ceid: "ID:id" }).toString()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const resp = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "GlobalQuizTimeHub/1.0 Alternative Reader" } });
      if (!resp.ok) return [];
      const xml = await resp.text();
      return parseAlternativeRssXml(xml, "Sumber Publik", category || "isu_global", 2);
    } finally {
      clearTimeout(timeout);
    }
  }));
  const seen = new Set<string>();
  const alternatives: Article[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      if (seen.has(item.source_url)) continue;
      seen.add(item.source_url);
      const score = scoreAlternative(item, queryTerms, relatedTerms, context);
      if (score < (context.educationIntent ? 44 : 18)) continue;
      alternatives.push({
        ...item,
        relevance_score: score,
        relevance_reason: buildRelevanceReason(item, queryTerms, relatedTerms, context),
      });
    }
  }
  alternatives.sort((a, b) => {
    const scoreDiff = (b.relevance_score ?? 0) - (a.relevance_score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.published_date).getTime() - new Date(a.published_date).getTime();
  });
  const limited = alternatives.slice(0, 12);
  alternativeCache.set(cacheKey, { timestamp: Date.now(), articles: limited });
  return limited;
}

app.post("/api/news-search", async (req, res) => {
  try {
    const { query, category, tag, sort } = req.body;
    const now = Date.now();
    let articles: Article[];
    if (cachedArticles.length > 0 && now - cacheTimestamp < CACHE_TTL) {
      articles = [...cachedArticles];
    } else {
      const results = await Promise.allSettled(RSS_FEEDS.map(fetchFeed));
      const allItems: Article[] = [];
      for (const r of results) { if (r.status === "fulfilled") allItems.push(...r.value); }
      const seen = new Set<string>();
      articles = [];
      for (const item of allItems) {
        if (!seen.has(item.source_url)) { seen.add(item.source_url); articles.push(item); }
      }
      articles.sort((a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime());
      cachedArticles = articles;
      cacheTimestamp = now;
    }
    const context = getSearchContext(query, category, tag);
    const allArticles = [...articles];
    let strictArticles = [...articles];
    if (category && category !== "semua") strictArticles = strictArticles.filter(a => a.category === category);
    if (tag) strictArticles = strictArticles.filter(a => a.tags.includes(tag));

    let primaryArticles: Article[] = strictArticles;
    let relatedArticles: Article[] = [];
    let alternativeArticles: Article[] = [];
    const terms = query && query.trim() ? expandQuery(query) : [];
    const originalTerms = getMeaningfulQueryTerms(query);
    const relatedTerms = buildRelatedTerms(query, category);

    if (terms.length > 0) {
      primaryArticles = strictArticles
        .map(a => ({ ...a, is_related: false, relevance_score: scoreRelevance(a, terms, context) }))
        .filter(a => (a.relevance_score ?? 0) >= (context.educationIntent ? 62 : 18));
      if (sort !== "recent") primaryArticles.sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));
    } else if ((category && category !== "semua") || tag) {
      primaryArticles = strictArticles
        .map(a => ({ ...a, is_related: false, relevance_score: scoreCategoryRelevance(a, context) }))
        .filter(a => (a.relevance_score ?? 0) >= (context.educationIntent ? 50 : 10));
      if (sort !== "recent") primaryArticles.sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));
    } else if (sort === "relevance") {
      primaryArticles.sort((a, b) => ((b.is_urgent ? 5 : 0) + b.trust) - ((a.is_urgent ? 5 : 0) + a.trust));
    }

    if ((query && query.trim()) || ((category && category !== "semua") && primaryArticles.length < 8)) {
      const seenPrimary = new Set(primaryArticles.map(a => a.source_url));
      relatedArticles = allArticles
        .filter(a => !seenPrimary.has(a.source_url))
        .map(a => {
          const score = scoreRelated(a, terms, relatedTerms, context);
          return {
            ...a,
            is_related: true,
            related_reason: "Hasil Terkait",
            relevance_score: score,
          };
        })
        .filter(a => (a.relevance_score ?? 0) >= (context.educationIntent ? 48 : 12))
        .sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0))
        .slice(0, Math.max(8, 16 - primaryArticles.length));
    }

    const strongMainCount = [...primaryArticles, ...relatedArticles].filter(a => matchesOriginalQueryCoverage(a, originalTerms)).length;
    const needsAlternative = (!!(query && query.trim()) || !!(category && category !== "semua") || !!tag) &&
      (primaryArticles.length + relatedArticles.length < 8 || (originalTerms.length >= 2 && strongMainCount < 5) || requestsAlternativeChannel(query));
    if (needsAlternative) {
      const seenExisting = new Set([...primaryArticles, ...relatedArticles].map(a => a.source_url));
      alternativeArticles = (await fetchAlternativeFeeds(query, category, tag, context, terms, relatedTerms))
        .filter(a => !seenExisting.has(a.source_url))
        .slice(0, Math.max(4, 12 - primaryArticles.length - relatedArticles.length));
    }

    const visibleAlternative = alternativeArticles.slice(0, 12);
    const visibleRelated = relatedArticles.slice(0, Math.max(0, 50 - visibleAlternative.length));
    const visiblePrimary = primaryArticles.slice(0, Math.max(0, 50 - visibleRelated.length - visibleAlternative.length));
    const merged = [...visiblePrimary, ...visibleRelated, ...visibleAlternative];
    return res.json({
      articles: merged,
      total: cachedArticles.length,
      filtered: merged.length,
      primary_count: primaryArticles.length,
      related_count: relatedArticles.length,
      alternative_count: alternativeArticles.length,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Unknown error", articles: [] });
  }
});

// ── /api/translate ─────────────────────────────────────────────────────────

async function callAI(body: object): Promise<Response> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

app.post("/api/translate", async (req, res) => {
  try {
    const { texts, targetLang, sourceLang = "auto", mode = "neutral", fullTranslation = false } = req.body;
    if (!texts || !targetLang) return res.status(400).json({ error: "texts and targetLang required" });
    const textArray = Array.isArray(texts) ? texts : [texts];

    if (fullTranslation) {
      const modeDesc = mode === "formal" ? "formal/professional register" : mode === "informal" ? "casual/informal register" : "neutral register";
      const sourceDesc = sourceLang === "auto" ? "Auto-detect the source language" : `Source language: ${sourceLang}`;
      const response = await callAI({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a world-class professional translator. Provide accurate, natural, contextually appropriate translations. Detect idioms, slang, technical terms, and translate them appropriately." },
          { role: "user", content: `${sourceDesc}. Translate the following text to ${targetLang} using ${modeDesc}. The translation should sound natural, as if written by a native speaker.\n\nText:\n${textArray[0]}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_full_translation",
            description: "Return complete translation with extras",
            parameters: {
              type: "object",
              properties: {
                detected_language: { type: "string" },
                translation: { type: "string" },
                alternatives: { type: "array", items: { type: "string" } },
                transliteration: { type: "string" },
                pronunciation: { type: "string" },
              },
              required: ["detected_language", "translation", "alternatives"],
              additionalProperties: false,
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "return_full_translation" } },
      });
      if (!response.ok) {
        if (response.status === 429) return res.status(429).json({ error: "Rate limited" });
        throw new Error(`AI error: ${response.status}`);
      }
      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        return res.json(JSON.parse(toolCall.function.arguments));
      }
      throw new Error("No tool call response");
    }

    // Simple batch mode
    const response = await callAI({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a translation engine. Only return valid JSON arrays of translated strings." },
        { role: "user", content: `Translate the following texts to ${targetLang}. Return a JSON array of translated strings in the same order. Only return the JSON array, nothing else.\n\nTexts:\n${JSON.stringify(textArray)}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_translations",
          description: "Return translated texts",
          parameters: {
            type: "object",
            properties: { translations: { type: "array", items: { type: "string" } } },
            required: ["translations"],
            additionalProperties: false,
          }
        }
      }],
      tool_choice: { type: "function", function: { name: "return_translations" } },
    });
    if (!response.ok) {
      if (response.status === 429) return res.status(429).json({ error: "Rate limited" });
      throw new Error(`AI error: ${response.status}`);
    }
    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let translations: string[];
    if (toolCall?.function?.arguments) {
      translations = JSON.parse(toolCall.function.arguments).translations;
    } else {
      const content = data.choices?.[0]?.message?.content || "[]";
      translations = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
    }
    return res.json({ translations });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
});

// ── /api/quiz-recommend ───────────────────────────────────────────────────────

app.post("/api/quiz-recommend", async (req, res) => {
  try {
    const { sessions, categories } = req.body;
    if (!sessions) return res.status(400).json({ error: "sessions required" });

    const categoryPerformance: Record<string, { total: number; correct: number; attempts: number }> = {};
    for (const s of sessions) {
      const catName = s.categories?.name || s.category_name || "Unknown";
      if (!categoryPerformance[catName]) categoryPerformance[catName] = { total: 0, correct: 0, attempts: 0 };
      categoryPerformance[catName].total += s.total_questions || 0;
      categoryPerformance[catName].correct += s.score || 0;
      categoryPerformance[catName].attempts += 1;
    }

    const perfStr = Object.entries(categoryPerformance).map(([cat, stats]) => {
      const acc = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
      return `- ${cat}: ${stats.attempts} attempts, ${acc}% accuracy`;
    }).join("\n");

    const prompt = `Based on this student's quiz performance, give personalized recommendations.\n\nPerformance by category:\n${perfStr}\n\nAvailable categories: ${(categories || []).map((c: any) => c.name).join(", ")}\n\nTotal quizzes completed: ${sessions.length}\n\nProvide 3-5 specific recommendations.`;

    const response = await callAI({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a personalized learning advisor. Give concise, actionable study recommendations in Indonesian language. Be encouraging and specific." },
        { role: "user", content: prompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_recommendations",
          description: "Return study recommendations",
          parameters: {
            type: "object",
            properties: {
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    category_slug: { type: "string" },
                    difficulty: { type: "string", enum: ["easy","medium","hard"] },
                    priority: { type: "string", enum: ["high","medium","low"] },
                  },
                  required: ["title","description","priority"],
                  additionalProperties: false,
                }
              },
              summary: { type: "string" },
              strongest_category: { type: "string" },
              weakest_category: { type: "string" },
            },
            required: ["recommendations","summary"],
            additionalProperties: false,
          }
        }
      }],
      tool_choice: { type: "function", function: { name: "return_recommendations" } },
    });
    if (!response.ok) {
      if (response.status === 429) return res.status(429).json({ error: "Rate limited" });
      throw new Error(`AI error: ${response.status}`);
    }
    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      return res.json(JSON.parse(toolCall.function.arguments));
    }
    throw new Error("No tool call response");
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
});

// ── start ──────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

export default app;
