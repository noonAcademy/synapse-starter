import { useI18n } from '../brand/i18n';
import { NoonLogo } from '../brand/NoonLogo';
import { LanguageSwitch, ThemeToggle } from '../brand/Toggles';

// Noon-branded sign-in wall for the deployed app. One path in: the button is a plain navigation to
// /auth/login, which redirects to Citadel's authorize page and back through /oauth/callback. No
// third-party script, no XHR — failures come back as ?error=<code> on this page's URL.
// Styled by the theme.css tokens like every app component.

// The server only ever redirects here with one of these fixed codes; anything else (or a
// hand-edited query) gets the generic message.
const ERROR_KEYS = {
  not_staff: 'signInNotStaff',
  state: 'signInExpired',
  failed: 'signInFailed',
} as const;

function errorKey(): (typeof ERROR_KEYS)[keyof typeof ERROR_KEYS] | null {
  const code = new URLSearchParams(window.location.search).get('error');
  if (!code) {
    return null;
  }
  // Object.hasOwn: `?error=__proto__` must not reach Object.prototype.
  return Object.hasOwn(ERROR_KEYS, code)
    ? ERROR_KEYS[code as keyof typeof ERROR_KEYS]
    : 'signInFailed';
}

export function LoginScreen() {
  const { t } = useI18n();
  const error = errorKey();

  return (
    <div className="flex min-h-screen flex-col bg-surface px-gutter font-app">
      <div className="flex justify-end gap-2 py-4">
        <LanguageSwitch />
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center pb-16">
        <div className="w-full max-w-sm rounded-card border border-line bg-card p-8 shadow-card">
          <div className="mb-6 text-center">
            <NoonLogo className="mx-auto h-8" />
            <h1 className="mt-4 text-lg font-medium text-ink">{t('signInTitle')}</h1>
            <p className="mt-1 text-body text-ink-muted">{t('signInHint')}</p>
          </div>

          <a
            href="/auth/login"
            className="flex min-h-[44px] w-full items-center justify-center rounded-control bg-primary px-4 text-body font-medium text-on-primary hover:bg-primary-strong"
          >
            {t('signInButton')}
          </a>

          {/* Inline slot for the not_staff / expired-state / generic failure codes. */}
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-control bg-danger-surface px-3 py-2 text-body text-danger"
            >
              {t(error)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
