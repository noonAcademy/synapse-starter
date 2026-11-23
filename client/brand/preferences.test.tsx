// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatNumber, formatRelative, translate } from './i18n';
import {
  installPreferences,
  LANGUAGE_KEY,
  language,
  setLanguage,
  setThemeChoice,
  THEME_KEY,
  themeChoice,
} from './preferences';
import { STARTER_STRINGS } from './strings';
import { LanguageSwitch, ThemeToggle } from './Toggles';

const html = document.documentElement;

beforeEach(() => {
  window.localStorage.clear();
  html.removeAttribute('lang');
  html.removeAttribute('dir');
  delete html.dataset.theme;
  delete html.dataset.defaultLang;
});

afterEach(() => {
  window.localStorage.clear();
});

describe('language', () => {
  it('defaults to the lang on <html>, so an Arabic-first app starts in Arabic', () => {
    html.setAttribute('lang', 'ar');
    expect(language()).toBe('ar');
    html.setAttribute('lang', 'en');
    expect(language()).toBe('en');
  });

  it('ignores a stored choice in a one-language app (<html data-fixed-lang>)', () => {
    setLanguage('ar');
    html.setAttribute('lang', 'en');
    html.setAttribute('data-fixed-lang', '');
    expect(language()).toBe('en');
    html.removeAttribute('data-fixed-lang');
  });

  it('applies dir and lang to <html> and remembers the choice', () => {
    setLanguage('ar');
    expect(html.dir).toBe('rtl');
    expect(html.lang).toBe('ar');
    expect(window.localStorage.getItem(LANGUAGE_KEY)).toBe('ar');
    setLanguage('en');
    expect(html.dir).toBe('ltr');
  });

  it('switches with the header button', () => {
    installPreferences();
    render(<LanguageSwitch />);
    fireEvent.click(screen.getByRole('button', { name: 'العربية' }));
    expect(html.dir).toBe('rtl');
    expect(screen.getByRole('button', { name: 'English' })).toBeTruthy();
  });
});

describe('blocked storage', () => {
  it('still switches when localStorage throws', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('blocked');
    };
    try {
      setThemeChoice('dark');
      expect(html.dataset.theme).toBe('dark');
      setLanguage('ar');
      expect(html.dir).toBe('rtl');
    } finally {
      Storage.prototype.setItem = original;
      setThemeChoice('system');
      setLanguage('en');
    }
  });
});

describe('theme', () => {
  it('follows the system until the person chooses, then remembers the choice', () => {
    expect(themeChoice()).toBe('system');
    installPreferences();
    expect(html.dataset.theme).toBe('light');
    setThemeChoice('dark');
    expect(html.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
    setThemeChoice('system');
    expect(window.localStorage.getItem(THEME_KEY)).toBeNull();
  });

  it('toggles with the header button', () => {
    installPreferences();
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(html.dataset.theme).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeTruthy();
  });
});

describe('translate', () => {
  const strings = {
    en: { hi: 'Hello {name}', only: 'English only' },
    ar: { hi: 'مرحبًا {name}', only: '' },
  };

  it('fills parameters and falls back to English for a missing Arabic string', () => {
    expect(translate(strings, 'ar', 'hi', { name: 'Lina' })).toBe('مرحبًا Lina');
    expect(translate(strings, 'ar', 'only')).toBe('English only');
  });

  it('has an Arabic string for every starter string', () => {
    for (const key of Object.keys(STARTER_STRINGS.en)) {
      expect(STARTER_STRINGS.ar[key as keyof typeof STARTER_STRINGS.ar], key).toBeTruthy();
    }
  });

  it('says how long ago, never a future time', () => {
    const now = Date.parse('2026-11-23T12:00:00Z');
    expect(formatRelative('2026-11-23T09:00:00Z', 'en', now)).toBe('3 hours ago');
    expect(formatRelative('2026-11-23T12:03:00Z', 'en', now)).toBe('just now');
    expect(formatRelative('2026-11-23T09:00:00Z', 'ar', now)).toMatch(/3/);
  });

  it('formats numbers with Western digits in Arabic', () => {
    expect(formatNumber(1240, 'ar')).toMatch(/1.?240/);
  });
});
