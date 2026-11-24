import { useSyncExternalStore } from 'react';

// Light/dark and English/Arabic for the shipped app. SYNAPSE-OWNED (client/brand/**).
// Both choices live in this browser's localStorage, so they survive reloads and apply on the
// login screen too (before anyone is signed in). The inline script in scripts/vite-brand.ts
// applies the same keys before the first paint, so a dark or Arabic page never flashes light or
// left-to-right on load. Keep the two in step.

export type ThemeChoice = 'light' | 'dark' | 'system';
export type Language = 'en' | 'ar';

export const THEME_KEY = 'noon.theme';
export const LANGUAGE_KEY = 'noon.lang';
// The app's default language is the `lang` on <html> in client/index.html ("ar" for an
// Arabic-first app). The head script keeps it in data-default-lang before applying a stored choice.
export function defaultLanguage(): Language {
  if (typeof document === 'undefined') return 'en';
  const html = document.documentElement;
  const initial = html.dataset.defaultLang ?? html.getAttribute('lang') ?? 'en';
  return initial.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

// Kept in memory too: where the browser blocks storage, the choice still works until a reload.
const memory = new Map<string, string | null>();

function readStorage(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  memory.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked or full: the in-memory value above still applies.
  }
}

// Visible for tests: localStorage.clear() does not reset the in-memory copy.
export function forgetPreferenceMemory(): void {
  memory.clear();
}

const listeners = new Set<() => void>();
function notify(): void {
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function systemTheme(): 'light' | 'dark' {
  return systemIsDark() ? 'dark' : 'light';
}

function systemIsDark(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

export function themeChoice(): ThemeChoice {
  const stored = readStorage(THEME_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

export function resolvedTheme(choice = themeChoice()): 'light' | 'dark' {
  if (choice === 'system') return systemIsDark() ? 'dark' : 'light';
  return choice;
}

// The workspace console keeps <html> English, left-to-right and light; once it pins the document,
// the app's choices (and the system/other-tab listeners) leave <html> alone.
let pinned = false;
export function pinDocument(): void {
  pinned = true;
}

export function applyTheme(): void {
  if (pinned) return;
  document.documentElement.dataset.theme = resolvedTheme();
}

export function setThemeChoice(choice: ThemeChoice): void {
  writeStorage(THEME_KEY, choice === 'system' ? null : choice);
  applyTheme();
  notify();
}

// `<html data-fixed-lang>` marks a one-language app: a choice stored while the switch existed
// must not keep the page in the other language.
function languageIsFixed(): boolean {
  return (
    typeof document !== 'undefined' && document.documentElement.hasAttribute('data-fixed-lang')
  );
}

export function language(): Language {
  if (languageIsFixed()) return defaultLanguage();
  const stored = readStorage(LANGUAGE_KEY);
  return stored === 'ar' || stored === 'en' ? stored : defaultLanguage();
}

export function directionOf(lang: Language): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

export function applyLanguage(): void {
  if (pinned) return;
  const lang = language();
  document.documentElement.lang = lang;
  document.documentElement.dir = directionOf(lang);
}

export function setLanguage(lang: Language): void {
  writeStorage(LANGUAGE_KEY, lang);
  applyLanguage();
  notify();
}

let listenersInstalled = false;

// Call once at start-up: applies both choices, follows the system theme while on 'system', and
// follows a choice made in another tab of the same app.
export function installPreferences(): void {
  applyTheme();
  applyLanguage();
  if (listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = true;
  window.addEventListener('storage', (event) => {
    // A null key means another tab cleared all of storage.
    if (event.key === null) {
      memory.delete(THEME_KEY);
      memory.delete(LANGUAGE_KEY);
    } else if (event.key === THEME_KEY || event.key === LANGUAGE_KEY) {
      memory.delete(event.key);
    } else {
      return;
    }
    applyTheme();
    applyLanguage();
    notify();
  });
  if (typeof window.matchMedia !== 'function') return;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = () => {
    if (themeChoice() === 'system') {
      applyTheme();
      notify();
    }
  };
  // Safari before 14 has only the older addListener.
  if (typeof media.addEventListener === 'function')
    media.addEventListener('change', onSystemChange);
  else media.addListener(onSystemChange);
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, themeChoice, () => 'system');
}

export function useResolvedTheme(): 'light' | 'dark' {
  return useSyncExternalStore(
    subscribe,
    () => resolvedTheme(),
    () => 'light',
  );
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, language, () => 'en' as Language);
}
