import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { useMediaPlayer, type MediaItem, type LoopMode } from '@/contexts/MediaPlayerContext';
import { Music, Trash2, Plus, ExternalLink, Heart, Loader2, Link as LinkIcon, Play, Pause, Volume2, Repeat, Repeat1 } from 'lucide-react';

export default function Media() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'youtube' | 'spotify'>('all');
  const {
    library,
    queue,
    activeMedia,
    isPlaying,
    volume,
    loop,
    source,
    playMedia,
    removeMedia,
    toggleFavorite,
    setIsPlaying,
    setVolume,
    setLoop,
  } = useMediaPlayer();
  const { toast } = useToast();

  const addMedia = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/media-embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!data?.valid) {
        toast({ title: 'URL tidak valid', description: data?.error || 'Format URL tidak dikenali.', variant: 'destructive' });
        return;
      }
      const existing = library.find(m => m.embed_url === data.embed_url);
      if (existing) {
        playMedia(existing, 'library');
        setUrl('');
        toast({ title: 'Sudah ada', description: 'Media ini sudah ada di library dan diputar di player global.' });
        return;
      }
      const newItem: MediaItem = {
        id: crypto.randomUUID(),
        url: url.trim(),
        platform: data.platform,
        type: data.type,
        embed_url: data.embed_url,
        added_at: new Date().toISOString(),
        title: data.title,
        thumbnail: data.thumbnail,
      };
      playMedia(newItem, 'search');
      setUrl('');
      toast({ title: 'Media ditambahkan!', description: `${data.platform} ${data.type} diputar di player global.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Gagal memproses URL.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'all' ? library : library.filter(m => m.platform === filter);

  return (
    <div className="container py-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Music className="h-6 w-6 text-primary" />
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-[Space_Grotesk]">Media Player</h1>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground">Putar musik dan video dari YouTube & Spotify. Player global tetap aktif saat kamu pindah halaman, kategori, atau menu.</p>
      </motion.div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                data-testid="input-media-url"
                placeholder="Paste link YouTube atau Spotify..."
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMedia()}
                className="pl-9"
              />
            </div>
            <Button data-testid="button-add-media" onClick={addMedia} disabled={loading || !url.trim()} className="bg-gradient-primary text-white gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Tambah
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Mendukung: YouTube video, shorts, playlist • Spotify track, album, playlist, podcast
          </p>
        </CardContent>
      </Card>

      {activeMedia && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge className={activeMedia.platform === 'youtube' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}>
                    {activeMedia.platform === 'youtube' ? 'YouTube' : 'Spotify'}
                  </Badge>
                  <Badge variant="outline" className="capitalize">{activeMedia.type}</Badge>
                  <span data-testid="text-media-source" className="text-xs capitalize text-muted-foreground">Sumber: {source}</span>
                </div>
                <h2 data-testid="text-active-media" className="truncate text-lg font-semibold">
                  {activeMedia.title || activeMedia.url}
                </h2>
                <p className="truncate text-sm text-muted-foreground">{activeMedia.url}</p>
                <p data-testid="text-media-queue" className="mt-1 text-xs text-muted-foreground">Queue tersimpan: {queue.length} item • state play/pause, posisi, volume, loop, dan sumber disimpan otomatis.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button data-testid="button-media-play-pause" size="sm" className="bg-gradient-primary text-white gap-2" onClick={() => setIsPlaying(!isPlaying)}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>
                <a data-testid="link-media-original" href={activeMedia.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    Buka asli <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="flex items-center gap-3">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <Slider
                  data-testid="slider-media-volume"
                  value={[volume]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={value => setVolume(value[0] || 0)}
                />
                <span data-testid="text-media-volume" className="w-10 text-xs text-muted-foreground">{volume}%</span>
              </div>
              <Button
                data-testid="button-media-loop"
                variant="outline"
                size="sm"
                className="gap-2 text-sm"
                onClick={() => {
                  const next: Record<LoopMode, LoopMode> = { off: 'one', one: 'all', all: 'off' };
                  setLoop(next[loop]);
                }}
              >
                {loop === 'one' ? <Repeat1 className="h-4 w-4 text-primary" /> : <Repeat className={`h-4 w-4 ${loop === 'all' ? 'text-primary' : 'text-muted-foreground'}`} />}
                {loop === 'off' ? 'Loop: Off' : loop === 'one' ? 'Loop: Satu' : 'Loop: Semua'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {library.length > 0 && (
        <>
          <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Library ({library.length})</h2>
            <div className="flex gap-2">
              {(['all', 'youtube', 'spotify'] as const).map(f => (
                <Button
                  key={f}
                  data-testid={`button-filter-${f}`}
                  size="sm"
                  variant={filter === f ? 'default' : 'outline'}
                  onClick={() => setFilter(f)}
                  className={filter === f ? 'bg-gradient-primary text-white' : ''}
                >
                  {f === 'all' ? 'Semua' : f === 'youtube' ? 'YouTube' : 'Spotify'}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pb-40">
            <AnimatePresence>
              {filtered.map((item, idx) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.2) }}
                >
                  <Card
                    data-testid={`card-media-${item.id}`}
                    className={`cursor-pointer card-hover ${activeMedia?.id === item.id ? 'ring-2 ring-primary shadow-elevated' : ''}`}
                    onClick={() => playMedia(item, 'library')}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {(item.thumbnail || (item.platform === 'youtube' && (() => { const m = item.embed_url.match(/embed\/([\w-]{11})/); return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null; })()))
                              ? <img src={item.thumbnail || `https://img.youtube.com/vi/${item.embed_url.match(/embed\/([\w-]{11})/)![1]}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" />
                              : <div className={`flex h-full w-full items-center justify-center ${item.platform === 'youtube' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}><Music className="h-4 w-4" /></div>
                            }
                          </div>
                          <div className="min-w-0">
                            <p data-testid={`text-media-url-${item.id}`} className="text-sm font-medium truncate">
                              {item.title || item.url}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">{item.platform} • {item.type}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button data-testid={`button-favorite-media-${item.id}`} variant="ghost" size="icon" className="h-7 w-7 hover-scale" onClick={e => { e.stopPropagation(); toggleFavorite(item.id); }}>
                            <Heart className={`h-3.5 w-3.5 transition-colors ${item.favorite ? 'fill-red-500 text-red-500' : ''}`} />
                          </Button>
                          <Button data-testid={`button-remove-media-${item.id}`} variant="ghost" size="icon" className="h-7 w-7 text-destructive hover-scale" onClick={e => { e.stopPropagation(); removeMedia(item.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      {library.length === 0 && !activeMedia && (
        <Card className="border-dashed border-2 border-border/60">
          <CardContent className="py-16 text-center">
            <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Belum ada media</h3>
            <p className="text-sm text-muted-foreground">Paste link YouTube atau Spotify di atas untuk mulai. Setelah diputar, player akan tetap berjalan saat berpindah halaman.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
