import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeftRight, Copy, Trash2, Star, StarOff, History, Loader2, Languages, Volume2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const LANGUAGES = [
  { code: 'auto', label: '🔍 Auto Detect' },
  { code: 'id', label: '🇮🇩 Indonesia' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'ar', label: '🇸🇦 العربية' },
  { code: 'es', label: '🇪🇸 Español' },
  { code: 'fr', label: '🇫🇷 Français' },
  { code: 'ja', label: '🇯🇵 日本語' },
  { code: 'ko', label: '🇰🇷 한국어' },
  { code: 'zh', label: '🇨🇳 中文 (简体)' },
  { code: 'zh-TW', label: '🇹🇼 中文 (繁體)' },
  { code: 'de', label: '🇩🇪 Deutsch' },
  { code: 'pt', label: '🇵🇹 Português' },
  { code: 'ru', label: '🇷🇺 Русский' },
  { code: 'it', label: '🇮🇹 Italiano' },
  { code: 'nl', label: '🇳🇱 Nederlands' },
  { code: 'tr', label: '🇹🇷 Türkçe' },
  { code: 'hi', label: '🇮🇳 हिन्दी' },
  { code: 'th', label: '🇹🇭 ไทย' },
  { code: 'vi', label: '🇻🇳 Tiếng Việt' },
  { code: 'ms', label: '🇲🇾 Bahasa Melayu' },
  { code: 'fil', label: '🇵🇭 Filipino' },
  { code: 'pl', label: '🇵🇱 Polski' },
  { code: 'sv', label: '🇸🇪 Svenska' },
  { code: 'no', label: '🇳🇴 Norsk' },
  { code: 'da', label: '🇩🇰 Dansk' },
  { code: 'fi', label: '🇫🇮 Suomi' },
  { code: 'el', label: '🇬🇷 Ελληνικά' },
  { code: 'cs', label: '🇨🇿 Čeština' },
  { code: 'ro', label: '🇷🇴 Română' },
  { code: 'hu', label: '🇭🇺 Magyar' },
  { code: 'uk', label: '🇺🇦 Українська' },
  { code: 'bn', label: '🇧🇩 বাংলা' },
  { code: 'ta', label: '🇮🇳 தமிழ்' },
  { code: 'te', label: '🇮🇳 తెలుగు' },
  { code: 'ur', label: '🇵🇰 اردو' },
  { code: 'fa', label: '🇮🇷 فارسی' },
  { code: 'he', label: '🇮🇱 עברית' },
  { code: 'sw', label: '🇰🇪 Kiswahili' },
  { code: 'am', label: '🇪🇹 አማርኛ' },
  { code: 'my', label: '🇲🇲 မြန်မာ' },
  { code: 'km', label: '🇰🇭 ខ្មែរ' },
  { code: 'lo', label: '🇱🇦 ລາວ' },
  { code: 'mn', label: '🇲🇳 Монгол' },
  { code: 'ne', label: '🇳🇵 नेपाली' },
  { code: 'si', label: '🇱🇰 සිංහල' },
  { code: 'ka', label: '🇬🇪 ქართული' },
  { code: 'hy', label: '🇦🇲 Հայերեն' },
  { code: 'az', label: '🇦🇿 Azərbaycan' },
  { code: 'uz', label: '🇺🇿 Oʻzbek' },
  { code: 'kk', label: '🇰🇿 Қазақ' },
];

const TARGET_LANGUAGES = LANGUAGES.filter(l => l.code !== 'auto');

interface TranslationRecord {
  id: string;
  source: string;
  result: string;
  sourceLang: string;
  targetLang: string;
  mode: string;
  timestamp: number;
  isFavorite: boolean;
}

