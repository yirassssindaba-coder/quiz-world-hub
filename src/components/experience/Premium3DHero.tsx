import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Clock, Languages, Music, Newspaper, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useExperience } from '@/contexts/ExperienceContext';
import { useMediaPlayer } from '@/contexts/MediaPlayerContext';
import { getActiveModel, type ModelAssetWithData } from '@/lib/modelAssets';

const hotspots = [
  { id: 'quiz', label: 'Quiz', icon: BookOpen, href: '/quiz', note: '6000+ soal lintas kategori' },
  { id: 'clock', label: 'World Clock', icon: Clock, href: '/world-clock', note: '191 negara & zona waktu' },
  { id: 'news', label: 'News', icon: Newspaper, href: '/news', note: 'Sumber utama + alternatif' },
  { id: 'translator', label: 'AI Translator', icon: Languages, href: '/translator', note: 'Terjemahan multi bahasa' },
  { id: 'media', label: 'Media Hub', icon: Music, href: '/media', note: 'Player global persistent' },
];

function useModelViewerScript(enabled: boolean) {
  useEffect(() => {
    if (!enabled || customElements.get('model-viewer')) return;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
    script.dataset.gqthModelViewer = 'true';
    document.head.appendChild(script);
  }, [enabled]);
}

export default function Premium3DHero() {
  const { heavyEffectsEnabled } = useExperience();
  const { isPlaying } = useMediaPlayer();
  const [activeHotspot, setActiveHotspot] = useState(hotspots[0]);
  const [model, setModel] = useState<ModelAssetWithData | null>(null);
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLElement | null>(null);
  useModelViewerScript(heavyEffectsEnabled && Boolean(model?.modelDataUrl));

  useEffect(() => {
    getActiveModel('hero').then(setModel).catch(() => setModel(null));
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const renderModel = heavyEffectsEnabled && visible && model?.modelDataUrl;

  return (
    <section ref={ref} className="relative overflow-hidden py-12 sm:py-16 lg:py-24">
      <div className="absolute inset-0 bg-gradient-animated opacity-80" />
      <div className={`ambient-field ${isPlaying ? 'ambient-field-playing' : ''}`} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="container relative">
        <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-4 py-1.5 text-sm backdrop-blur shadow-card"
            >
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-muted-foreground">Premium 3D Learning Hub</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-7xl font-[Space_Grotesk]"
            >
              <span className="text-gradient">Global Quiz</span>
              <br />
              <span>Time Hub</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0"
            >
              Platform quiz multi-kategori, jam dunia real-time, berita terkurasi, AI translator, dan media hub dengan player global yang tetap berjalan saat kamu berpindah halaman.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start"
            >
              <Link to="/quiz">
                <Button data-testid="button-hero-start-quiz" size="lg" className="w-full bg-gradient-primary px-8 text-white shadow-elevated hover:opacity-90 sm:w-auto">
                  <BookOpen className="mr-2 h-5 w-5" />
                  Mulai Quiz
                </Button>
              </Link>
              <Link to="/news">
                <Button data-testid="button-hero-news" size="lg" variant="outline" className="w-full px-8 sm:w-auto">
                  <Newspaper className="mr-2 h-5 w-5" />
                  Lihat Info Global
                </Button>
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94, rotateX: 8 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ duration: 0.75, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-xl perspective-scene"
          >
            <div className="relative min-h-[420px] rounded-[2rem] border border-primary/20 bg-card/60 p-4 shadow-elevated backdrop-blur-xl">
              {renderModel ? (
                <model-viewer
                  data-testid="model-viewer-hero"
                  src={model.modelDataUrl}
                  poster={model.thumbnailDataUrl || model.fallbackDataUrl}
                  alt={model.description || model.name}
                  camera-controls
                  auto-rotate
                  rotation-per-second="12deg"
                  shadow-intensity="0.8"
                  exposure="0.9"
                  loading="lazy"
                  reveal="auto"
                  className="h-[390px] w-full rounded-[1.5rem]"
                />
              ) : (
                <div className={`hero-orb ${heavyEffectsEnabled && visible ? 'hero-orb-animated' : ''}`} data-testid="fallback-3d-hero">
                  <span />
                  <span />
                  <span />
                  <div className="hero-orb-core">
                    <GlobeMini />
                  </div>
                </div>
              )}

              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-border/60 bg-background/85 p-3 shadow-card backdrop-blur">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p data-testid="text-hero-hotspot" className="text-sm font-semibold">{activeHotspot.label}</p>
                    <p className="text-xs text-muted-foreground">{activeHotspot.note}</p>
                  </div>
                  <Link to={activeHotspot.href}>
                    <Button data-testid="button-open-hotspot" size="sm" variant="outline">Buka</Button>
                  </Link>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {hotspots.map(item => (
                    <button
                      key={item.id}
                      data-testid={`button-hotspot-${item.id}`}
                      onMouseEnter={() => setActiveHotspot(item)}
                      onFocus={() => setActiveHotspot(item)}
                      onClick={() => setActiveHotspot(item)}
                      className={`rounded-xl border p-2 transition-all hover:-translate-y-0.5 ${activeHotspot.id === item.id ? 'border-primary bg-primary/10 text-primary shadow-card' : 'border-border bg-card/70 text-muted-foreground'}`}
                    >
                      <item.icon className="mx-auto h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>

              <Badge className="absolute left-5 top-5 bg-background/90 text-foreground shadow-card backdrop-blur">
                {model?.active ? `Model ${model.version}` : 'Fallback 3D Ringan'}
              </Badge>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function GlobeMini() {
  return (
    <svg viewBox="0 0 120 120" className="h-32 w-32 text-primary" aria-hidden="true">
      <circle cx="60" cy="60" r="46" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.55" />
      <ellipse cx="60" cy="60" rx="22" ry="46" fill="none" stroke="currentColor" strokeWidth="1.8" opacity="0.45" />
      <path d="M18 60h84M27 38h66M27 82h66" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <circle cx="41" cy="44" r="4" fill="currentColor" />
      <circle cx="78" cy="69" r="4" fill="currentColor" opacity="0.8" />
      <circle cx="62" cy="31" r="3" fill="currentColor" opacity="0.7" />
    </svg>
  );
}