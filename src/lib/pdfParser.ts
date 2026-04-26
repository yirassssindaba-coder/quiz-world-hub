export interface ParsedQuestion {
  id: string;
  number: number;
  question_text: string;
  options: { A: string; B: string; C: string; D: string };
  correct_answer: string;
  explanation: string;
  source_page: number;
  tags: string[];
  difficulty_level: string;
  question_type: 'multiple_choice' | 'true_false' | 'essay';
  is_valid: boolean;
  validation_errors: string[];
  is_duplicate: boolean;
  is_ai_generated: boolean;
  parse_errors: string[];
}

export interface ParseDebugInfo {
  total_pages: number;
  total_chars: number;
  text_preview: string;
  questions_detected: number;
  valid_count: number;
  invalid_count: number;
  parse_errors: string[];
  extraction_method: 'pdfjs' | 'ocr' | 'none';
  ocr_available: boolean;
  is_scanned_pdf: boolean;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  detected_mode: 'bank_soal' | 'materi';
  total_pages: number;
  raw_text: string;
  chapter_headings: string[];
  debug: ParseDebugInfo;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// ─── Answer detection ────────────────────────────────────────────────────────

function detectCorrectAnswer(text: string): boolean {
  return /\[x\]|\(x\)|\*|\(benar\)|✓|✔|BENAR\b/i.test(text);
}

function cleanOptionText(text: string): string {
  return text
    .replace(/\[x\]|\(x\)|\*benar\*|\(benar\)|✓|✔|BENAR\b|\[X\]|\(X\)/gi, '')
    .replace(/^[A-Da-d][.)]\s*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateQuestion(q: ParsedQuestion): { is_valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!q.question_text || q.question_text.length < 5) errors.push('Teks soal terlalu pendek');
  if (!q.options.A) errors.push('Opsi A kosong');
  if (!q.options.B) errors.push('Opsi B kosong');
  if (!q.correct_answer) errors.push('Jawaban benar tidak terdeteksi');
  if (q.question_text.length > 2000) errors.push('Teks soal terlalu panjang');
  return { is_valid: errors.length === 0, errors };
}

function detectDuplicates(questions: ParsedQuestion[]): ParsedQuestion[] {
  const seen = new Set<string>();
  return questions.map(q => {
    const key = q.question_text.toLowerCase().replace(/\s+/g, ' ').substring(0, 80).trim();
    if (seen.has(key)) return { ...q, is_duplicate: true };
    seen.add(key);
    return { ...q, is_duplicate: false };
  });
}

function detectChapterHeadings(lines: string[]): string[] {
  const headings: string[] = [];
  const headingPatterns = [
    /^(BAB|CHAPTER|UNIT|TOPIK|MATERI|BAGIAN)\s+[IVX0-9]+/i,
    /^[A-Z][A-Z\s]{5,50}$/,
    /^\d+\.\s+[A-Z][A-Za-z\s]{5,50}$/,
  ];
  for (const line of lines) {
    const trimmed = line.trim();
    if (headingPatterns.some(p => p.test(trimmed))) headings.push(trimmed);
  }
  return [...new Set(headings)].slice(0, 20);
}

// ─── Robust bank soal parser ──────────────────────────────────────────────────

/**
 * Normalize raw PDF text:
 * - Collapse multiple spaces → single space
 * - Preserve meaningful newlines
 * - Remove non-printable chars
 */
function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[^\S\n]+/g, ' ')      // multiple spaces → single (keep newlines)
    .replace(/\n{3,}/g, '\n\n')     // max 2 consecutive newlines
    .trim();
}

/**
 * Extract an explicit answer line like:
 *   Jawaban: B
 *   Answer: C
 *   Correct Answer: A
 *   Kunci: D
 *   Kunci Jawaban: B
 */
function extractExplicitAnswer(block: string): string | null {
  const m = block.match(
    /(?:jawaban|answer|correct\s*answer|kunci(?:\s*jawaban)?)\s*[:\-]?\s*([A-Da-d])\b/i
  );
  return m ? m[1].toUpperCase() : null;
}