export default function Translator() {
  const [sourceText, setSourceText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');
  const [mode, setMode] = useState<'formal' | 'neutral' | 'informal'>('neutral');
  const [isTranslating, setIsTranslating] = useState(false);
  const [result, setResult] = useState<{
    translation: string;
    detected_language?: string;
    alternatives?: string[];
    transliteration?: string;
    pronunciation?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<TranslationRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem('translate_history') || '[]'); } catch { return []; }
  });
  const [activeTab, setActiveTab] = useState('translate');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { toast } = useToast();

  const saveHistory = useCallback((records: TranslationRecord[]) => {
    const trimmed = records.slice(0, 100);
    setHistory(trimmed);
    localStorage.setItem('translate_history', JSON.stringify(trimmed));
  }, []);

  const translate = useCallback(async () => {
    if (!sourceText.trim() || !targetLang) return;
    setIsTranslating(true);
    setResult(null);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: [sourceText.trim()],
          targetLang,
          sourceLang,
          mode,
          fullTranslation: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Translation failed');
      if (data?.error) throw new Error(data.error);
      setResult(data);

      const record: TranslationRecord = {
        id: crypto.randomUUID(),
        source: sourceText.trim().slice(0, 200),
        result: data.translation?.slice(0, 200) || '',
        sourceLang: data.detected_language || sourceLang,
        targetLang,
        mode,
        timestamp: Date.now(),
        isFavorite: false,
      };
      saveHistory([record, ...history]);
    } catch (e: any) {
      toast({ title: 'Terjemahan gagal', description: e.message || 'Coba lagi nanti', variant: 'destructive' });
    } finally {
      setIsTranslating(false);
    }
  }, [sourceText, targetLang, sourceLang, mode, history, saveHistory, toast]);

  const handleSourceChange = (text: string) => {
    setSourceText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length > 2) {
      debounceRef.current = setTimeout(() => translate(), 1500);
    }
  };

  const swapLanguages = () => {
    if (sourceLang === 'auto') return;
    const tmpLang = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(tmpLang);
    if (result?.translation) {
      setSourceText(result.translation);
      setResult(null);
    }
  };

  const copyResult = () => {
    if (result?.translation) {
      navigator.clipboard.writeText(result.translation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleFavorite = (id: string) => {
    saveHistory(history.map(h => h.id === id ? { ...h, isFavorite: !h.isFavorite } : h));
  };

  const speak = (text: string, lang: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    speechSynthesis.speak(utterance);
  };

  const detectedLabel = result?.detected_language
    ? LANGUAGES.find(l => l.code === result.detected_language)?.label || result.detected_language
    : null;

  const favorites = history.filter(h => h.isFavorite);

  return (
    <div className="container py-8 max-w-5xl animate-in fade-in duration-500">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight font-[Space_Grotesk] mb-2">
          <Languages className="inline h-8 w-8 mr-2 text-primary" />
          <span className="text-gradient">Translator</span>
        </h1>
        <p className="text-muted-foreground">Terjemahkan ke 50+ bahasa dengan AI — akurat, natural, kontekstual</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="translate">Terjemahan</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" />Riwayat</TabsTrigger>
          <TabsTrigger value="favorites"><Star className="h-4 w-4 mr-1" />Favorit</TabsTrigger>
        </TabsList>

        <TabsContent value="translate">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Select value={sourceLang} onValueChange={setSourceLang}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" onClick={swapLanguages} disabled={sourceLang === 'auto'} className="shrink-0">
              <ArrowLeftRight className="h-4 w-4" />
            </Button>

            <Select value={targetLang} onValueChange={setTargetLang}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {TARGET_LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="flex gap-1 ml-auto">
              {(['formal', 'neutral', 'informal'] as const).map(m => (
                <Button key={m} size="sm" variant={mode === m ? 'default' : 'outline'} onClick={() => setMode(m)} className="capitalize text-xs">
                  {m}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <Textarea
                  value={sourceText}
                  onChange={e => handleSourceChange(e.target.value)}
                  placeholder="Ketik teks untuk diterjemahkan..."
                  className="min-h-[200px] border-0 focus-visible:ring-0 resize-none text-base"
                />
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {sourceText && (
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => speak(sourceText, sourceLang === 'auto' ? 'id' : sourceLang)}>
                        <Volume2 className="h-3 w-3" />
                      </Button>
                    )}
                    {detectedLabel && <Badge variant="secondary" className="text-xs">Terdeteksi: {detectedLabel}</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{sourceText.length} karakter</span>
                    {sourceText && (
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setSourceText(''); setResult(null); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="min-h-[200px] text-base whitespace-pre-wrap">
                  {isTranslating ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Menerjemahkan...
                    </div>
                  ) : result?.translation || (
                    <span className="text-muted-foreground">Terjemahan akan muncul di sini...</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2">
                  {result?.translation && (
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => speak(result.translation, targetLang)}>
                      <Volume2 className="h-3 w-3" />
                    </Button>
                  )}
                  <div className="flex items-center gap-1 ml-auto">
                    {result?.translation && (
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={copyResult}>
                        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center mt-4">
            <Button onClick={translate} disabled={isTranslating || !sourceText.trim()} className="bg-gradient-primary text-white px-8">
              {isTranslating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Languages className="h-4 w-4 mr-2" />}
              Terjemahkan
            </Button>
          </div>

          {result && (result.alternatives?.length || result.transliteration || result.pronunciation) && (
            <div className="grid sm:grid-cols-3 gap-4 mt-6">
              {result.alternatives && result.alternatives.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Alternatif</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {result.alternatives.map((alt, i) => (
                      <p key={i} className="text-sm text-muted-foreground">{alt}</p>
                    ))}
                  </CardContent>
                </Card>
              )}
              {result.transliteration && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Transliterasi</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{result.transliteration}</p></CardContent>
                </Card>
              )}
              {result.pronunciation && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Pelafalan</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{result.pronunciation}</p></CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Belum ada riwayat terjemahan</p>
          ) : (
            <div className="space-y-3">
              {history.map(h => (
                <Card key={h.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{h.source}</p>
                      <p className="text-sm text-muted-foreground truncate">{h.result}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {h.sourceLang} → {h.targetLang} · {h.mode} · {new Date(h.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => toggleFavorite(h.id)}>
                      {h.isFavorite ? <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" /> : <StarOff className="h-4 w-4" />}
                    </Button>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" className="w-full" onClick={() => saveHistory([])}>Hapus Semua Riwayat</Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="favorites">
          {favorites.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Belum ada terjemahan favorit</p>
          ) : (
            <div className="space-y-3">
              {favorites.map(h => (
                <Card key={h.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{h.source}</p>
                      <p className="text-sm text-muted-foreground truncate">{h.result}</p>
                      <p className="text-xs text-muted-foreground mt-1">{h.sourceLang} → {h.targetLang}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => toggleFavorite(h.id)}>
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
