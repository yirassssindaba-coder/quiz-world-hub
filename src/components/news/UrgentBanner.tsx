import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UrgentBannerProps {
  count: number;
  onDismiss?: () => void;
  onView?: () => void;
}

export default function UrgentBanner({ count, onDismiss, onView }: UrgentBannerProps) {
  if (count === 0) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
        className="mb-6 rounded-xl border border-amber-300/50 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-700/40 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-amber-100 dark:bg-amber-900/50 p-2 shrink-0">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {count} info penting & deadline terdeteksi
            </h3>
            <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">
              Pengumuman, batas akhir pendaftaran, atau beasiswa yang sedang dibuka.
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onView && (
              <Button size="sm" variant="ghost" onClick={onView} className="text-amber-700 dark:text-amber-300 h-8">
                Lihat
              </Button>
            )}
            {onDismiss && (
              <Button size="icon" variant="ghost" onClick={onDismiss} className="h-8 w-8 text-amber-700 dark:text-amber-300">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
