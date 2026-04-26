import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const getSystemTheme = (): ResolvedTheme => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
const isTheme = (value: string | null): value is Theme => value === 'light' || value === 'dark' || value === 'system';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('gqth-theme');
    return isTheme(saved) ? saved : 'system';
  });
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => theme === 'system' ? getSystemTheme() : theme);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
    localStorage.setItem('gqth-theme', nextTheme);
  };

  useEffect(() => {
    const resolve = () => {
      const nextResolved = theme === 'system' ? getSystemTheme() : theme;
      setResolvedTheme(nextResolved);
      document.documentElement.classList.toggle('dark', nextResolved === 'dark');
      document.documentElement.dataset.theme = theme;
    };

    resolve();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', resolve);
    return () => media.removeEventListener('change', resolve);
  }, [theme]);

  useEffect(() => {
    const handleProfileTheme = (event: Event) => {
      const detail = (event as CustomEvent<{ theme?: string }>).detail;
      if (isTheme(detail?.theme || null)) setTheme(detail.theme as Theme);
    };
    window.addEventListener('gqth-theme-sync', handleProfileTheme);
    return () => window.removeEventListener('gqth-theme-sync', handleProfileTheme);
  }, []);

  const toggleTheme = () => setTheme(resolvedTheme === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
