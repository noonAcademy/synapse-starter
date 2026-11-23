import { useI18n } from './i18n';
import { setThemeChoice, useResolvedTheme } from './preferences';

// Header controls for the shipped app: light/dark and English/Arabic. SYNAPSE-OWNED.
// Both remember the choice in this browser (client/brand/preferences.ts).

const CONTROL =
  'inline-flex h-11 min-w-11 items-center justify-center rounded-control border border-line px-2 text-body font-medium text-ink-muted transition-colors hover:text-ink';

export function ThemeToggle() {
  const theme = useResolvedTheme();
  const { t } = useI18n();
  const next = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? t('themeToDark') : t('themeToLight');
  return (
    <button
      type="button"
      onClick={() => setThemeChoice(next)}
      aria-label={label}
      title={label}
      className={CONTROL}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

export function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      title={t('languageSwitchTitle')}
      lang={lang === 'ar' ? 'en' : 'ar'}
      className={CONTROL}
    >
      {t('languageSwitch')}
    </button>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
