import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useExperience } from '@/contexts/ExperienceContext';

const SESSION_KEY = 'gqth_intro_3d_seen';

export default function Intro3D() {
  const { heavyEffectsEnabled } = useExperience();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!heavyEffectsEnabled || sessionStorage.getItem(SESSION_KEY) === 'true') return;
    const timer = window.setTimeout(() => setOpen(true), 300);
    return () => window.clearTimeout(timer);
  }, [heavyEffectsEnabled]);

  const close = () => {
    sessionStorage.setItem(SESSION_KEY, 'true');
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid="intro-3d-overlay"
          className="fixed inset-0 z-[80] grid place-items-center bg-background/80 p-4 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-primary/20 bg-card p-6 text-center shadow-elevated"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-accent/15" />
            <div className="relative mx-auto mb-5 h-36 w-36 perspective-scene">
              <div className="hero-orb hero-orb-intro">
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="relative">
              <p className="mb-2 text-sm font-medium text-primary">Global Quiz Time Hub 3D Experience</p>
              <h2 className="mb-3 text-2xl font-bold font-[Space_Grotesk]">Masuk ke hub belajar global</h2>
              <p className="mx-auto mb-5 max-w-sm text-sm text-muted-foreground">
                Efek 3D ringan, globe interaktif, dan ambience responsif siap digunakan. Kamu bisa menonaktifkan efek berat kapan saja dari tombol mode 3D di navbar.
              </p>
              <div className="flex justify-center gap-2">
                <Button data-testid="button-skip-intro-3d" variant="outline" onClick={close}>Skip</Button>
                <Button data-testid="button-enter-intro-3d" className="bg-gradient-primary text-white" onClick={close}>Mulai</Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}