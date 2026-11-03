import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { zh, en, type MessageKey } from './messages';
import type { Locale } from '../domain/types';
const Context = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey) => string;
}>(null!);
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    try {
      const s = localStorage.getItem('everdale.locale');
      if (s === 'en' || s === 'zh-CN') return s;
    } catch {
      /* unavailable storage */
    }
    return navigator.language.startsWith('zh') ? 'zh-CN' : 'en';
  });
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === 'zh-CN' ? 'Everdale · 村庄布局' : 'Everdale · Village planner';
    try {
      localStorage.setItem('everdale.locale', locale);
    } catch {
      /* still works in memory */
    }
  }, [locale]);
  return (
    <Context value={{ locale, setLocale, t: (key) => (locale === 'zh-CN' ? zh : en)[key] }}>
      {children}
    </Context>
  );
}
export const useI18n = () => useContext(Context);
