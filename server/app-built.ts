import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Has the builder built their first page yet? The answer moves the console: until then the
// workspace webview at `/` renders the Synapse console (the onboarding surface); from then on `/`
// is the builder's app and the console lives at `/synapse-starter` (client/useSynapseMode.ts).
//
// Read straight off client/app/pages/, the same way server/setup.ts reads SPEC.md, because both
// signals are things the builder (or their agent) does to the source — there is no flag to forget
// to flip. A page counts as built when EITHER:
//   - home.tsx no longer renders the template's <NotBuiltYet /> placeholder (AGENTS.md: "building
//     the app MEANS replacing this page"), or is gone altogether; or
//   - any other page file sits next to it — anything but the template's home.tsx, the frozen
//     synapse.tsx scaffolding, the index.ts registry, and tests.
// Fails toward "not built": an unreadable directory keeps the console at `/`, which is the state
// every fresh clone starts in and the one with directions to every next step.

export const PLACEHOLDER_MARKER = 'NotBuiltYet';

const TEMPLATE_FILES = new Set(['home.tsx', 'synapse.tsx', 'index.ts']);

export function isAppBuilt(pagesDir: string): boolean {
  let files: string[];
  try {
    files = readdirSync(pagesDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch {
    return false;
  }

  const builderPage = files.some(
    (name) => /\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name) && !TEMPLATE_FILES.has(name),
  );
  if (builderPage) return true;

  try {
    return !readFileSync(join(pagesDir, 'home.tsx'), 'utf8').includes(PLACEHOLDER_MARKER);
  } catch {
    // The directory read but home.tsx is gone: the builder restructured their app's pages.
    return files.length > 0;
  }
}
