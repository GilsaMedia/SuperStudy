import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { he } from '../i18n';

export type Language = 'en' | 'he';

type Params = Record<string, string | number>;

const STORAGE_KEY = 'superstudy_language';

let currentLanguage: Language = 'en';

function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key]) : match));
}

/**
 * Translates an English source string into the current language.
 * Keys are the English text itself; missing Hebrew entries fall back to English.
 * Usable outside components (e.g. error mappers); components should prefer
 * `useLanguage().t` so they re-render on language change.
 */
export function tr(text: string, params?: Params): string {
  const source = currentLanguage === 'he' ? he[text] ?? text : text;
  return interpolate(source, params);
}

interface LanguageContextValue {
  language: Language;
  isRTL: boolean;
  setLanguage: (lang: Language) => Promise<void>;
  toggleLanguage: () => Promise<void>;
  t: typeof tr;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'he' || saved === 'en') {
          currentLanguage = saved;
          setLanguageState(saved);
        }
      })
      .catch(() => {});
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    currentLanguage = lang;
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  }, []);

  const toggleLanguage = useCallback(
    () => setLanguage(language === 'en' ? 'he' : 'en'),
    [language, setLanguage]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      isRTL: language === 'he',
      setLanguage,
      toggleLanguage,
      // New function identity per language so consumers re-render.
      t: (text, params) => tr(text, params),
    }),
    [language, setLanguage, toggleLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
