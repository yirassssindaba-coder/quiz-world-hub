import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bookmark, BookmarkX, ExternalLink, Calendar, Briefcase,
  Newspaper, ArrowLeft, Trash2,
} from 'lucide-react';
import { getBookmarks, removeBookmark, type SavedItem } from '@/lib/bookmarks';
import { ArticleTags } from '@/components/news/TagFilter';
import { useToast } from '@/hooks/use-toast';

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

const categoryLabels: Record<string, string> = {
  pendidikan: 'Pendidikan', beasiswa: 'Beasiswa', rpl: 'RPL',
  lowongan_kerja: 'Lowongan Kerja', teknologi: 'Teknologi',
  cybercrime: 'Cybercrime', penipuan: 'Penipuan',
  keamanan_digital: 'Keamanan Digital', isu_global: 'Isu Global',
};

function SavedCard({ item, onRemove }: { item: SavedItem; onRemove: (id: string, url: string) => void }) {
  const isJob = item.type === 'job';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card
        data-testid={`card-saved-${item.id}`}
        className="group card-hover border-border/50 flex flex-col h-full"
      >
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {isJob ? (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
                <Briefcase className="h-2.5 w-2.5" /> Lowongan
              </Badge>
            ) : (
              <Badge className={categoryColors[item.category] || 'bg-muted text-muted-foreground'}>
                {categoryLabels[item.category] || item.category}
              </Badge>
            )}
            {item.is_urgent && (
              <Badge className="bg-amber-500 text-white text-[10px]">⚡ Penting</Badge>
            )}
            <span className="text-xs text-muted-foreground font-medium">{item.source}</span>
          </div>
          <CardTitle className="text-base leading-snug break-words line-clamp-2">
            {item.title}
          </CardTitle>
          <ArticleTags tags={item.tags} />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col pt-0">
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed line-clamp-3 flex-1">{item.summary}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2">
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {item.published_date
                  ? new Date(item.published_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '-'}
              </span>
              <span className="text-[10px] text-muted-foreground/60">
                Disimpan {new Date(item.saved_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                data-testid={`button-remove-bookmark-${item.id}`}
                size="sm"
                variant="ghost"
                onClick={() => onRemove(item.id, item.source_url)}
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive"
              >
                <BookmarkX className="h-3.5 w-3.5" />
                Hapus
              </Button>
              {item.source_url && (
                <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                    {isJob ? 'Lamar' : 'Baca'} <ExternalLink className="h-3 w-3" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function SavedNews() {
  const [bookmarks, setBookmarks] = useState<SavedItem[]>([]);
  const [tab, setTab] = useState<'semua' | 'article' | 'job'>('semua');
  const { toast } = useToast();

  useEffect(() => {
    setBookmarks(getBookmarks());
  }, []);

  function handleRemove(id: string, url: string) {
    removeBookmark(url);
    setBookmarks(prev => prev.filter(b => b.id !== id));
    toast({ title: 'Dihapus dari tersimpan', duration: 2000 });
  }

  function handleClearAll() {
    const filtered = tab === 'semua'
      ? []
      : bookmarks.filter(b => b.type !== tab);
    bookmarks
      .filter(b => tab === 'semua' || b.type === tab)
      .forEach(b => removeBookmark(b.source_url));
    setBookmarks(filtered);
    toast({ title: 'Semua item dihapus dari tersimpan', duration: 2000 });
  }

  const filtered = tab === 'semua' ? bookmarks : bookmarks.filter(b => b.type === tab);
  const articleCount = bookmarks.filter(b => b.type === 'article').length;
  const jobCount = bookmarks.filter(b => b.type === 'job').length;

  return (
    <div className="container py-8 sm:py-12">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link to="/news">
              <Button data-testid="button-back-to-news" variant="ghost" size="sm" className="gap-1 -ml-2">
                <ArrowLeft className="h-4 w-4" /> Kembali
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Bookmark className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold font-[Space_Grotesk]">Tersimpan</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Artikel dan lowongan yang kamu simpan untuk dibaca atau dilamar nanti.
          </p>
        </div>
        {filtered.length > 0 && (
          <Button
            data-testid="button-clear-all"
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            className="gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
          >
            <Trash2 className="h-4 w-4" />
            Hapus Semua
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)} className="mb-6">
        <TabsList className="bg-muted/40">
          <TabsTrigger data-testid="tab-saved-semua" value="semua">
            Semua <Badge variant="secondary" className="ml-1.5 text-[10px] h-4">{bookmarks.length}</Badge>
          </TabsTrigger>
          <TabsTrigger data-testid="tab-saved-artikel" value="article">
            <Newspaper className="h-3.5 w-3.5 mr-1" /> Artikel
            {articleCount > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] h-4">{articleCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger data-testid="tab-saved-lowongan" value="job">
            <Briefcase className="h-3.5 w-3.5 mr-1" /> Lowongan
            {jobCount > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] h-4">{jobCount}</Badge>}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-border/60">
          <CardContent className="py-16 text-center">
            <Bookmark className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Belum ada yang disimpan</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Klik tombol <strong>Simpan</strong> pada artikel atau lowongan yang ingin kamu baca nanti.
            </p>
            <Link to="/news">
              <Button className="bg-gradient-primary text-white gap-2">
                <Newspaper className="h-4 w-4" /> Jelajahi Berita & Lowongan
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <AnimatePresence mode="popLayout">
            {filtered.map(item => (
              <SavedCard key={item.id} item={item} onRemove={handleRemove} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
