import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { am } from './am';
import { en, type MessageKey, type Messages } from './en';
import { formatMessage, type Params } from './format';
import { om } from './om';

export type Language = 'am' | 'om' | 'en';
export const LANGUAGES: readonly Language[] = ['am', 'om', 'en'];

const CATALOGS: Record<Language, Messages> = { am, om, en };
const STORAGE_KEY = 'mezgeb.language';

export type Translate = (key: MessageKey, params?: Params) => string;

export function translator(language: Language): Translate {
  const catalog = CATALOGS[language];
  return (key, params) => formatMessage(catalog[key] ?? en[key], params);
}

/** The saved choice, else the browser's language when we have it, else Amharic (ADR-006). */
export function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (LANGUAGES as string[]).includes(saved)) return saved as Language;
  } catch {
    // Storage can be blocked; fall through.
  }
  const browser = typeof navigator === 'undefined' ? '' : navigator.language.slice(0, 2);
  return (LANGUAGES as string[]).includes(browser) ? (browser as Language) : 'am';
}

interface I18n {
  language: Language;
  /** True once the person chose a language (not just the default). */
  chosen: boolean;
  setLanguage(language: Language): void;
  t: Translate;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({
  children,
  language: fixed,
}: {
  children: ReactNode;
  /** Tests pin the language. */
  language?: Language;
}) {
  const [language, setState] = useState<Language>(() => fixed ?? initialLanguage());
  const [chosen, setChosen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  });

  const setLanguage = useCallback((next: Language) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not saved; the choice still applies to this visit.
    }
    setState(next);
    setChosen(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18n>(
    () => ({ language, chosen, setLanguage, t: translator(language) }),
    [language, chosen, setLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
}

export function useT(): Translate {
  return useI18n().t;
}

export type { MessageKey };
