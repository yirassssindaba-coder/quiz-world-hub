import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, type Theme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Save, Loader2, Sun, Moon, Monitor, Sparkles } from 'lucide-react';

const themeOptions: { value: Theme; label: string; description: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', description: 'Terang, bersih, cocok untuk siang hari.', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Gelap, nyaman untuk belajar malam.', icon: Moon },
  { value: 'system', label: 'System', description: 'Otomatis mengikuti perangkat.', icon: Monitor },
];

export default function Profile() {
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<Theme>(theme);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/auth'); return; }
    if (profile) {
      setDisplayName(profile.display_name || '');
      if (profile.theme_preference === 'light' || profile.theme_preference === 'dark' || profile.theme_preference === 'system') {
        setSelectedTheme(profile.theme_preference);
      }
    }
  }, [profile, user, authLoading, navigate]);

  const handleThemePreview = (nextTheme: Theme) => {
    setSelectedTheme(nextTheme);
    setTheme(nextTheme);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ display_name: displayName, theme_preference: selectedTheme }).eq('user_id', user.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
    } else {
      setTheme(selectedTheme);
      toast({ title: 'Profil berhasil diperbarui!', description: 'Preferensi tema akan dipakai saat login kembali.' });
      refreshProfile();
    }
  };

  if (authLoading) return <div className="container py-12"><Skeleton className="h-64 max-w-lg mx-auto rounded-xl" /></div>;

  return (
    <div className="container py-12 max-w-3xl">
      <Card className="shadow-elevated border-border/50 overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-primary/10 via-background to-accent/10">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="font-[Space_Grotesk]">Profil Saya</CardTitle>
            <Badge variant="outline" className="gap-1" data-testid="status-theme-current">
              <Sparkles className="h-3 w-3" /> Tema aktif: {resolvedTheme === 'dark' ? 'Dark' : 'Light'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-7 p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-primary flex items-center justify-center shadow-elevated">
              <User className="h-8 w-8 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate" data-testid="text-profile-display-name">{profile?.display_name || 'User'}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1 truncate" data-testid="text-profile-email"><Mail className="h-3 w-3 shrink-0" />{user?.email}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display-name">Nama Tampilan</Label>
            <Input data-testid="input-display-name" id="display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Nama kamu" />
          </div>

          <div className="space-y-3">
            <div>
              <Label>Preferensi Tema</Label>
              <p className="text-sm text-muted-foreground">Pilih tampilan yang nyaman. Pilihan ini disimpan di profil dan otomatis diterapkan di desktop maupun mobile.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {themeOptions.map(option => (
                <button
                  key={option.value}
                  data-testid={`button-profile-theme-${option.value}`}
                  onClick={() => handleThemePreview(option.value)}
                  className={`rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-card ${selectedTheme === option.value ? 'border-primary bg-primary/10 shadow-card' : 'border-border bg-card'}`}
                >
                  <div className={`mb-4 h-20 rounded-xl border shadow-inner overflow-hidden relative
                    ${option.value === 'dark' ? 'bg-[hsl(222_30%_8%)] border-[hsl(222_15%_20%)]' :
                      option.value === 'light' ? 'bg-white border-slate-200' :
                      'bg-[hsl(216_24%_10%)] border-[hsl(216_14%_22%)]'}`}>
                    <div className={`m-3 h-3 w-14 rounded-full
                      ${option.value === 'dark' ? 'bg-[hsl(250_60%_65%)]' :
                        option.value === 'light' ? 'bg-[hsl(245_58%_51%)]' :
                        'bg-[hsl(197_90%_54%)]'}`} />
                    <div className={`mx-3 mt-2 h-2 rounded-full
                      ${option.value === 'dark' ? 'bg-[hsl(222_20%_18%)]' :
                        option.value === 'system' ? 'bg-[hsl(216_16%_20%)]' :
                        'bg-slate-200'}`} />
                    <div className={`mx-3 mt-2 h-2 w-2/3 rounded-full
                      ${option.value === 'dark' ? 'bg-[hsl(222_20%_14%)]' :
                        option.value === 'system' ? 'bg-[hsl(216_16%_17%)]' :
                        'bg-slate-100'}`} />
                    {option.value === 'system' && (
                      <div className="absolute bottom-2 right-2 h-4 w-4 rounded-full bg-[hsl(158_66%_44%)] opacity-70" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 font-semibold">
                    <option.icon className="h-4 w-4 text-primary" />{option.label}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          <Button data-testid="button-save-profile" onClick={handleSave} disabled={saving} className="w-full bg-gradient-primary text-white hover:opacity-90">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Simpan Profil & Tema
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
