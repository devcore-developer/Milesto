"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { format } from "date-fns";
import { ar as arLocale, enUS } from "date-fns/locale";
import { en, type TranslationKey } from "./en";
import { ar } from "./ar";

export type Lang = "en" | "ar";

const dictionaries: Record<Lang, Record<TranslationKey, string>> = { en, ar };

interface I18nContextValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  isRTL: boolean;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "mylist.lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    // Restore persisted language after hydration (deferred to avoid
    // synchronous setState in effect and hydration mismatches).
    const id = window.setTimeout(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "ar" || saved === "en") setLangState(saved);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      let text = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replaceAll(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [lang],
  );

  const value = useMemo(
    () => ({
      lang,
      dir: lang === "ar" ? ("rtl" as const) : ("ltr" as const),
      isRTL: lang === "ar",
      setLang,
      t,
    }),
    [lang, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}

/** Locale-aware date formatting (short numeric-friendly patterns). */
export function formatDate(
  value: string | Date | null | undefined,
  lang: Lang,
  pattern = "d MMM yyyy",
): string {
  if (!value) return "";
  try {
    return format(new Date(value), pattern, {
      locale: lang === "ar" ? arLocale : enUS,
    });
  } catch {
    return "";
  }
}

/** Class helper for mirroring directional icons in RTL. */
export function rtlClass(base: string, extra = ""): string {
  return `${base} rtl:rotate-180 ${extra}`.trim();
}
