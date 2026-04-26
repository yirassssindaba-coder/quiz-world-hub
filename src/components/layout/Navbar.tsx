import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, type Theme } from '@/contexts/ThemeContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Globe, Menu, Moon, Sun, User, LogOut, LayoutDashboard, Shield, BookOpen, Clock, Newspaper, Languages, Music, Monitor, Sparkles, FolderOpen } from 'lucide-react';
import TranslateWidget from '@/components/TranslateWidget';
import ExperienceToggle from '@/components/experience/ExperienceToggle';

const navItems = [
  { href: '/quiz', label: 'Quiz', icon: BookOpen },
  { href: '/quiz-importer', label: 'PDF Import', icon: Sparkles },
  { href: '/documents', label: 'Vault', icon: FolderOpen },
  { href: '/world-clock', label: 'World Clock', icon: Clock },
  { href: '/news', label: 'News', icon: Newspaper },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/translator', label: 'Translator', icon: Languages },
  { href: '/media', label: 'Media', icon: Music },
];

const themeOptions: { value: Theme; label: string; description: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', description: 'Tampilan terang', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Tampilan gelap', icon: Moon },
  { value: 'system', label: 'System', description: 'Ikuti perangkat', icon: Monitor },
];

export default function Navbar() {
  const { user, isAdmin, signOut, profile, refreshProfile } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleThemeChange = async (nextTheme: Theme) => {
    setTheme(nextTheme);
    if (user) {
      const { error } = await supabase.from('profiles').update({ theme_preference: nextTheme }).eq('user_id', user.id);
      if (!error) refreshProfile();
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <nav className="container flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0" data-testid="link-home">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <span className="hidden sm:block font-bold text-lg tracking-tight font-[Space_Grotesk]">
            Global Quiz Time Hub
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navItems.map(item => (
            <Link key={item.href} to={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
              <Button variant={location.pathname.startsWith(item.href) ? 'secondary' : 'ghost'} size="sm" className="gap-2">
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <ExperienceToggle />
          <TranslateWidget />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-testid="button-theme-menu" variant="ghost" size="icon" className="h-9 w-9">
                {resolvedTheme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>
                <div>
                  <p>Pilih Tema</p>
                  <p className="text-xs font-normal text-muted-foreground">Preview cepat dan tersimpan di profil.</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="grid grid-cols-3 gap-2 p-2">
                {themeOptions.map(option => (
                  <button
                    key={option.value}
                    data-testid={`button-theme-${option.value}`}
                    onClick={() => handleThemeChange(option.value)}
                    className={`rounded-xl border p-2 text-left transition-all hover:border-primary/60 ${theme === option.value ? 'border-primary bg-primary/10 shadow-sm' : 'border-border bg-background'}`}
                  >
                    <div className={`mb-2 h-12 rounded-lg border ${option.value === 'dark' ? 'bg-slate-950' : option.value === 'light' ? 'bg-white' : 'bg-gradient-to-br from-white to-slate-950'}`} />
                    <div className="flex items-center gap-1 text-xs font-semibold">
                      <option.icon className="h-3 w-3" />{option.label}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{option.description}</p>
                  </button>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button data-testid="button-user-menu" variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium truncate" data-testid="text-navbar-user-name">{profile?.display_name || user.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/profile" className="cursor-pointer" data-testid="link-profile"><User className="mr-2 h-4 w-4" />Profil</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/dashboard" className="cursor-pointer" data-testid="link-dashboard"><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</Link></DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild><Link to="/admin" className="cursor-pointer" data-testid="link-admin"><Shield className="mr-2 h-4 w-4" />Admin Panel</Link></DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive"><LogOut className="mr-2 h-4 w-4" />Keluar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth" data-testid="link-login">
              <Button size="sm" className="bg-gradient-primary hover:opacity-90 text-white">Masuk</Button>
            </Link>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button data-testid="button-mobile-menu" variant="ghost" size="icon" className="h-9 w-9 md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="flex flex-col gap-2 mt-8">
                {navItems.map(item => (
                  <Link key={item.href} to={item.href} onClick={() => setMobileOpen(false)} data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
                    <Button variant={location.pathname.startsWith(item.href) ? 'secondary' : 'ghost'} className="w-full justify-start gap-3">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                ))}
                {isAdmin && (
                  <Link to="/admin" onClick={() => setMobileOpen(false)} data-testid="link-mobile-admin">
                    <Button variant="ghost" className="w-full justify-start gap-3">
                      <Shield className="h-4 w-4" />Admin Panel
                    </Button>
                  </Link>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
