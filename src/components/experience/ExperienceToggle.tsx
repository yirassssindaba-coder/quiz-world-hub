import { Gauge, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useExperience } from '@/contexts/ExperienceContext';

export default function ExperienceToggle() {
  const { disableHeavyEffects, heavyEffectsEnabled, prefersReducedMotion, prefersReducedData, setDisableHeavyEffects } = useExperience();
  const constrained = prefersReducedMotion || prefersReducedData;

  return (
    <Button
      data-testid="button-3d-mode-toggle"
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      title={heavyEffectsEnabled ? 'Matikan efek 3D berat' : constrained ? 'Mode aksesibilitas aktif' : 'Aktifkan efek 3D'}
      onClick={() => setDisableHeavyEffects(!disableHeavyEffects)}
    >
      {heavyEffectsEnabled ? <Sparkles className="h-4 w-4 text-primary" /> : <Gauge className="h-4 w-4" />}
    </Button>
  );
}