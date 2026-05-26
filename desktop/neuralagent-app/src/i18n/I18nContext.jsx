import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import en from './messages/en';
import zh from './messages/zh';

const STORAGE_KEY = 'neuralagent.locale';

const catalogs = { en, zh };

export const I18nContext = createContext(null);

function detectLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch (_) {
    /* ignore */
  }
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language || (navigator.languages && navigator.languages[0]) || 'en';
    if (/^zh/i.test(lang)) return 'zh';
  }
  return 'en';
}

function getNested(obj, path) {
  if (!path || !obj) return undefined;
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function interpolate(str, vars) {
  if (!vars || typeof str !== 'string') return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    vars[k] != null ? String(vars[k]) : ''
  );
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => detectLocale());

  const setLocale = useCallback((loc) => {
    if (loc !== 'en' && loc !== 'zh') return;
    setLocaleState(loc);
    try {
      localStorage.setItem(STORAGE_KEY, loc);
    } catch (_) {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key, vars) => {
      const raw =
        getNested(catalogs[locale], key) ?? getNested(catalogs.en, key);
      if (raw === undefined) return key;
      if (typeof raw === 'string') return interpolate(raw, vars);
      return raw;
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      messages: catalogs[locale],
    }),
    [locale, setLocale, t]
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
