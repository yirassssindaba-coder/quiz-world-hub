import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Newspaper, MapPin, Calendar, ExternalLink, AlertTriangle,
  RefreshCw, Globe, Clock, ArrowUpDown, Sparkles, Bookmark,
} from 'lucide-react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { SkeletonCard } from '@/components/SkeletonCard';
import TagFilter, { ArticleTags } from '@/components/news/TagFilter';
import UrgentBanner from '@/components/news/UrgentBanner';
import JobCard, { type JobValidation } from '@/components/news/JobCard';
import BookmarkButton from '@/components/news/BookmarkButton';
import { POPULAR_KEYWORDS } from '@/lib/keywords';

const categoryLabels: Record<string, string> = {
  semua: 'Semua',
  pendidikan: 'Pendidikan',
  beasiswa: 'Beasiswa',
  rpl: 'RPL',
  lowongan_kerja: 'Lowongan Kerja',
  teknologi: 'Teknologi',
  cybercrime: 'Cybercrime',
  penipuan: 'Penipuan',
  keamanan_digital: 'Keamanan Digital',
  isu_global: 'Isu Global',
};

const categoryColors: Record<string, string> = {
  penipuan: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cybercrime: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  teknologi: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  pendidikan: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  beasiswa: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  rpl: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  lowongan_kerja: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  keamanan_digital: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  isu_global: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
};

export interface NewsArticle {
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
  is_related?: boolean;
  related_reason?: string;
  is_alternative?: boolean;
  platform?: string;
  verification_level?: 'Resmi' | 'Terverifikasi' | 'Komunitas' | 'Belum Terverifikasi';
  relevance_reason?: string;
  validation_notes?: string[];
  disclaimer?: string;
}

