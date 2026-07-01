// The app's landing page — what the people who use your app see at `/`.
//
// Convention (mirrors server/queries/<name>.sql.ts): each client/app/pages/<name>.tsx exports a
// route `path`, a `title`, whether it shows in the app `nav`, and a `Page` component. Register it
// in ./index.ts and the app shell picks it up automatically. Rename/rewrite this freely — it's
// your product, not the builder console.

import { ViewBlock } from '../blocks/ViewBlock';

export const path = '/';

export const title = 'Home';

export const nav = true;

export function Page() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Welcome to your app
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">
          This is the app you're building on live Noon data. The pages you add show up here for the
          people who use it.
        </p>
      </div>

      {/* Starter content: one registered view, rendered live. Compose more <ViewBlock name="…" />s
          or add pages under client/app/pages/ — ask the Replit agent, and they appear here. */}
      <ViewBlock name="courses-by-type" />
    </div>
  );
}