/**
 * Parse a block of options text, returning { options, correctAnswer }.
 * Handles formats:
 *   A. text [X]
 *   A) text (x)
 *   (A) text *
 *   a. text BENAR
 *   Option can span multiple lines until next option letter.
 */
function parseOptions(optionBlock: string): { options: Record<string, string>; correctAnswer: string } {
  const options: Record<string, string> = { A: '', B: '', C: '', D: '' };
  let correctAnswer = '';

  // Split by option headers: A. / A) / (A) at start of line or after newline
  // We'll use a two-pass approach: first split, then process each chunk
  const chunks: Array<{ letter: string; text: string }> = [];
  
  // Regex to find option starts (greedy, captures everything until next option or end)
  const optionSplitRe = /(?:^|\n)\s*(?:\(([A-Da-d])\)|([A-Da-d])[.)]\s)/gm;
  
  let lastIndex = 0;
  let lastLetter = '';
  let match: RegExpExecArray | null;

  // Replace optionBlock with a version that has explicit newlines before options
  // so splitting is reliable
  const normalizedBlock = optionBlock.replace(
    /(\s)(?=\(?[A-Da-d][.)])/g, '\n'
  );

  const re2 = /(?:^|\n)\s*\(?([A-Da-d])[.)]\s*([\s\S]*?)(?=\n\s*\(?[A-Da-d][.)]|$)/gi;
  let m2: RegExpExecArray | null;
  while ((m2 = re2.exec(normalizedBlock)) !== null) {
    chunks.push({ letter: m2[1].toUpperCase(), text: m2[2].trim() });
  }

  // Fallback: simple line-by-line
  if (chunks.length === 0) {
    const lines = optionBlock.split('\n');
    let cur = '';
    for (const line of lines) {
      const lm = line.match(/^\s*\(?([A-Da-d])[.)]\s+(.*)/i);
      if (lm) {
        if (cur) chunks.push({ letter: cur, text: '' });
        cur = lm[1].toUpperCase();
        chunks.push({ letter: cur, text: lm[2].trim() });
      } else if (cur && chunks.length > 0) {
        chunks[chunks.length - 1].text += ' ' + line.trim();
      }
    }
  }

  for (const chunk of chunks) {
    const letter = chunk.letter;
    if (!options.hasOwnProperty(letter)) continue;
    const rawText = chunk.text.replace(/\s+/g, ' ').trim();
    if (detectCorrectAnswer(rawText)) {
      correctAnswer = letter;
    }
    options[letter] = cleanOptionText(rawText);
  }

  return { options, correctAnswer };
}

/**
 * Core bank soal parser — tolerant of PDF line breaks, spasi berlebih,
 * opsi pindah baris, huruf kapital/kecil, berbagai tanda jawaban.
 */
