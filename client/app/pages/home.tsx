// The app's landing page — what the people who use your app see at `/`.
//
// Convention (mirrors server/queries/<name>.sql.ts): each client/app/pages/<name>.tsx exports a
// route `path`, a `title`, whether it shows in the app `nav`, and a `Page` component. Register it
// in ./index.ts and the app shell picks it up automatically.
//
// ── THIS WHOLE FILE IS A PLACEHOLDER ──────────────────────────────────────────────────────────
// It intentionally renders only <NotBuiltYet /> below. There is no runtime SPEC check: by
// convention (AGENTS.md rules 1–2), nothing is built while SPEC.md is unfilled — so building the
// app MEANS replacing this page. When the spec is approved and you build the real home page,
// delete <NotBuiltYet /> and write the product here. It's the builder's app, not Synapse's.
// ──────────────────────────────────────────────────────────────────────────────────────────────

import { useI18n } from '../../brand/i18n';

export const path = '/';

export const title = 'Home';

export const nav = true;

export function Page() {
  return <NotBuiltYet />;
}

// The pre-build empty state. Safe to delete wholesale along with the <NotBuiltYet /> call above.
function NotBuiltYet() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-md space-y-stack py-stack text-center">
      <div className="space-y-2">
        <h2 className="text-title font-semibold tracking-tight text-ink">{t('notBuiltTitle')}</h2>
        <p className="text-body leading-relaxed text-ink-muted">{t('notBuiltIntro')}</p>
      </div>

      <ol className="space-y-3 text-start text-body text-ink">
        <li className="flex gap-3 rounded-card border border-line bg-card p-card">
          <span className="font-semibold text-accent">1</span>
          <span>{t('notBuiltStep1')}</span>
        </li>
        <li className="flex gap-3 rounded-card border border-line bg-card p-card">
          <span className="font-semibold text-accent">2</span>
          <span>{t('notBuiltStep2')}</span>
        </li>
      </ol>
    </div>
  );
}
