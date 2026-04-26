import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Upload, FileText, CheckCircle2, AlertCircle, XCircle, Edit3, Trash2,
  ChevronRight, ChevronLeft, Sparkles, BookOpen, Filter, Download,
  RefreshCw, Eye, Save, Tag, Layers, Info, BarChart3, Search,
  BugPlay, ScanLine, AlertTriangle, ChevronDown, Copy
} from 'lucide-react';
import {
  extractPdfText, extractPdfTextWithOCR, parseQuestions, autoMapCategory, CATEGORY_MAPPINGS,
  type ParsedQuestion, type ParseResult
} from '@/lib/pdfParser';

type Step = 'upload' | 'extracting' | 'preview' | 'configure' | 'importing' | 'done';
type ExtractionError = 'scanned_pdf' | 'no_pattern' | 'empty_text' | null;

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  hard: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

// Minimum character count to consider text extraction successful
const MIN_TEXT_CHARS = 150;

export default function QuizImporter() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractStatus, setExtractStatus] = useState('Membaca file...');
  const [isOcrMode, setIsOcrMode] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<'all' | 'valid' | 'invalid' | 'duplicate' | 'ai'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingQ, setEditingQ] = useState<ParsedQuestion | null>(null);
  const [editForm, setEditForm] = useState<Partial<ParsedQuestion>>({});
  const [categoryMapping, setCategoryMapping] = useState<Record<string, string>>({});
  const [globalCategory, setGlobalCategory] = useState('');
  const [existingCategories, setExistingCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [extractionError, setExtractionError] = useState<ExtractionError>(null);
  const [debugOpen, setDebugOpen] = useState(false);

  const loadCategories = async () => {
    const { data } = await supabase.from('categories').select('id, name, slug').order('name');
    setExistingCategories(data || []);
  };

  const processExtractedText = useCallback(async (pages: string[], totalPages: number, method: 'pdfjs' | 'ocr') => {
    setExtractStatus('Menganalisis soal...');
    setExtractProgress(85);

    const result = parseQuestions(pages, totalPages);
    result.debug.extraction_method = method;

    setParseResult(result);
    setQuestions(result.questions);

    const autoSelected = new Set(
      result.questions.filter(q => q.is_valid && !q.is_duplicate).map(q => q.id)
    );
    setSelectedIds(autoSelected);

    setExtractProgress(100);
    await loadCategories();
    setTimeout(() => setStep('preview'), 400);
  }, []);

  const handleFileSelect = useCallback(async (f: File) => {
    if (!f || f.type !== 'application/pdf') {
      toast({ title: 'Hanya file PDF yang didukung', variant: 'destructive' });
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      toast({ title: 'Ukuran file maks 50MB', variant: 'destructive' });
      return;
    }
    setFile(f);
    setStep('extracting');
    setExtractProgress(5);
    setExtractionError(null);
    setIsOcrMode(false);

    try {
      setExtractStatus('Memuat PDF.js...');
      setExtractProgress(10);

      const { pages, totalPages } = await extractPdfText(f, (pct) => {
        setExtractProgress(10 + Math.round(pct * 0.6));
        setExtractStatus(`Membaca halaman PDF... (${Math.round(pct)}%)`);
      });

      const rawText = pages.join('\n');
      const totalChars = rawText.trim().length;

      setExtractProgress(72);
      setExtractStatus('Memeriksa konten...');

      if (totalChars < MIN_TEXT_CHARS) {
        // Scanned PDF — offer OCR
        setExtractionError('scanned_pdf');
        setExtractProgress(100);
        setExtractStatus('PDF tanpa teks — kemungkinan scan/gambar');
        // Proceed to preview so user sees the debug info + OCR option
        const emptyResult = parseQuestions(pages, totalPages);
        emptyResult.debug.is_scanned_pdf = true;
        setParseResult(emptyResult);
        setQuestions([]);
        setSelectedIds(new Set());
        await loadCategories();
        setTimeout(() => setStep('preview'), 400);
        return;
      }

      await processExtractedText(pages, totalPages, 'pdfjs');

    } catch (err) {
      console.error('PDF extraction error:', err);
      toast({
        title: 'Gagal memproses PDF',
        description: String(err).includes('password') ? 'PDF terproteksi password.' : 'Coba file lain atau gunakan OCR.',
        variant: 'destructive',
      });
      setStep('upload');
    }
  }, [toast, processExtractedText]);

  const handleOcrFallback = useCallback(async () => {
    if (!file) return;
    setStep('extracting');
    setIsOcrMode(true);
    setExtractProgress(5);
    setExtractionError(null);

    try {
      setExtractStatus('Memuat Tesseract OCR...');
      const { pages, totalPages } = await extractPdfTextWithOCR(file, (pct, status) => {
        setExtractProgress(pct);
        setExtractStatus(status || `OCR: ${pct}%`);
      });
      await processExtractedText(pages, totalPages, 'ocr');
    } catch (err) {
      console.error('OCR error:', err);
      toast({ title: 'OCR gagal', description: 'Pastikan browser mendukung WebAssembly.', variant: 'destructive' });
      setStep('upload');
    }
  }, [file, toast, processExtractedText]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  const filteredQuestions = questions.filter(q => {
    if (filterMode === 'valid') return q.is_valid && !q.is_duplicate;
    if (filterMode === 'invalid') return !q.is_valid;
    if (filterMode === 'duplicate') return q.is_duplicate;
    if (filterMode === 'ai') return q.is_ai_generated;
    return true;
  }).filter(q =>
    searchQuery ? q.question_text.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredQuestions.map(q => q.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const openEdit = (q: ParsedQuestion) => { setEditingQ(q); setEditForm({ ...q }); };
  const saveEdit = () => {
    if (!editingQ) return;
    setQuestions(prev => prev.map(q => q.id === editingQ.id ? { ...q, ...editForm } as ParsedQuestion : q));
    setEditingQ(null);
  };
  const deleteQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleImport = async () => {
    if (!user) { toast({ title: 'Silakan login terlebih dahulu', variant: 'destructive' }); return; }
    const toImport = questions.filter(q => selectedIds.has(q.id));
    if (toImport.length === 0) { toast({ title: 'Pilih minimal 1 soal untuk diimport', variant: 'destructive' }); return; }
    setStep('importing');

    let imported = 0, skipped = 0;
    const byCategory: Record<string, ParsedQuestion[]> = {};
    toImport.forEach(q => {
      const cat = categoryMapping[q.id] || globalCategory || autoMapCategory(q.question_text);
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(q);
    });

    for (const [catName, qs] of Object.entries(byCategory)) {
      let categoryId: string;
      const existingCat = existingCategories.find(c =>
        c.name.toLowerCase() === catName.toLowerCase() || c.id === catName
      );
      if (existingCat) {
        categoryId = existingCat.id;
      } else {
        const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const { data: newCat, error } = await supabase.from('categories').insert({
          name: catName,
          slug: `${slug}-${Date.now()}`,
          description: `Kategori dari PDF: ${file?.name || 'import'}`,
        }).select().single();
        if (error || !newCat) { skipped += qs.length; continue; }
        categoryId = newCat.id;
        setExistingCategories(prev => [...prev, { id: newCat.id, name: newCat.name, slug: newCat.slug }]);
      }

      for (const q of qs) {
        const { error } = await supabase.from('questions').insert({
          category_id: categoryId,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation || null,
          difficulty_level: q.difficulty_level,
          created_by: user.id,
        });
        if (error) skipped++; else imported++;
      }
    }

    setImportResult({ imported, skipped });
    setStep('done');
    toast({ title: `Import selesai! ${imported} soal berhasil diimport`, description: skipped > 0 ? `${skipped} soal gagal/dilewati` : 'Semua soal berhasil.' });
  };

  const reset = () => {
    setStep('upload'); setFile(null); setParseResult(null); setQuestions([]);
    setSelectedIds(new Set()); setFilterMode('all'); setSearchQuery('');
    setImportResult(null); setCategoryMapping({}); setGlobalCategory('');
    setExtractionError(null); setIsOcrMode(false); setDebugOpen(false);
  };

  const exportCSV = () => {
    const selected = questions.filter(q => selectedIds.has(q.id));
    const rows = [
      ['No', 'Soal', 'Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Jawaban Benar', 'Penjelasan', 'Tingkat', 'Halaman'],
      ...selected.map(q => [q.number, q.question_text, q.options.A, q.options.B, q.options.C, q.options.D, q.correct_answer, q.explanation, q.difficulty_level, q.source_page]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `quiz_export_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export CSV berhasil' });
  };

  const validCount = questions.filter(q => q.is_valid && !q.is_duplicate).length;
  const invalidCount = questions.filter(q => !q.is_valid).length;
  const dupCount = questions.filter(q => q.is_duplicate).length;
  const aiCount = questions.filter(q => q.is_ai_generated).length;

  const debug = parseResult?.debug;

  // Determine preview error state
  const isScanned = debug?.is_scanned_pdf || extractionError === 'scanned_pdf';
  const hasNoPattern = !isScanned && debug && debug.total_chars >= MIN_TEXT_CHARS && questions.length === 0;
  const hasZeroQuestions = questions.length === 0;

  return (
    <div className="container py-8 sm:py-12 max-w-6xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-[Space_Grotesk]">PDF Quiz Importer</h1>
            <p className="text-sm text-muted-foreground">Ubah PDF bank soal atau materi menjadi quiz interaktif otomatis</p>
          </div>
        </div>

        {/* Step Progress */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-1">
          {(['upload', 'preview', 'configure', 'done'] as const).map((s, i) => {
            const stepLabels: Record<string, string> = { upload: 'Upload PDF', preview: 'Preview & Edit', configure: 'Konfigurasi', done: 'Selesai' };
            const stepIdx: Record<string, number> = { upload: 0, extracting: 0, preview: 1, configure: 2, importing: 3, done: 3 };
            const current = stepIdx[step] ?? 0;
            const isActive = current === i;
            const isDone = current > i;
            return (
              <div key={s} className="flex items-center gap-2 shrink-0">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isActive ? 'bg-primary text-primary-foreground' : isDone ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                  {isDone ? <CheckCircle2 className="h-3 w-3" /> : <span>{i + 1}</span>}
                  {stepLabels[s]}
                </div>
                {i < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>
            );
          })}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">

        {/* ── UPLOAD STEP ─────────────────────────────────────── */}
        {step === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div
              ref={dropRef}
              data-testid="drop-zone-pdf"
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 sm:p-20 text-center cursor-pointer transition-all duration-200 ${isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
            >
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} data-testid="input-pdf-file" />
              <div className="flex flex-col items-center gap-4">
                <div className={`h-16 w-16 rounded-2xl flex items-center justify-center transition-all ${isDragging ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                  <Upload className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-lg font-semibold mb-1">{isDragging ? 'Lepaskan file di sini' : 'Drag & drop atau klik untuk upload'}</p>
                  <p className="text-sm text-muted-foreground">PDF bank soal, modul materi, catatan belajar — maks 50MB</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              {[
                { icon: BookOpen, title: 'Bank Soal', desc: 'PDF dengan soal bernomor, opsi A/B/C/D, dan [X] untuk jawaban benar', color: 'text-violet-500' },
                { icon: FileText, title: 'Modul Materi', desc: 'PDF materi/ringkasan — quiz AI-generated akan dibuat otomatis', color: 'text-blue-500' },
                { icon: Layers, title: 'Format Campuran', desc: 'Dokumen dengan bab, soal latihan, dan rumus — semua diproses', color: 'text-emerald-500' },
              ].map(item => (
                <Card key={item.title} className="border-border/50">
                  <CardContent className="pt-5">
                    <item.icon className={`h-6 w-6 ${item.color} mb-2`} />
                    <p className="font-medium text-sm mb-1">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="mt-4 border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="pt-4 flex gap-3">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Format jawaban benar yang didukung</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {['[X] atau [x]', '(X) atau (x)', 'Jawaban: B', 'Answer: C', 'Kunci: A', '✓ setelah opsi', '* setelah opsi'].map(fmt => (
                      <code key={fmt} className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded">{fmt}</code>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── EXTRACTING STEP ──────────────────────────────────── */}
        {step === 'extracting' && (
          <motion.div key="extracting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-24 gap-6">
            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center animate-pulse ${isOcrMode ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-violet-500 to-indigo-600'}`}>
              {isOcrMode ? <ScanLine className="h-8 w-8 text-white" /> : <FileText className="h-8 w-8 text-white" />}
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-1">{isOcrMode ? 'OCR Scanning...' : 'Memproses PDF...'}</h3>
              <p className="text-sm text-muted-foreground">{file?.name}</p>
              {isOcrMode && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">OCR membutuhkan waktu lebih lama</p>}
            </div>
            <div className="w-full max-w-sm">
              <Progress value={extractProgress} className="h-2" />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>{extractStatus}</span>
                <span>{extractProgress}%</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── PREVIEW STEP ─────────────────────────────────────── */}
        {step === 'preview' && parseResult && (
          <motion.div key="preview" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* ── Error states ─────────────────────────────── */}
            {isScanned && (
              <Card className="mb-5 border-orange-300 dark:border-orange-800/60 bg-orange-50/60 dark:bg-orange-950/20">
                <CardContent className="pt-5 flex gap-4">
                  <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
                    <ScanLine className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-orange-800 dark:text-orange-300 mb-1">PDF kemungkinan berupa scan/gambar</p>
                    <p className="text-sm text-orange-700 dark:text-orange-400 mb-3">
                      Ekstraksi teks menghasilkan {debug?.total_chars ?? 0} karakter (minimum {MIN_TEXT_CHARS}).
                      PDF ini kemungkinan merupakan hasil scan atau gambar tanpa text layer.
                      Jalankan OCR untuk mencoba membaca konten.
                    </p>
                    <Button
                      data-testid="button-run-ocr"
                      onClick={handleOcrFallback}
                      className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
                      size="sm"
                    >
                      <ScanLine className="h-4 w-4" /> Jalankan OCR (Tesseract.js)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {hasNoPattern && !isScanned && (
              <Card className="mb-5 border-rose-300 dark:border-rose-800/60 bg-rose-50/60 dark:bg-rose-950/20">
                <CardContent className="pt-5 flex gap-4">
                  <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-rose-800 dark:text-rose-300 mb-1">Teks PDF berhasil dibaca tetapi pola soal tidak cocok</p>
                    <p className="text-sm text-rose-700 dark:text-rose-400 mb-2">
                      {debug?.total_chars.toLocaleString()} karakter berhasil diekstrak dari {debug?.total_pages} halaman,
                      tetapi sistem tidak menemukan pola soal bernomor (1., 2., dst.) dengan opsi A/B/C/D.
                    </p>
                    <p className="text-xs text-rose-600 dark:text-rose-500 mb-3">
                      Pastikan PDF menggunakan format: <code className="bg-rose-100 dark:bg-rose-900/50 px-1 rounded">1. Pertanyaan</code> diikuti <code className="bg-rose-100 dark:bg-rose-900/50 px-1 rounded">A. Opsi</code>, <code className="bg-rose-100 dark:bg-rose-900/50 px-1 rounded">B. Opsi</code>, dst.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Button data-testid="button-retry-ocr" variant="outline" size="sm" onClick={handleOcrFallback} className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50">
                        <ScanLine className="h-3.5 w-3.5" /> Coba OCR
                      </Button>
                      <Button data-testid="button-retry-upload" variant="outline" size="sm" onClick={reset} className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50">
                        <Upload className="h-3.5 w-3.5" /> Upload File Lain
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── OCR mode indicator ────────────────────────── */}
            {debug?.extraction_method === 'ocr' && (
              <Card className="mb-4 border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="pt-4 flex gap-3">
                  <ScanLine className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-300">Teks diambil via OCR (Tesseract.js) — akurasi tergantung kualitas scan.</p>
                </CardContent>
              </Card>
            )}

            {/* ── AI mode indicator ─────────────────────────── */}
            {parseResult.detected_mode === 'materi' && questions.length > 0 && (
              <Card className="mb-4 border-violet-200 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/20">
                <CardContent className="pt-4 flex gap-3">
                  <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-violet-800 dark:text-violet-300">AI-Generated Quiz</p>
                    <p className="text-xs text-violet-700 dark:text-violet-400 mt-0.5">PDF terdeteksi sebagai materi/ringkasan. Quiz dibuat otomatis dari konten — harap review sebelum publish.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Debug Panel ───────────────────────────────── */}
            <Collapsible open={debugOpen} onOpenChange={setDebugOpen} className="mb-5">
              <CollapsibleTrigger asChild>
                <Button
                  data-testid="button-toggle-debug"
                  variant="outline"
                  size="sm"
                  className="w-full justify-between text-xs border-dashed gap-2 text-muted-foreground"
                >
                  <span className="flex items-center gap-2">
                    <BugPlay className="h-3.5 w-3.5" />
                    Debug Panel — Info Ekstraksi
                    {debug && debug.parse_errors.length > 0 && (
                      <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-300">{debug.parse_errors.length} error</Badge>
                    )}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${debugOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="mt-2 border-border/50 bg-muted/20">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      {[
                        { label: 'Halaman terbaca', value: debug?.total_pages ?? 0, color: 'text-blue-600 dark:text-blue-400' },
                        { label: 'Karakter diekstrak', value: (debug?.total_chars ?? 0).toLocaleString(), color: 'text-indigo-600 dark:text-indigo-400' },
                        { label: 'Soal terdeteksi', value: debug?.questions_detected ?? 0, color: 'text-foreground' },
                        { label: 'Soal valid', value: debug?.valid_count ?? 0, color: 'text-emerald-600 dark:text-emerald-400' },
                      ].map(item => (
                        <div key={item.label} className="bg-background rounded-lg p-3 border border-border/40">
                          <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                      {[
                        { label: 'Soal bermasalah', value: debug?.invalid_count ?? 0, color: 'text-rose-600 dark:text-rose-400' },
                        { label: 'Metode ekstraksi', value: debug?.extraction_method === 'ocr' ? 'OCR (Tesseract)' : 'PDF.js', color: 'text-amber-600 dark:text-amber-400' },
                        { label: 'PDF scan?', value: debug?.is_scanned_pdf ? 'Ya (tanpa text layer)' : 'Tidak', color: debug?.is_scanned_pdf ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400' },
                      ].map(item => (
                        <div key={item.label} className="bg-background rounded-lg p-3 border border-border/40">
                          <p className={`text-sm font-semibold ${item.color}`}>{item.value}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Text preview */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-medium text-muted-foreground">500 karakter pertama hasil ekstraksi:</p>
                        <Button
                          data-testid="button-copy-preview"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] gap-1"
                          onClick={() => { navigator.clipboard.writeText(debug?.text_preview || ''); toast({ title: 'Disalin' }); }}
                        >
                          <Copy className="h-3 w-3" /> Salin
                        </Button>
                      </div>
                      <pre className="text-[11px] font-mono bg-background border border-border/50 rounded-lg p-3 overflow-auto max-h-36 whitespace-pre-wrap text-foreground/70">
                        {debug?.text_preview || '(kosong — tidak ada teks terdeteksi)'}
                      </pre>
                    </div>

                    {/* Parse errors */}
                    {debug && debug.parse_errors.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-rose-600 dark:text-rose-400 mb-1.5">Alasan error parsing ({debug.parse_errors.length}):</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {debug.parse_errors.map((e, i) => (
                            <p key={i} className="text-[11px] bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 px-2 py-1 rounded border border-rose-200/50 dark:border-rose-800/30 font-mono">{e}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>

            {/* ── Summary Bar ───────────────────────────────── */}
            {!hasZeroQuestions && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: 'Total Soal', value: questions.length, color: 'text-foreground', icon: BookOpen },
                    { label: 'Valid', value: validCount, color: 'text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
                    { label: 'Bermasalah', value: invalidCount, color: 'text-rose-600 dark:text-rose-400', icon: AlertCircle },
                    { label: 'Duplikat', value: dupCount, color: 'text-amber-600 dark:text-amber-400', icon: RefreshCw },
                  ].map(stat => (
                    <Card key={stat.label} className="border-border/50">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                          <stat.icon className={`h-4 w-4 ${stat.color}`} />
                          <span className={`text-xl font-bold ${stat.color}`}>{stat.value}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      data-testid="input-search-questions"
                      placeholder="Cari soal..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(['all', 'valid', 'invalid', 'duplicate', ...(aiCount > 0 ? ['ai'] : [])] as const).map(f => (
                      <Button
                        key={f}
                        data-testid={`button-filter-${f}`}
                        variant={filterMode === f ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterMode(f as typeof filterMode)}
                        className="text-xs"
                      >
                        {f === 'all' ? `Semua (${questions.length})` : f === 'valid' ? `Valid (${validCount})` : f === 'invalid' ? `Bermasalah (${invalidCount})` : f === 'duplicate' ? `Duplikat (${dupCount})` : `AI (${aiCount})`}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Select controls */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-2">
                    <Button data-testid="button-select-all" variant="ghost" size="sm" onClick={selectAll} className="text-xs">Pilih Semua</Button>
                    <Button data-testid="button-deselect-all" variant="ghost" size="sm" onClick={deselectAll} className="text-xs">Batal Pilih</Button>
                  </div>
                  <div className="flex gap-2">
                    <Button data-testid="button-export-csv" variant="outline" size="sm" onClick={exportCSV} className="text-xs gap-1.5">
                      <Download className="h-3.5 w-3.5" /> Export CSV
                    </Button>
                    <span className="text-sm text-muted-foreground self-center">{selectedIds.size} dipilih</span>
                  </div>
                </div>

                {/* Question List */}
                <div className="space-y-3 mb-6">
                  {filteredQuestions.length === 0 ? (
                    <Card className="border-dashed border-2 border-border/60">
                      <CardContent className="py-12 text-center">
                        <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">Tidak ada soal untuk filter ini</p>
                      </CardContent>
                    </Card>
                  ) : (
                    filteredQuestions.map(q => (
                      <motion.div key={q.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-testid={`card-question-${q.id}`}>
                        <Card className={`border transition-all ${selectedIds.has(q.id) ? 'border-primary/50 bg-primary/5' : 'border-border/50'} ${q.is_duplicate ? 'opacity-60' : ''}`}>
                          <CardContent className="pt-4">
                            <div className="flex gap-3">
                              <input
                                data-testid={`checkbox-question-${q.id}`}
                                type="checkbox"
                                checked={selectedIds.has(q.id)}
                                onChange={() => toggleSelect(q.id)}
                                className="mt-1 h-4 w-4 rounded border-border accent-primary shrink-0 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <span className="text-xs font-mono text-muted-foreground">#{q.number}</span>
                                  {q.is_ai_generated && <Badge variant="outline" className="text-[10px] text-violet-600 border-violet-300">AI</Badge>}
                                  {q.is_duplicate && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Duplikat</Badge>}
                                  {!q.is_valid && <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-300">Bermasalah</Badge>}
                                  <Badge className={`text-[10px] ${DIFFICULTY_COLORS[q.difficulty_level]}`}>{q.difficulty_level}</Badge>
                                  {q.source_page > 0 && <span className="text-[10px] text-muted-foreground">Hal. {q.source_page}</span>}
                                </div>
                                <p className="text-sm font-medium mb-2 line-clamp-2">{q.question_text}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-2">
                                  {Object.entries(q.options).map(([letter, text]) => text ? (
                                    <div key={letter} className={`text-xs px-2 py-1 rounded-lg flex gap-1.5 ${q.correct_answer === letter ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium' : 'bg-muted text-muted-foreground'}`}>
                                      <span className="font-bold shrink-0">{letter}.</span>
                                      <span className="line-clamp-1">{text}</span>
                                    </div>
                                  ) : null)}
                                </div>
                                {q.validation_errors.length > 0 && (
                                  <div className="flex gap-1 flex-wrap mt-1">
                                    {q.validation_errors.map(e => (
                                      <span key={e} className="text-[10px] bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded">{e}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button data-testid={`button-edit-question-${q.id}`} variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(q)}>
                                  <Edit3 className="h-3.5 w-3.5" />
                                </Button>
                                <Button data-testid={`button-delete-question-${q.id}`} variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteQuestion(q.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))
                  )}
                </div>
              </>
            )}

            <div className="flex justify-between">
              <Button data-testid="button-back-upload" variant="outline" onClick={reset} className="gap-2">
                <ChevronLeft className="h-4 w-4" /> Upload Ulang
              </Button>
              <Button
                data-testid="button-next-configure"
                onClick={() => setStep('configure')}
                disabled={selectedIds.size === 0}
                className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white gap-2"
              >
                Konfigurasi & Import <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── CONFIGURE STEP ───────────────────────────────────── */}
        {step === 'configure' && (
          <motion.div key="configure" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4" /> Mapping Kategori</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs mb-1.5 block">Kategori default untuk semua soal</Label>
                      <Select value={globalCategory} onValueChange={setGlobalCategory}>
                        <SelectTrigger data-testid="select-trigger-global-category">
                          <SelectValue placeholder="Pilih kategori..." />
                        </SelectTrigger>
                        <SelectContent>
                          {existingCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          <Separator className="my-1" />
                          {Object.keys(CATEGORY_MAPPINGS).map(name => <SelectItem key={name} value={name}>{name} (Baru)</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground mb-1">Auto-mapping aktif</p>
                      <p>Soal yang mengandung kata kunci seperti "jurnal", "hpp", "rasio", dll. akan dipetakan otomatis ke kategori yang sesuai.</p>
                    </div>
                    {parseResult?.chapter_headings && parseResult.chapter_headings.length > 0 && (
                      <div>
                        <Label className="text-xs mb-1.5 block">Judul bab terdeteksi</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {parseResult.chapter_headings.slice(0, 8).map(h => (
                            <Badge key={h} variant="outline" className="text-xs cursor-pointer" onClick={() => setGlobalCategory(h)}>
                              {h.substring(0, 25)}{h.length > 25 ? '...' : ''}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Ringkasan Import</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[
                      { label: 'Soal dipilih', value: selectedIds.size },
                      { label: 'File', value: file?.name ?? '-' },
                      { label: 'Halaman PDF', value: parseResult?.total_pages ?? 0 },
                      { label: 'Karakter', value: (debug?.total_chars ?? 0).toLocaleString() },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-medium truncate max-w-[150px] text-right">{row.value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Mode deteksi</span>
                      <Badge variant="outline" className="text-xs">{parseResult?.detected_mode === 'bank_soal' ? 'Bank Soal' : 'Materi → AI Quiz'}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Metode</span>
                      <Badge variant="outline" className="text-xs">{debug?.extraction_method === 'ocr' ? 'OCR' : 'PDF.js'}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2">
                <Card className="border-border/50 h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Preview Soal Akan Diimport ({selectedIds.size})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2 pr-3">
                        {questions.filter(q => selectedIds.has(q.id)).slice(0, 50).map((q, i) => (
                          <div key={q.id} className="flex gap-3 py-2 border-b border-border/40 last:border-0">
                            <span className="text-xs text-muted-foreground w-6 shrink-0 pt-0.5">{i + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm line-clamp-2">{q.question_text}</p>
                              <div className="flex gap-2 mt-1 flex-wrap">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${DIFFICULTY_COLORS[q.difficulty_level]}`}>{q.difficulty_level}</span>
                                <span className="text-[10px] text-muted-foreground">Jawaban: {q.correct_answer}</span>
                                {q.is_ai_generated && <span className="text-[10px] text-violet-600">AI</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                        {selectedIds.size > 50 && <p className="text-center text-xs text-muted-foreground py-3">...dan {selectedIds.size - 50} soal lainnya</p>}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <Button data-testid="button-back-preview" variant="outline" onClick={() => setStep('preview')} className="gap-2">
                <ChevronLeft className="h-4 w-4" /> Kembali
              </Button>
              <Button data-testid="button-start-import" onClick={handleImport} className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white gap-2">
                <Save className="h-4 w-4" /> Import {selectedIds.size} Soal
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── IMPORTING STEP ───────────────────────────────────── */}
        {step === 'importing' && (
          <motion.div key="importing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-24 gap-6">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <RefreshCw className="h-8 w-8 text-white animate-spin" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-1">Menyimpan ke database...</h3>
              <p className="text-sm text-muted-foreground">Harap tunggu, sedang mengimport {selectedIds.size} soal</p>
            </div>
          </motion.div>
        )}

        {/* ── DONE STEP ────────────────────────────────────────── */}
        {step === 'done' && importResult && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-16 gap-6 text-center">
            <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Import Berhasil!</h2>
              <p className="text-muted-foreground">Soal sudah tersedia dan siap dimainkan</p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{importResult.imported}</p>
                <p className="text-sm text-muted-foreground">Berhasil diimport</p>
              </div>
              {importResult.skipped > 0 && (
                <div className="text-center">
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{importResult.skipped}</p>
                  <p className="text-sm text-muted-foreground">Dilewati / Gagal</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              <Button data-testid="button-go-quiz" onClick={() => window.location.href = '/quiz'} className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white gap-2">
                <BookOpen className="h-4 w-4" /> Mulai Quiz Sekarang
              </Button>
              <Button data-testid="button-import-another" variant="outline" onClick={reset} className="gap-2">
                <Upload className="h-4 w-4" /> Import PDF Lain
              </Button>
              <Button data-testid="button-export-result-csv" variant="outline" onClick={exportCSV} className="gap-2">
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Edit Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!editingQ} onOpenChange={open => !open && setEditingQ(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Soal #{editingQ?.number}</DialogTitle>
          </DialogHeader>
          {editingQ && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs mb-1.5 block">Teks Soal *</Label>
                <Textarea
                  data-testid="textarea-edit-question"
                  value={editForm.question_text || ''}
                  onChange={e => setEditForm(f => ({ ...f, question_text: e.target.value }))}
                  rows={3}
                />
              </div>
              {(['A', 'B', 'C', 'D'] as const).map(letter => (
                <div key={letter}>
                  <Label className="text-xs mb-1.5 flex items-center gap-1.5">
                    Opsi {letter}
                    {(editForm.correct_answer || '') === letter && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Jawaban Benar</Badge>}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      data-testid={`input-edit-option-${letter}`}
                      value={(editForm.options as any)?.[letter] || ''}
                      onChange={e => setEditForm(f => ({ ...f, options: { ...(f.options as any), [letter]: e.target.value } }))}
                    />
                    <Button
                      data-testid={`button-set-correct-${letter}`}
                      variant={editForm.correct_answer === letter ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEditForm(f => ({ ...f, correct_answer: letter }))}
                      className="shrink-0 text-xs"
                    >✓</Button>
                  </div>
                </div>
              ))}
              <div>
                <Label className="text-xs mb-1.5 block">Pembahasan / Penjelasan</Label>
                <Textarea
                  data-testid="textarea-edit-explanation"
                  value={editForm.explanation || ''}
                  onChange={e => setEditForm(f => ({ ...f, explanation: e.target.value }))}
                  rows={2}
                  placeholder="Penjelasan mengapa jawaban ini benar..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1.5 block">Tingkat Kesulitan</Label>
                  <Select value={editForm.difficulty_level || 'medium'} onValueChange={v => setEditForm(f => ({ ...f, difficulty_level: v }))}>
                    <SelectTrigger data-testid="select-edit-difficulty"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">S1 / Mudah</SelectItem>
                      <SelectItem value="medium">S2 / Sedang</SelectItem>
                      <SelectItem value="hard">S3 / Sulit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Tipe Soal</Label>
                  <Select value={editForm.question_type || 'multiple_choice'} onValueChange={v => setEditForm(f => ({ ...f, question_type: v as any }))}>
                    <SelectTrigger data-testid="select-edit-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple_choice">Pilihan Ganda</SelectItem>
                      <SelectItem value="true_false">Benar / Salah</SelectItem>
                      <SelectItem value="essay">Esai / Isian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button data-testid="button-cancel-edit" variant="outline" onClick={() => setEditingQ(null)}>Batal</Button>
            <Button data-testid="button-save-edit" onClick={saveEdit}>Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
