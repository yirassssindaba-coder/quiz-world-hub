import { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface ExperienceContextValue {
  prefersReducedMotion: boolean;
  prefersReducedData: boolean;
  disableHeavyEffects: boolean;
  heavyEffectsEnabled: boolean;
  setDisableHeavyEffects: (value: boolean) => void;
}

const ExperienceContext = createContext<ExperienceContextValue | null>(null);
const STORAGE_KEY = 'gqth_disable_heavy_3d';

export function ExperienceProvider({ children }: { children: React.ReactNode }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [prefersReducedData, setPrefersReducedData] = useState(false);
  const [disableHeavyEffects, setDisableHeavyEffectsState] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setPrefersReducedMotion(motion.matches);
    updateMotion();
    motion.addEventListener('change', updateMotion);

    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    setPrefersReducedData(Boolean(connection?.saveData));

    return () => motion.removeEventListener('change', updateMotion);
  }, []);

  const setDisableHeavyEffects = (value: boolean) => {
    setDisableHeavyEffectsState(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  };

  const value = useMemo(() => ({
    prefersReducedMotion,
    prefersReducedData,
    disableHeavyEffects,
    heavyEffectsEnabled: !prefersReducedMotion && !prefersReducedData && !disableHeavyEffects,
    setDisableHeavyEffects,
  }), [prefersReducedMotion, prefersReducedData, disableHeavyEffects]);

  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>;
}

export function useExperience() {
  const context = useContext(ExperienceContext);
  if (!context) throw new Error('useExperience must be used inside ExperienceProvider');
  return context;
}