const verificationColors: Record<string, string> = {
  Resmi: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Terverifikasi: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Komunitas: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'Belum Terverifikasi': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

function NewsCard({ article, onClick, index }: { article: NewsArticle; onClick: () => void; index: number }) {
  const bookmarkItem = {
    type: 'article' as const,
    title: article.title,
    summary: article.summary,
    source: article.source,
    source_url: article.source_url,
    published_date: article.published_date,
    category: article.category,
    tags: article.tags,
    is_urgent: article.is_urgent,
    is_job: false,
    image_url: article.image_url,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] }}
    >
      <Card
        data-testid={`card-article-${index}`}
        className={`group card-hover depth-card border-border/50 flex flex-col h-full ${article.is_urgent ? 'ring-2 ring-amber-300/50 dark:ring-amber-700/50' : ''}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge className={categoryColors[article.category] || 'bg-muted text-muted-foreground'}>
              {categoryLabels[article.category] || article.category}
            </Badge>
            {article.is_urgent && (
              <Badge className="bg-amber-500 text-white gap-1 animate-pulse">
                <Sparkles className="h-2.5 w-2.5" /> Penting
              </Badge>
            )}
            {article.is_related && (
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                {article.related_reason || 'Hasil Terkait'}
              </Badge>
            )}
            {article.is_alternative && (
              <Badge variant="outline" className="border-violet-400/50 bg-violet-500/10 text-violet-700 dark:text-violet-300">
                Sumber Alternatif
              </Badge>
            )}
            {article.verification_level && (
              <Badge className={verificationColors[article.verification_level] || 'bg-muted text-muted-foreground'}>
                {article.verification_level}
              </Badge>
            )}
            {article.source && (
              <span className="text-xs text-muted-foreground font-medium">{article.source}</span>
            )}
          </div>
          <CardTitle
            data-testid={`text-article-title-${index}`}
            className="text-base leading-snug break-words line-clamp-2 group-hover:text-primary transition-colors cursor-pointer"
            onClick={onClick}
          >
            {article.title}
          </CardTitle>
          <ArticleTags tags={article.tags} />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed break-words line-clamp-3 flex-1">{article.summary}</p>
          {article.is_alternative && (
            <div className="mb-4 space-y-2 rounded-xl border border-violet-200/60 bg-violet-50/60 p-3 text-xs dark:border-violet-800/40 dark:bg-violet-950/20">
              <div className="flex flex-wrap gap-2 text-muted-foreground">
                {article.platform && <span data-testid={`text-alt-platform-${index}`} className="font-medium text-violet-700 dark:text-violet-300">{article.platform}</span>}
                {article.relevance_reason && <span data-testid={`text-alt-reason-${index}`}>{article.relevance_reason}</span>}
              </div>
              {article.validation_notes && article.validation_notes.length > 0 && (
                <p data-testid={`text-alt-validation-${index}`} className="text-muted-foreground">
                  Validasi: {article.validation_notes.slice(0, 2).join(' • ')}
                </p>
              )}
              {article.disclaimer && (
                <p data-testid={`text-alt-disclaimer-${index}`} className="flex gap-1 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  {article.disclaimer}
                </p>
              )}
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex items-center gap-1 shrink-0">
                <Calendar className="h-3 w-3" />
                {article.published_date
                  ? new Date(article.published_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '-'}
              </span>
              {article.location && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3 shrink-0" />{article.location}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 ml-2 shrink-0">
              <BookmarkButton item={bookmarkItem} size="icon" />
              {article.source_url && (
                <a
                  data-testid={`link-read-article-${index}`}
                  href={article.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                  onClick={e => e.stopPropagation()}
                >
                  Baca <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function News() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [jobValidations, setJobValidations] = useState<Record<string, JobValidation>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('semua');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<'relevance' | 'recent'>('relevance');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [resultMeta, setResultMeta] = useState({ primary: 0, related: 0, alternative: 0 });
  const urgentSectionRef = useRef<HTMLElement | null>(null);
  const { toast } = useToast();

  const fetchNews = useCallback(async (query?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/news-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query || undefined,
          category: categoryFilter !== 'semua' ? categoryFilter : undefined,
          tag: tagFilter || undefined,
          sort,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat berita');
      const fetched: NewsArticle[] = data?.articles || [];
      setArticles(fetched);
      setResultMeta({
        primary: data?.primary_count || fetched.filter(a => !a.is_related && !a.is_alternative).length,
        related: data?.related_count || fetched.filter(a => a.is_related).length,
        alternative: data?.alternative_count || fetched.filter(a => a.is_alternative).length,
      });
      setLastUpdated(new Date());

      const jobs = fetched.filter(a => a.is_job).slice(0, 30);
      if (jobs.length > 0) {
        fetch('/api/job-validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobs: jobs.map(j => ({
              title: j.title, summary: j.summary,
              source_url: j.source_url, source: j.source,
            })),
          }),
        })
          .then(r => r.json())
          .then(vData => {
            if (vData?.results) {
              const map: Record<string, JobValidation> = {};
              for (const r of vData.results) {
                const { source_url, ...rest } = r;
                map[source_url] = rest;
              }
              setJobValidations(prev => ({ ...prev, ...map }));
            }
          })
          .catch(e => console.warn('job-validate failed:', e));
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Gagal memuat berita';
      console.error('News fetch error:', e);
      setError(message);
      toast({ title: 'Gagal memuat berita', description: 'Silakan coba lagi nanti.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, tagFilter, sort, toast]);

  useEffect(() => {
    fetchNews(search || undefined);
  }, [categoryFilter, tagFilter, sort]);

  const handleRefresh = () => {
    if (cooldown) return;
    setCooldown(true);
    fetchNews(search || undefined);
    setTimeout(() => setCooldown(false), 10000);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchNews(search);
  };

  const handleQuickKeyword = (kw: string) => {
    setSearch(kw);
    fetchNews(kw);
  };

  const handleViewUrgent = () => {
    setBannerDismissed(true);
    urgentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const urgentCount = useMemo(() => articles.filter(a => a.is_urgent).length, [articles]);
  const urgentArticles = useMemo(() => articles.filter(a => a.is_urgent && !a.is_job && !a.is_related && !a.is_alternative), [articles]);
  const jobs = useMemo(() => articles.filter(a => a.is_job && !a.is_related && !a.is_alternative), [articles]);
  const news = useMemo(() => articles.filter(a => !a.is_job && !a.is_urgent && !a.is_related && !a.is_alternative), [articles]);
  const relatedResults = useMemo(() => articles.filter(a => a.is_related && !a.is_alternative), [articles]);
  const alternativeResults = useMemo(() => articles.filter(a => a.is_alternative), [articles]);

  return (
    <div className="container py-8 sm:py-12">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold font-[Space_Grotesk]">Berita & Lowongan</h1>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base">
            Info kampus, RPL, beasiswa, deadline penting, dan lowongan kerja terverifikasi dari sumber tepercaya.
          </p>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Terakhir diperbarui: {lastUpdated.toLocaleTimeString('id-ID')}
              {resultMeta.related > 0 && <span data-testid="status-related-results">• {resultMeta.related} Hasil Terkait</span>}
              {resultMeta.alternative > 0 && <span data-testid="status-alternative-results">• {resultMeta.alternative} Sumber Alternatif</span>}
            </p>
          )}
        </div>
        <Link to="/news/saved">
          <Button
            data-testid="link-saved-news"
            variant="outline"
            className="gap-2 shrink-0"
          >
            <Bookmark className="h-4 w-4" />
            Tersimpan
          </Button>
        </Link>
      </div>

      {!bannerDismissed && urgentCount > 0 && (
        <UrgentBanner
          count={urgentCount}
          onDismiss={() => setBannerDismissed(true)}
          onView={handleViewUrgent}
        />
      )}

      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search-news"
            placeholder="Cari: beasiswa LPDP, RPL, lowongan IT, fresh graduate..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button data-testid="button-search-submit" type="submit" className="bg-gradient-primary text-white">
          <Search className="mr-2 h-4 w-4" />Cari
        </Button>
        <Button
          data-testid="button-sort-toggle"
          type="button"
          variant="outline"
          onClick={() => setSort(s => s === 'relevance' ? 'recent' : 'relevance')}
        >
          <ArrowUpDown className="mr-2 h-4 w-4" />
          {sort === 'relevance' ? 'Relevansi' : 'Terbaru'}
        </Button>
        <Button
          data-testid="button-refresh"
          type="button"
          variant="outline"
          onClick={handleRefresh}
          disabled={loading || cooldown}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {cooldown ? 'Tunggu...' : 'Refresh'}
        </Button>
      </form>

      <div className="flex gap-2 flex-wrap mb-4 items-center">
        <span className="text-xs text-muted-foreground font-medium">Populer:</span>
        {POPULAR_KEYWORDS.map(kw => (
          <button
            key={kw}
            data-testid={`button-keyword-${kw.replace(/\s+/g, '-').toLowerCase()}`}
            onClick={() => handleQuickKeyword(kw)}
            className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
          >
            {kw}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <TagFilter selected={tagFilter} onSelect={setTagFilter} />
      </div>

      <Tabs value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setTagFilter(null); }} className="mb-6">
        <TabsList className="flex-wrap h-auto justify-start bg-muted/40">
          {Object.entries(categoryLabels).map(([key, label]) => (
            <TabsTrigger
              data-testid={`tab-category-${key}`}
              key={key}
              value={key}
              className="text-xs sm:text-sm"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <Card className="border-dashed border-2 border-destructive/30">
          <CardContent className="py-16 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4 animate-pulse" />
            <h3 className="text-lg font-semibold mb-2">Gagal Memuat Berita</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => fetchNews()} variant="outline" className="hover-scale">Coba Lagi</Button>
          </CardContent>
        </Card>
      ) : articles.length === 0 ? (
        <Card className="border-dashed border-2 border-border/60">
          <CardContent className="py-16 text-center">
            <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Tidak ada hasil</h3>
            <p className="text-sm text-muted-foreground mb-4">Coba kata kunci atau kategori lain di atas.</p>
            <div className="flex gap-2 flex-wrap justify-center">
              {POPULAR_KEYWORDS.slice(0, 5).map(kw => (
                <Button key={kw} size="sm" variant="outline" onClick={() => handleQuickKeyword(kw)}>
                  {kw}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {urgentArticles.length > 0 && !bannerDismissed && (
            <section ref={el => { urgentSectionRef.current = el; }}>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Informasi Penting & Deadline
                <span className="text-xs text-muted-foreground font-normal">({urgentArticles.length})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {urgentArticles.map((article, idx) => (
                  <ErrorBoundary key={`u-${idx}`} fallbackMessage="Gagal menampilkan artikel ini.">
                    <NewsCard article={article} onClick={() => setSelectedArticle(article)} index={idx} />
                  </ErrorBoundary>
                ))}
              </div>
            </section>
          )}

          {jobs.length > 0 && (categoryFilter === 'semua' || categoryFilter === 'lowongan_kerja') && (
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                💼 Lowongan Kerja
                <span className="text-xs text-muted-foreground font-normal">({jobs.length} dengan validasi keamanan)</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {jobs.map((job, idx) => (
                  <ErrorBoundary key={`job-${idx}`} fallbackMessage="Gagal menampilkan lowongan ini.">
                    <JobCard
                      title={job.title}
                      summary={job.summary}
                      source={job.source}
                      source_url={job.source_url}
                      published_date={job.published_date}
                      tags={job.tags}
                      validation={jobValidations[job.source_url]}
                      index={idx}
                    />
                  </ErrorBoundary>
                ))}
              </div>
            </section>
          )}

          {news.length > 0 && categoryFilter !== 'lowongan_kerja' && (
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                📰 Berita & Pengumuman
                <span className="text-xs text-muted-foreground font-normal">({news.length})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {news.map((article, idx) => (
                  <ErrorBoundary key={`n-${idx}`} fallbackMessage="Gagal menampilkan artikel ini.">
                    <NewsCard article={article} onClick={() => setSelectedArticle(article)} index={idx} />
                  </ErrorBoundary>
                ))}
              </div>
            </section>
          )}

          {relatedResults.length > 0 && (
            <section>
              <div className="mb-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Hasil Terkait
                  <span className="text-xs text-muted-foreground font-normal">({relatedResults.length})</span>
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Hasil utama terbatas, jadi sistem menampilkan berita, pengumuman, atau lowongan yang masih relevan berdasarkan kemiripan topik, intent, tag, sumber, dan konteks pencarian.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {relatedResults.map((article, idx) => (
                  <ErrorBoundary key={`r-${idx}`} fallbackMessage="Gagal menampilkan hasil terkait ini.">
                    {article.is_job ? (
                      <JobCard
                        title={article.title}
                        summary={article.summary}
                        source={article.source}
                        source_url={article.source_url}
                        published_date={article.published_date}
                        tags={article.tags}
                        validation={jobValidations[article.source_url]}
                        index={idx}
                      />
                    ) : (
                      <NewsCard article={article} onClick={() => setSelectedArticle(article)} index={idx} />
                    )}
                  </ErrorBoundary>
                ))}
              </div>
            </section>
          )}

          {alternativeResults.length > 0 && (
            <section>
              <div className="mb-3 rounded-2xl border border-violet-300/30 bg-violet-500/5 p-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Globe className="h-5 w-5 text-violet-600 dark:text-violet-300" />
                  Sumber Sosial & Alternatif
                  <span className="text-xs text-muted-foreground font-normal">({alternativeResults.length})</span>
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Hasil ini muncul saat sumber utama terbatas. Sistem memberi skor berdasarkan relevansi, kebaruan, kredibilitas, validasi URL dasar, dan sinyal anti-spam; tetap cek ulang informasi non-resmi ke sumber resmi.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {alternativeResults.map((article, idx) => (
                  <ErrorBoundary key={`alt-${idx}`} fallbackMessage="Gagal menampilkan sumber alternatif ini.">
                    <NewsCard article={article} onClick={() => setSelectedArticle(article)} index={idx} />
                  </ErrorBoundary>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <Dialog open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
        <DialogContent className="max-w-lg">
          {selectedArticle && (
            <>
              <DialogHeader>
                <div className="flex gap-2 mb-2 flex-wrap">
                  <Badge className={categoryColors[selectedArticle.category] || 'bg-muted'}>
                    {categoryLabels[selectedArticle.category] || selectedArticle.category}
                  </Badge>
                  {selectedArticle.is_urgent && (
                    <Badge className="bg-amber-500 text-white">⚡ Penting</Badge>
                  )}
                  {selectedArticle.is_alternative && (
                    <Badge variant="outline" className="border-violet-400/50 bg-violet-500/10 text-violet-700 dark:text-violet-300">
                      Sumber Sosial & Alternatif
                    </Badge>
                  )}
                  {selectedArticle.verification_level && (
                    <Badge className={verificationColors[selectedArticle.verification_level] || 'bg-muted'}>
                      {selectedArticle.verification_level}
                    </Badge>
                  )}
                </div>
                <DialogTitle className="leading-snug">{selectedArticle.title}</DialogTitle>
                <ArticleTags tags={selectedArticle.tags} />
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{selectedArticle.summary}</p>
                {selectedArticle.is_alternative && (
                  <div className="space-y-2 rounded-xl border border-violet-200/60 bg-violet-50/60 p-3 text-xs dark:border-violet-800/40 dark:bg-violet-950/20">
                    {selectedArticle.platform && <p><span className="font-medium">Platform:</span> {selectedArticle.platform}</p>}
                    {selectedArticle.relevance_reason && <p><span className="font-medium">Alasan relevansi:</span> {selectedArticle.relevance_reason}</p>}
                    {selectedArticle.validation_notes && selectedArticle.validation_notes.length > 0 && (
                      <p><span className="font-medium">Validasi:</span> {selectedArticle.validation_notes.join(' • ')}</p>
                    )}
                    {selectedArticle.disclaimer && (
                      <p className="text-amber-700 dark:text-amber-300">{selectedArticle.disclaimer}</p>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {selectedArticle.published_date
                      ? new Date(selectedArticle.published_date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                      : '-'}
                  </span>
                  <span>{selectedArticle.source}</span>
                  {selectedArticle.location && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{selectedArticle.location}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <BookmarkButton
                    item={{
                      type: 'article',
                      title: selectedArticle.title,
                      summary: selectedArticle.summary,
                      source: selectedArticle.source,
                      source_url: selectedArticle.source_url,
                      published_date: selectedArticle.published_date,
                      category: selectedArticle.category,
                      tags: selectedArticle.tags,
                      is_urgent: selectedArticle.is_urgent,
                      is_job: false,
                      image_url: selectedArticle.image_url,
                    }}
                    size="sm"
                    className="flex-1 justify-center"
                  />
                  {selectedArticle.source_url && (
                    <a href={selectedArticle.source_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button className="w-full bg-gradient-primary text-white gap-2">
                        Baca Selengkapnya <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