function parseBankSoal(text: string): { questions: ParsedQuestion[]; errors: string[] } {
  const questions: ParsedQuestion[] = [];
  const errors: string[] = [];

  // Split text into question blocks.
  // A question block starts with a number followed by . or ) possibly with "Soal"/"No." prefix.
  // We want to split at each new question start.
  const QUESTION_START = /(?:^|\n)[ \t]*(?:(?:soal|no\.?)\s*)?\d{1,3}[ \t]*[.):][ \t]+\S/gim;

  // Find all question start positions
  const matches: Array<{ index: number; raw: string }> = [];
  let qm: RegExpExecArray | null;
  while ((qm = QUESTION_START.exec(text)) !== null) {
    matches.push({ index: qm.index, raw: qm[0] });
  }

  if (matches.length === 0) {
    errors.push('Tidak ada pola nomor soal yang ditemukan (misal: "1.", "1)", "Soal 1.")');
    return { questions, errors };
  }

  // Extract blocks between consecutive question starts
  const blocks: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    blocks.push(text.substring(start, end).trim());
  }

  let qNumber = 1;
  for (const block of blocks) {
    if (!block || block.length < 10) continue;

    const blockErrors: string[] = [];

    // Remove leading question number prefix
    const questionBody = block
      .replace(/^[ \t]*(?:(?:soal|no\.?)\s*)?\d{1,3}[ \t]*[.):]\s*/i, '')
      .trim();

    if (!questionBody) {
      blockErrors.push(`Blok ${qNumber}: isi kosong setelah nomor`);
      errors.push(...blockErrors);
      qNumber++;
      continue;
    }

    // Find where options begin: a line starting with A. A) (A) etc.
    // We look for the first occurrence of an option pattern
    const OPTION_START_RE = /(?:^|\n)[ \t]*\(?[A-Da-d][.)]\s+\S/m;
    const optionMatch = OPTION_START_RE.exec(questionBody);

    if (!optionMatch) {
      blockErrors.push(`Soal ${qNumber}: opsi A-D tidak ditemukan`);
      errors.push(...blockErrors);

      // Still push partial question to allow user to see it
      const partial: ParsedQuestion = {
        id: generateId(),
        number: qNumber++,
        question_text: questionBody.substring(0, 500).trim(),
        options: { A: '', B: '', C: '', D: '' },
        correct_answer: '',
        explanation: '',
        source_page: 0,
        tags: [],
        difficulty_level: 'medium',
        question_type: 'multiple_choice',
        is_valid: false,
        validation_errors: ['Opsi A-D tidak ditemukan'],
        is_duplicate: false,
        is_ai_generated: false,
        parse_errors: blockErrors,
      };
      questions.push(partial);
      continue;
    }

    const questionText = questionBody.substring(0, optionMatch.index).replace(/\s+/g, ' ').trim();
    const optionBlock = questionBody.substring(optionMatch.index).trim();

    if (!questionText || questionText.length < 3) {
      blockErrors.push(`Soal ${qNumber}: teks pertanyaan kosong`);
    }

    // Parse options
    const { options, correctAnswer: optCorrect } = parseOptions(optionBlock);

    // Check for explicit answer line (overrides marker in option text)
    const explicitAnswer = extractExplicitAnswer(block);
    const finalAnswer = explicitAnswer || optCorrect;

    if (!finalAnswer) {
      blockErrors.push(`Soal ${qNumber}: jawaban benar tidak terdeteksi (gunakan [X], (X), atau "Jawaban: B")`);
    }

    const parsed: ParsedQuestion = {
      id: generateId(),
      number: qNumber++,
      question_text: questionText,
      options: options as { A: string; B: string; C: string; D: string },
      correct_answer: finalAnswer,
      explanation: '',
      source_page: 0,
      tags: [],
      difficulty_level: 'medium',
      question_type: 'multiple_choice',
      is_valid: false,
      validation_errors: [],
      is_duplicate: false,
      is_ai_generated: false,
      parse_errors: blockErrors,
    };

    const { is_valid, errors: validErrors } = validateQuestion(parsed);
    parsed.is_valid = is_valid;
    parsed.validation_errors = validErrors;

    errors.push(...blockErrors);
    questions.push(parsed);
  }

  return { questions: detectDuplicates(questions), errors };
}

// ─── Material → AI quiz generator ───────────────────────────────────────────

function generateQuestionsFromMaterial(text: string, pages: number): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  const sentences = text
    .split(/[.!?]\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 30 && s.length < 300);

  const templates = [
    (s: string) => ({
      q: `Manakah pernyataan berikut yang BENAR tentang: "${s.substring(0, 80).trim()}..."?`,
      correct: 'A',
      opts: { A: 'Pernyataan sesuai dengan definisi', B: 'Pernyataan tidak relevan', C: 'Pernyataan bertentangan dengan teori', D: 'Pernyataan memerlukan data tambahan' },
    }),
    (s: string) => ({
      q: `Berdasarkan materi, konsep yang dijelaskan dalam "${s.substring(0, 60).trim()}" termasuk dalam kategori?`,
      correct: 'B',
      opts: { A: 'Konsep dasar abstrak', B: 'Konsep terapan praktis', C: 'Konsep historis', D: 'Konsep spekulatif' },
    }),
    (s: string) => ({
      q: `Apakah implikasi utama dari konsep berikut: "${s.substring(0, 70).trim()}"?`,
      correct: 'C',
      opts: { A: 'Tidak ada implikasi signifikan', B: 'Hanya berlaku dalam teori', C: 'Berpengaruh pada penerapan praktis', D: 'Hanya relevan secara historis' },
    }),
  ];

  const selected = sentences.filter(s => s.length > 40).slice(0, 30);
  selected.forEach((sentence, i) => {
    const tpl = templates[i % templates.length](sentence);
    questions.push({
      id: generateId(),
      number: i + 1,
      question_text: tpl.q,
      options: tpl.opts as { A: string; B: string; C: string; D: string },
      correct_answer: tpl.correct,
      explanation: `Berdasarkan materi: "${sentence.substring(0, 150).trim()}"`,
      source_page: Math.ceil((i / selected.length) * pages),
      tags: ['AI-generated', 'materi'],
      difficulty_level: 'medium',
      question_type: 'multiple_choice',
      is_valid: true,
      validation_errors: [],
      is_duplicate: false,
      is_ai_generated: true,
      parse_errors: [],
    });
  });

  return detectDuplicates(questions);
}

