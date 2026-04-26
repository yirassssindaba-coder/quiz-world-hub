import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface TranslateContextType {
  lang: string;
  setLang: (lang: string) => void;
  t: (text: string) => string;
  translateBatch: (texts: string[]) => Promise<void>;
  isTranslating: boolean;
}

const LANGUAGES = [
  { code: 'id', label: '🇮🇩 Indonesia' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'ar', label: '🇸🇦 العربية' },
  { code: 'es', label: '🇪🇸 Español' },
  { code: 'fr', label: '🇫🇷 Français' },
  { code: 'ja', label: '🇯🇵 日本語' },
  { code: 'ko', label: '🇰🇷 한국어' },
  { code: 'zh', label: '🇨🇳 中文' },
  { code: 'de', label: '🇩🇪 Deutsch' },
];

export { LANGUAGES };

const TranslateContext = createContext<TranslateContextType | undefined>(undefined);

export const TranslateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState(() => localStorage.getItem('app_lang') || 'id');
  const [isTranslating, setIsTranslating] = useState(false);
  const cache = useRef<Map<string, Map<string, string>>>(new Map());

  const setLang = useCallback((newLang: string) => {
    setLangState(newLang);
    localStorage.setItem('app_lang', newLang);
  }, []);

  const t = useCallback((text: string): string => {
    if (lang === 'id' || !text) return text;
    const langCache = cache.current.get(lang);
    return langCache?.get(text) || text;
  }, [lang]);

  const translateBatch = useCallback(async (texts: string[]) => {
    if (lang === 'id' || texts.length === 0) return;

    const langCache = cache.current.get(lang) || new Map<string, string>();
    const untranslated = texts.filter(t => t && !langCache.has(t));
    if (untranslated.length === 0) return;

    setIsTranslating(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: untranslated, targetLang: lang }),
      });
      const data = await res.json();
      if (data?.translations) {
        untranslated.forEach((text, i) => {
          if (data.translations[i]) langCache.set(text, data.translations[i]);
        });
        cache.current.set(lang, langCache);
      }
    } catch (e) {
      console.error('Translation failed:', e);
    } finally {
      setIsTranslating(false);
    }
  }, [lang]);

  return (
    <TranslateContext.Provider value={{ lang, setLang, t, translateBatch, isTranslating }}>
      {children}
    </TranslateContext.Provider>
  );
};

export const useTranslate = () => {
  const ctx = useContext(TranslateContext);
  if (!ctx) throw new Error('useTranslate must be used within TranslateProvider');
  return ctx;
};
