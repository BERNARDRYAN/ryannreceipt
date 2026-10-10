"use client";

import { useCallback } from "react";

import { en } from "@/lib/i18n/en";
import { ms } from "@/lib/i18n/ms";
import { zh } from "@/lib/i18n/zh";
import { usePrefsStore } from "@/lib/store/prefs-store";

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

export const LOCALES = ["en", "zh", "ms"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = { en: "English", zh: "中文", ms: "Bahasa Melayu" };

const DICTS: Record<Locale, Messages> = { en, zh, ms };

/** BCP-47 tag for Intl formatting (dates, month names). */
export const INTL_LOCALE: Record<Locale, string> = { en: "en-MY", zh: "zh-CN", ms: "ms-MY" };

export type TFunction = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>) {
  const template = DICTS[locale][key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/**
 * Translator for the current UI language. Server render and first client
 * render use English (prefs load from localStorage after mount).
 */
export function useT(): TFunction {
  const locale = usePrefsStore((s) => s.locale);
  return useCallback((key, vars) => translate(locale, key, vars), [locale]);
}

export function useLocale() {
  return usePrefsStore((s) => s.locale);
}