// ─── PDF.js extraction ───────────────────────────────────────────────────────

let _pdfjsInitialized = false;

async function initPdfjs() {
  if (_pdfjsInitialized) return;
  const pdfjsLib = await import('pdfjs-dist');
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }
  _pdfjsInitialized = true;
}

/**
 * Extract text from PDF preserving line structure.
 * PDF.js returns text items with x/y coordinates — we group by y-position
 * to reconstruct lines accurately instead of just joining with spaces.
 */
export async function extractPdfText(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ pages: string[]; totalPages: number }> {
  await initPdfjs();
  const pdfjsLib = await import('pdfjs-dist');

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pages: string[] = [];
  const total = pdf.numPages;

  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Group text items by their rounded y-coordinate (same line = same y)
    const lineMap: Map<number, Array<{ x: number; str: string }>> = new Map();
    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const transform = (item as any).transform as number[];
      const y = transform ? Math.round(transform[5]) : 0;
      const x = transform ? Math.round(transform[4]) : 0;
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push({ x, str: item.str });
    }

    // Sort lines by y descending (PDF origin is bottom-left), then x ascending
    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);
    const pageLines = sortedYs.map(y => {
      const items = lineMap.get(y)!.sort((a, b) => a.x - b.x);
      return items.map(it => it.str).join(' ').trim();
    }).filter(l => l.length > 0);

    pages.push(pageLines.join('\n'));
    if (onProgress) onProgress(Math.round((i / total) * 100));
  }

  return { pages, totalPages: total };
}

// ─── OCR fallback with Tesseract.js ──────────────────────────────────────────

export async function extractPdfTextWithOCR(
  file: File,
  onProgress?: (pct: number, status: string) => void,
): Promise<{ pages: string[]; totalPages: number }> {
  const Tesseract = await import('tesseract.js');
  const { createWorker } = Tesseract;

  // Convert PDF pages to images first via PDF.js canvas render
  await initPdfjs();
  const pdfjsLib = await import('pdfjs-dist');
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const total = pdf.numPages;

  const worker = await createWorker('ind+eng', 1, {
    logger: (m: any) => {
      if (onProgress && m.status === 'recognizing text') {
        onProgress(Math.round(m.progress * 100), `OCR Halaman ${m.userJobId || ''}...`);
      }
    },
  });

  const pages: string[] = [];

  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;

    if (onProgress) onProgress(Math.round((i / total) * 40), `Render halaman ${i}/${total}...`);

    const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/png'));
    const { data } = await worker.recognize(blob);
    pages.push(data.text || '');

    if (onProgress) onProgress(Math.round(40 + (i / total) * 60), `OCR halaman ${i}/${total}...`);
  }

  await worker.terminate();
  return { pages, totalPages: total };
}

// ─── Public parseQuestions ───────────────────────────────────────────────────

