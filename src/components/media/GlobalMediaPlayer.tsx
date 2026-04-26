import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ListMusic, Maximize2, Minimize2, Music, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { useMediaPlayer, type LoopMode, type MediaItem } from '@/contexts/MediaPlayerContext';

function getYouTubeThumbnail(embedUrl: string): string | null {
  const m = embedUrl.match(/embed\/([\w-]{11})/);
  if (m) return `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg`;
  return null;
}

function getItemThumbnail(item: MediaItem): string | null {
  if (item.thumbnail) return item.thumbnail;
  if (item.platform === 'youtube') return getYouTubeThumbnail(item.embed_url);
  return null;
}

function withAutoplay(url: string, platform: MediaItem['platform'], loopMode: LoopMode = 'off') {
  const sep = url.includes('?') ? '&' : '?';
  if (platform === 'youtube') {
    let loopParam = '';
    if (loopMode === 'one') {
      if (url.includes('videoseries')) {
        loopParam = '&loop=1';
      } else {
        const vid = url.match(/embed\/([\w-]{11})/)?.[1];
        if (vid) loopParam = `&loop=1&playlist=${vid}`;
      }
    }
    return `${url}${sep}autoplay=1&playsinline=1&enablejsapi=1${loopParam}`;
  }
  return `${url}${sep}autoplay=1`;
}

function sendYouTubeCommand(iframe: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  if (!iframe) return;
  iframe.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func, args }),
    '*'
  );
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getEmbedHeight(item: MediaItem): number {
  if (item.platform === 'youtube') return 220;
  if (item.type === 'track' || item.type === 'episode') return 152;
  return 240;
}

function getDisplayTitle(item: MediaItem): string {
  if (item.title) return item.title;
  try {
    const u = new URL(item.url);
    const v = u.searchParams.get('v');
    if (v) return `YouTube · ${v}`;
    const path = u.pathname.split('/').filter(Boolean).pop() ?? '';
    if (path && path.length < 40) return decodeURIComponent(path).replace(/[-_]/g, ' ');
  } catch {}
  return item.url.length > 50 ? `${item.url.slice(0, 50)}…` : item.url;
}

const LOOP_NEXT: Record<LoopMode, LoopMode> = { off: 'one', one: 'all', all: 'off' };
const LOOP_LABEL: Record<LoopMode, string> = { off: 'Off', one: 'Satu', all: 'Semua' };

