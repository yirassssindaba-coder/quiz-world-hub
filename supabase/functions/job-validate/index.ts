import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Trusted job portal domains
const TRUSTED_PORTALS = [
  "jobstreet.co.id", "jobstreet.com", "glints.com", "linkedin.com",
  "karir.com", "kalibrr.com", "indeed.com", "topkarir.com", "loker.id",
  "kemnaker.go.id", "bkn.go.id",
];

// Suspicious indicators (red flags)
const RED_FLAG_PATTERNS = [
  { pattern: /bayar (pendaftaran|administrasi|deposit|biaya)/i, weight: -30, reason: "Meminta pembayaran/biaya pendaftaran" },
  { pattern: /transfer (uang|sejumlah|biaya)/i, weight: -30, reason: "Meminta transfer uang" },
  { pattern: /(kirim|berikan) (ktp|foto ktp|selfie ktp|nomor rekening|pin atm)/i, weight: -25, reason: "Meminta data sensitif (KTP/rekening) di luar proses interview" },
  { pattern: /gaji.{0,20}(50|60|70|80|90|100).?(juta|jt)/i, weight: -15, reason: "Tawaran gaji tidak wajar untuk fresh graduate" },
  { pattern: /(bit\.ly|tinyurl|t\.co|goo\.gl|cutt\.ly|s\.id)\//i, weight: -25, reason: "Menggunakan URL pemendek (mencurigakan)" },
  { pattern: /(whatsapp|wa).{0,30}(saja|only|langsung)/i, weight: -10, reason: "Kontak hanya melalui WhatsApp tanpa email resmi" },
  { pattern: /tanpa (interview|wawancara|tes|seleksi)/i, weight: -20, reason: "Tidak ada proses interview/seleksi" },
  { pattern: /langsung (kerja|cair|gaji)/i, weight: -10, reason: "Janji 'langsung kerja/cair' tidak realistis" },
  { pattern: /(jaminan|garansi).{0,20}(diterima|lolos)/i, weight: -15, reason: "Jaminan diterima/lolos tidak wajar" },
];

// Positive indicators (green flags)
const GREEN_FLAG_PATTERNS = [
  { pattern: /(deskripsi pekerjaan|job description|tugas|tanggung jawab|responsibilities)/i, weight: 8, reason: "Deskripsi pekerjaan jelas" },
  { pattern: /(persyaratan|requirements|kualifikasi|qualifications)/i, weight: 8, reason: "Mencantumkan persyaratan" },
  { pattern: /(benefit|tunjangan|asuransi|bpjs|thr)/i, weight: 5, reason: "Mencantumkan benefit/tunjangan" },
  { pattern: /(pengalaman|experience).{0,30}(tahun|years|bulan|months)/i, weight: 5, reason: "Mencantumkan pengalaman dibutuhkan" },
  { pattern: /(lokasi|location|wfh|wfo|hybrid|remote)/i, weight: 3, reason: "Lokasi kerja jelas" },
  { pattern: /(s1|s2|d3|sma|smk|fresh graduate|lulusan)/i, weight: 4, reason: "Pendidikan minimum jelas" },
];

interface JobValidationResult {
  verdict: "verified" | "caution" | "suspicious";
  score: number;
  reasons: string[];
  trust_signals: string[];
  red_flags: string[];
}

function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function validateJob(title: string, summary: string, sourceUrl: string, source: string): JobValidationResult {
  const text = `${title} ${summary}`;
  let score = 50; // start at neutral
  const reasons: string[] = [];
  const trustSignals: string[] = [];
  const redFlags: string[] = [];

  const domain = getDomain(sourceUrl);

  // Check trusted portal
  if (domain && TRUSTED_PORTALS.some(d => domain === d || domain.endsWith("." + d))) {
    score += 25;
    trustSignals.push(`Sumber dari portal kerja terpercaya (${domain})`);
  } else if (domain && (domain.endsWith(".go.id") || domain.endsWith(".ac.id"))) {
    score += 30;
    trustSignals.push(`Sumber dari domain resmi (${domain})`);
  } else if (domain && domain.endsWith(".co.id")) {
    score += 8;
    trustSignals.push(`Domain perusahaan Indonesia (${domain})`);
  } else if (!domain) {
    score -= 10;
    redFlags.push("URL tidak valid");
  }

  // Check red flags
  for (const { pattern, weight, reason } of RED_FLAG_PATTERNS) {
    if (pattern.test(text)) {
      score += weight;
      redFlags.push(reason);
    }
  }

  // Check green flags
  let greenCount = 0;
  for (const { pattern, weight, reason } of GREEN_FLAG_PATTERNS) {
    if (pattern.test(text)) {
      score += weight;
      trustSignals.push(reason);
      greenCount++;
    }
  }

  if (greenCount === 0 && summary.length < 80) {
    score -= 10;
    redFlags.push("Deskripsi pekerjaan terlalu singkat / tidak jelas");
  }

  // Clamp score 0-100
  score = Math.max(0, Math.min(100, score));

  let verdict: JobValidationResult["verdict"];
  if (score >= 70) verdict = "verified";
  else if (score >= 40) verdict = "caution";
  else verdict = "suspicious";

  reasons.push(...trustSignals.slice(0, 3));
  if (redFlags.length > 0) reasons.push(...redFlags.slice(0, 3));

  return { verdict, score, reasons, trust_signals: trustSignals, red_flags: redFlags };
}

interface JobInput {
  title: string;
  summary: string;
  source_url: string;
  source: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { jobs } = body as { jobs?: JobInput[] };

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return new Response(JSON.stringify({ error: "Array 'jobs' diperlukan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (jobs.length > 100) {
      return new Response(JSON.stringify({ error: "Maksimum 100 lowongan per request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = jobs.map(job => ({
      source_url: job.source_url,
      ...validateJob(job.title || "", job.summary || "", job.source_url || "", job.source || ""),
    }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("job-validate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
