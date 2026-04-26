import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Briefcase, CalendarDays, GraduationCap, Newspaper } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useExperience } from '@/contexts/ExperienceContext';

const points = [
  { id: 'jakarta', x: 58, y: 63, region: 'Indonesia', title: 'Kampus & Beasiswa', type: 'Beasiswa', icon: GraduationCap, href: '/news', detail: 'Info PMB, RPL, LPDP, dan deadline akademik Indonesia.' },
  { id: 'singapore', x: 61, y: 58, region: 'Asia Tenggara', title: 'Lowongan Regional', type: 'Lowongan', icon: Briefcase, href: '/news', detail: 'Peluang kerja, internship, dan komunitas profesional terverifikasi.' },
  { id: 'tokyo', x: 70, y: 46, region: 'Asia Timur', title: 'Event Global', type: 'Event', icon: CalendarDays, href: '/world-clock', detail: 'Sinkronisasi waktu untuk event belajar dan webinar internasional.' },
  { id: 'london', x: 46, y: 39, region: 'Eropa', title: 'Berita Edukasi', type: 'News', icon: Newspaper, href: '/news', detail: 'Kanal publik dan resmi untuk update pendidikan global.' },
  { id: 'new-york', x: 27, y: 43, region: 'Amerika', title: 'AI & Media Hub', type: 'AI', icon: Newspaper, href: '/translator', detail: 'Konten global dapat diterjemahkan dan disimpan untuk belajar.' },
];

export default function InteractiveGlobe() {
  const [active, setActive] = useState(points[0]);
  const { heavyEffectsEnabled } = useExperience();

  return (
    <section className="py-16 sm:py-20">
      <div className="container">
        <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            className="text-center lg:text-left"
          >
            <Badge variant="outline" className="mb-4">Interactive 3D Globe</Badge>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl lg:text-4xl font-[Space_Grotesk]">Peta info global yang bisa di-hover</h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Titik wilayah menampilkan ringkasan berita, kampus, beasiswa, lowongan kerja, dan event global. Ranking dan fallback berita tetap ditangani oleh sistem `/news`.
            </p>
            <Card className="depth-card border-primary/20 bg-card/80 text-left shadow-card">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary text-white">
                    <active.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p data-testid="text-globe-active-title" className="font-semibold">{active.title}</p>
                    <p className="text-xs text-muted-foreground">{active.region}</p>
                  </div>
                </div>
                <p data-testid="text-globe-active-detail" className="mb-4 text-sm text-muted-foreground">{active.detail}</p>
                <Link to={active.href}>
                  <Button data-testid="button-globe-open" size="sm" className="bg-gradient-primary text-white">Buka bagian terkait</Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            className="relative mx-auto aspect-square w-full max-w-[560px] perspective-scene"
          >
            <div className={`interactive-globe ${heavyEffectsEnabled ? 'interactive-globe-animated' : ''}`} data-testid="interactive-3d-globe">
              <svg viewBox="0 0 100 100" className="h-full w-full" aria-label="Peta globe interaktif">
                <defs>
                  <radialGradient id="globeFill" cx="38%" cy="28%" r="70%">
                    <stop offset="0%" stopColor="hsl(var(--accent) / 0.35)" />
                    <stop offset="55%" stopColor="hsl(var(--primary) / 0.22)" />
                    <stop offset="100%" stopColor="hsl(var(--primary) / 0.08)" />
                  </radialGradient>
                </defs>
                <circle cx="50" cy="50" r="42" fill="url(#globeFill)" stroke="hsl(var(--primary) / 0.45)" strokeWidth="0.8" />
                <ellipse cx="50" cy="50" rx="18" ry="42" fill="none" stroke="hsl(var(--foreground) / 0.16)" strokeWidth="0.55" />
                <ellipse cx="50" cy="50" rx="32" ry="42" fill="none" stroke="hsl(var(--foreground) / 0.1)" strokeWidth="0.45" />
                <path d="M9 50h82M14 32h72M14 68h72" stroke="hsl(var(--foreground) / 0.12)" strokeWidth="0.5" />
                <path d="M25 35c7-7 17-9 30-6 8 2 13 0 20-5M25 70c9-8 20-9 34-5 7 2 13 0 19-5" stroke="hsl(var(--accent) / 0.35)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                {points.map(point => (
                  <g key={point.id}>
                    <circle cx={point.x} cy={point.y} r={active.id === point.id ? 5.5 : 4.2} fill="hsl(var(--primary))" opacity="0.18" />
                    <circle
                      data-testid={`button-globe-point-${point.id}`}
                      cx={point.x}
                      cy={point.y}
                      r={active.id === point.id ? 2.8 : 2.2}
                      fill="hsl(var(--primary))"
                      className="cursor-pointer transition-all"
                      onMouseEnter={() => setActive(point)}
                      onClick={() => setActive(point)}
                    />
                  </g>
                ))}
              </svg>
              <div className="globe-ring globe-ring-one" />
              <div className="globe-ring globe-ring-two" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}