export default function GlobalMediaPlayer() {
  const {
    activeMedia,
    isPlaying,
    positionSeconds,
    volume,
    loop,
    queue,
    source,
    setIsPlaying,
    setPositionSeconds,
    setVolume,
    setLoop,
    playNext,
    playPrevious,
    clearActiveMedia,
  } = useMediaPlayer();

  const [expanded, setExpanded] = useState(true);
  const [showQueue, setShowQueue] = useState(false);
  const [ytDuration, setYtDuration] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const embedUrl = useMemo(
    () => activeMedia ? withAutoplay(activeMedia.embed_url, activeMedia.platform, loop) : '',
    [activeMedia, loop]
  );

  useEffect(() => {
    setYtDuration(0);
  }, [activeMedia?.id]);

  useEffect(() => {
    if (activeMedia?.platform !== 'youtube') return;
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.youtube.com') return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.event === 'onReady') {
          sendYouTubeCommand(iframeRef.current, 'setVolume', [volume]);
        }
        if (data.event === 'infoDelivery' && data.info) {
          if (typeof data.info.duration === 'number' && data.info.duration > 0) {
            setYtDuration(Math.round(data.info.duration));
          }
          if (typeof data.info.currentTime === 'number') {
            setPositionSeconds(Math.round(data.info.currentTime));
          }
        }
      } catch {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMedia?.platform, activeMedia?.id]);

  useEffect(() => {
    if (activeMedia?.platform !== 'youtube') return;
    sendYouTubeCommand(iframeRef.current, 'setVolume', [volume]);
  }, [volume, activeMedia?.platform]);

  useEffect(() => {
    if (activeMedia?.platform !== 'youtube') return;
    const timer = window.setTimeout(() => {
      sendYouTubeCommand(iframeRef.current, 'setVolume', [volume]);
    }, 1500);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMedia?.id]);

  const thumbnail = useMemo(() => activeMedia ? getItemThumbnail(activeMedia) : null, [activeMedia]);

  const currentIndex = useMemo(() => {
    if (!activeMedia) return -1;
    return queue.findIndex(item => item.id === activeMedia.id);
  }, [activeMedia, queue]);

  const nextItems = useMemo(() => {
    if (currentIndex === -1 || queue.length === 0) return [];
    const after = queue.slice(currentIndex + 1, currentIndex + 4);
    if (after.length < 3 && loop === 'all' && queue.length > 1) {
      const wrap = queue.slice(0, 3 - after.length).filter(i => i.id !== activeMedia?.id);
      return [...after, ...wrap].slice(0, 3);
    }
    return after;
  }, [currentIndex, queue, loop, activeMedia]);

  const canSkip = queue.length > 1 || loop !== 'off';

  if (!activeMedia) return null;

  const title = getDisplayTitle(activeMedia);
  const isYouTube = activeMedia.platform === 'youtube';

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-4 sm:w-[460px]"
      data-testid="global-media-player"
    >
      <Card className="overflow-hidden border-primary/20 bg-background/97 shadow-elevated backdrop-blur-xl">
        <CardContent className="p-0">

          {/* ── Header: thumbnail + info + action icons ── */}
          <div className="flex items-center gap-3 px-3 pt-3 pb-2">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted shadow-sm">
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt={title}
                  className="h-full w-full object-cover"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-primary">
                  <Music className="h-5 w-5 text-white" />
                </div>
              )}
              <div className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border border-background ${isPlaying ? 'bg-green-500' : 'bg-yellow-400'}`} />
            </div>

            <div className="min-w-0 flex-1">
              <p
                data-testid="text-player-active-track"
                className="truncate text-sm font-semibold leading-snug"
                title={title}
              >
                {title}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                <Badge
                  className={`h-4 px-1.5 py-0 text-[10px] ${isYouTube ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}
                >
                  {isYouTube ? 'YouTube' : 'Spotify'}
                </Badge>
                <span data-testid="text-player-source" className="text-[10px] capitalize text-muted-foreground">
                  {source}
                </span>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span data-testid="text-player-queue" className="text-[10px] text-muted-foreground">
                  {queue.length} item
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                data-testid="button-player-toggle-expanded"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title={expanded ? 'Sembunyikan video' : 'Tampilkan video'}
                onClick={() => setExpanded(v => !v)}
              >
                {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              <Button
                data-testid="button-player-close"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                title="Tutup player"
                onClick={clearActiveMedia}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* ── Video iframe — always mounted so audio keeps playing when collapsed ── */}
          <div
            className="mx-3 overflow-hidden rounded-xl border border-border/50 bg-black transition-all duration-300"
            style={{
              height: expanded ? getEmbedHeight(activeMedia) : 0,
              marginBottom: expanded ? 8 : 0,
              borderWidth: expanded ? 1 : 0,
            }}
            aria-hidden={!expanded}
          >
            <iframe
              key={`${activeMedia.id}--${loop}`}
              ref={iframeRef}
              data-testid="iframe-global-media"
              src={embedUrl}
              width="100%"
              height={getEmbedHeight(activeMedia)}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="border-0"
            />
          </div>

          {/* ── Controls ── */}
          <div className="space-y-2.5 px-3 pb-3">

            {/* Transport + loop + queue + links */}
            <div className="flex items-center justify-between gap-2">

              {/* Loop button */}
              <Button
                data-testid="button-player-loop"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-[11px]"
                title={`Loop: ${LOOP_LABEL[loop]}`}
                onClick={() => setLoop(LOOP_NEXT[loop])}
              >
                {loop === 'one'
                  ? <Repeat1 className="h-3.5 w-3.5 text-primary" />
                  : <Repeat className={`h-3.5 w-3.5 ${loop === 'all' ? 'text-primary' : 'text-muted-foreground'}`} />
                }
                <span className={`font-medium ${loop !== 'off' ? 'text-primary' : 'text-muted-foreground'}`}>
                  {LOOP_LABEL[loop]}
                </span>
              </Button>

              {/* Prev / Play / Next */}
              <div className="flex items-center gap-1">
                <Button
                  data-testid="button-player-previous"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Sebelumnya"
                  onClick={playPrevious}
                  disabled={!canSkip}
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button
                  data-testid="button-player-play-pause"
                  size="icon"
                  className="h-10 w-10 rounded-full bg-gradient-primary text-white shadow-md"
                  title={isPlaying ? 'Pause' : 'Play'}
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying
                    ? <Pause className="h-4 w-4" />
                    : <Play className="h-4 w-4 translate-x-px" />
                  }
                </Button>
                <Button
                  data-testid="button-player-next"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Selanjutnya"
                  onClick={playNext}
                  disabled={!canSkip}
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>

              {/* Queue toggle + media page link */}
              <div className="flex items-center gap-0.5">
                <Button
                  data-testid="button-player-queue-toggle"
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${showQueue ? 'text-primary' : ''}`}
                  title="Lihat queue"
                  onClick={() => setShowQueue(v => !v)}
                >
                  <ListMusic className="h-3.5 w-3.5" />
                </Button>
                <a
                  data-testid="link-player-original"
                  href={activeMedia.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Buka di platform asli"
                >
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => setVolume(volume === 0 ? 80 : 0)}
                title={volume === 0 ? 'Unmute' : 'Mute'}
              >
                {volume === 0
                  ? <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
                  : <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                }
              </Button>
              <Slider
                data-testid="slider-player-volume"
                className="flex-1"
                value={[volume]}
                min={0}
                max={100}
                step={1}
                onValueChange={value => setVolume(value[0] ?? 0)}
              />
              <span
                data-testid="text-player-volume"
                className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground"
              >
                {volume}%
              </span>
              <Link
                to="/media"
                data-testid="link-player-media-page"
                className="ml-1 text-[11px] font-medium text-primary hover:underline"
              >
                Library
              </Link>
            </div>

            {/* Mini queue preview */}
            {showQueue && (
              <div className="rounded-lg border border-border/50 bg-muted/30 p-2.5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Queue · {queue.length} item
                </p>
                {nextItems.length > 0 ? (
                  <div className="space-y-1.5">
                    {nextItems.map((item, idx) => {
                      const t = getItemThumbnail(item);
                      return (
                        <div key={item.id} data-testid={`queue-item-${item.id}`} className="flex items-center gap-2">
                          <span className="w-3 shrink-0 text-right text-[10px] text-muted-foreground">{idx + 1}</span>
                          <div className="h-7 w-7 shrink-0 overflow-hidden rounded bg-muted">
                            {t ? (
                              <img src={t} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className={`flex h-full w-full items-center justify-center ${item.platform === 'youtube' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                                <Music className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium">{getDisplayTitle(item)}</p>
                            <p className="text-[10px] capitalize text-muted-foreground">{item.platform} · {item.type}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-[11px] text-muted-foreground py-1">Tidak ada item berikutnya</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