export function parseQuestions(pages: string[], totalPages: number): ParseResult {
  const rawText = pages.join('\n');
  const normalized = normalizeText(rawText);
  const lines = normalized.split('\n');

  const chapterHeadings = detectChapterHeadings(lines);

  // Detect mode: bank soal requires numbered questions AND options
  const hasNumberedQuestions = /(?:^|\n)[ \t]*(?:(?:soal|no\.?)\s*)?\d{1,3}[ \t]*[.):]/im.test(normalized);
  const hasOptions = /(?:^|\n)[ \t]*\(?[A-Da-d][.)]\s+\S/im.test(normalized);
  const hasAnswerMarkers = /\[x\]|\(x\)|correct\s*answer\s*:|jawaban\s*:|kunci\s*:/i.test(normalized);

  const isBankSoal = hasNumberedQuestions && hasOptions;
  const detected_mode: 'bank_soal' | 'materi' = isBankSoal ? 'bank_soal' : 'materi';

  let questions: ParsedQuestion[];
  let parseErrors: string[] = [];

  if (isBankSoal) {
    const result = parseBankSoal(normalized);
    questions = result.questions;
    parseErrors = result.errors;
  } else {
    questions = generateQuestionsFromMaterial(normalized, totalPages);
    if (!hasNumberedQuestions) {
      parseErrors.push('Pola nomor soal (1., 2., dst.) tidak ditemukan — mode materi aktif, quiz digenerate dari konten');
    }
  }

  // Assign source pages roughly
  if (isBankSoal && questions.length > 0) {
    questions.forEach((q, i) => {
      q.source_page = Math.ceil(((i + 1) / questions.length) * totalPages);
    });
  }

  // Auto-detect difficulty
  questions.forEach(q => {
    const text = q.question_text.toLowerCase();
    if (/s3|advanced|analisis|evaluasi|audit|capital budgeting/.test(text)) q.difficulty_level = 'hard';
    else if (/s2|intermediate|jurnal|hpp|rasio|biaya/.test(text)) q.difficulty_level = 'medium';
    else if (/s1|dasar|basic|konsep|definisi/.test(text)) q.difficulty_level = 'easy';
  });

  const validCount = questions.filter(q => q.is_valid && !q.is_duplicate).length;
  const invalidCount = questions.filter(q => !q.is_valid).length;
  const isScanned = rawText.length < 200 && totalPages > 0;

  const debug: ParseDebugInfo = {
    total_pages: totalPages,
    total_chars: rawText.length,
    text_preview: normalized.substring(0, 500),
    questions_detected: questions.length,
    valid_count: validCount,
    invalid_count: invalidCount,
    parse_errors: parseErrors,
    extraction_method: 'pdfjs',
    ocr_available: true,
    is_scanned_pdf: isScanned,
  };

  return {
    questions,
    detected_mode,
    total_pages: totalPages,
    raw_text: rawText,
    chapter_headings: chapterHeadings,
    debug,
  };
}

// ─── Category mapping ─────────────────────────────────────────────────────────

export const CATEGORY_MAPPINGS: Record<string, string[]> = {
  'Dasar Akuntansi': ['dasar', 'akuntansi', 'konsep', 'definisi', 'prinsip', 'asumsi'],
  'Jurnal & Buku Besar': ['jurnal', 'buku besar', 'debit', 'kredit', 'posting', 'ledger'],
  'Harga Pokok Produksi': ['hpp', 'harga pokok', 'biaya produksi', 'overhead', 'bahan baku'],
  'Rasio Keuangan': ['rasio', 'likuiditas', 'solvabilitas', 'profitabilitas', 'aktivitas'],
  'Biaya & Anggaran': ['biaya', 'anggaran', 'budget', 'variance', 'standar'],
  'Capital Budgeting': ['npv', 'irr', 'payback', 'capital budgeting', 'investasi', 'pi'],
  'Audit & Risiko': ['audit', 'risiko', 'risk', 'materialitas', 'pengendalian internal'],
  'Laporan Keuangan': ['laporan keuangan', 'neraca', 'laba rugi', 'arus kas', 'ekuitas'],
  'Pajak': ['pajak', 'ppn', 'pph', 'tax', 'fiskal'],
  'Umum': [],
};

export function autoMapCategory(questionText: string): string {
  const lower = questionText.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_MAPPINGS)) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return 'Umum';
}
