"use client";

import { Check, DatabaseBackup, HandCoins, Keyboard, LayoutTemplate, LockKeyhole, Monitor, Moon, Settings2, Sparkles, Sun } from "lucide-react";

import { menuItemClass, menuLabelClass, useAnchoredPopover } from "@/components/ui/use-anchored-popover";
import { LOCALE_NAMES, LOCALES, useT } from "@/lib/i18n/messages";
import { useEditorStore } from "@/lib/store/editor-store";
import { usePrefsStore, type ThemeChoice } from "@/lib/store/prefs-store";
import { useUiStore } from "@/lib/store/ui-store";

const THEMES: { value: ThemeChoice; icon: typeof Sun; label: "theme.system" | "theme.light" | "theme.dark" }[] = [
  { value: "system", icon: Monitor, label: "theme.system" },
  { value: "light", icon: Sun, label: "theme.light" },
  { value: "dark", icon: Moon, label: "theme.dark" },
];

/** Language, appearance, and (in the studio) templates, shortcuts and the tour. */
export function SettingsMenu({ studio = false }: { studio?: boolean }) {
  const t = useT();
  const { triggerProps, popoverProps, close } = useAnchoredPopover({ align: "end", width: 248 });
  const locale = usePrefsStore((s) => s.locale);
  const setLocale = usePrefsStore((s) => s.setLocale);
  const theme = usePrefsStore((s) => s.theme);
  const setTheme = usePrefsStore((s) => s.setTheme);

  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <>
      <button
        {...triggerProps}
        type="button"
        aria-label={t("settings.button")}
        title={t("settings.button")}
        className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground"
      >
        <Settings2 className="size-4" aria-hidden />
      </button>
      <div {...popoverProps} style={{ width: 248 }}>
        <p className={menuLabelClass}>{t("settings.language")}</p>
        <div role="radiogroup" aria-label={t("settings.language")}>
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={locale === l}
              lang={l === "zh" ? "zh-Hans" : l}
              onClick={() => setLocale(l)}
              className={menuItemClass}
            >
              <span className="flex-1">{LOCALE_NAMES[l]}</span>
              {locale === l && <Check className="size-4" aria-hidden />}
            </button>
          ))}
        </div>
        <div className="my-1 border-t border-border" />
        <p className={menuLabelClass}>{t("settings.theme")}</p>
        <div
          role="radiogroup"
          aria-label={t("settings.theme")}
          className="mx-1.5 mb-1.5 grid grid-cols-3 gap-0.5 rounded-lg bg-surface-muted p-0.5"
        >
          {THEMES.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className={`flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[11px] font-medium transition-colors ${
                theme === value ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" aria-hidden />
              {t(label)}
            </button>
          ))}
        </div>
        <div className="my-1 border-t border-border" />
        <button type="button" className={menuItemClass} onClick={run(() => useUiStore.getState().setPayInfoOpen(true))}>
          <HandCoins className="size-4" aria-hidden />
          {t("pay.title")}
        </button>
        <button type="button" className={menuItemClass} onClick={run(() => useUiStore.getState().setLockSettingsOpen(true))}>
          <LockKeyhole className="size-4" aria-hidden />
          {t("lock.settingsTitle")}
        </button>
        <button type="button" className={menuItemClass} onClick={run(() => useUiStore.getState().setBackupOpen(true))}>
          <DatabaseBackup className="size-4" aria-hidden />
          {t("backup.title")}
        </button>
        {studio && (
          <>
            <button type="button" className={menuItemClass} onClick={run(() => useEditorStore.getState().setTemplatesOpen(true))}>
              <LayoutTemplate className="size-4" aria-hidden />
              {t("settings.templates")}
            </button>
            <button type="button" className={menuItemClass} onClick={run(() => useEditorStore.getState().setShortcutsOpen(true))}>
              <Keyboard className="size-4" aria-hidden />
              {t("settings.shortcuts")}
            </button>
            <button type="button" className={menuItemClass} onClick={run(() => useEditorStore.getState().setTourStep(0))}>
              <Sparkles className="size-4" aria-hidden />
              {t("settings.tour")}
            </button>
          </>
        )}
      </div>
    </>
  );
}
