// buildPagePrompt — the agent hand-off for adding a whole page/feature (not just "data I want to
// see"). It evolves GetDataTab's buildRequestPrompt into modular, independently-omittable blocks so
// the two Synapse needs are both first-class and conditional, matching the rule: a READ if the page
// shows Noon data, a declared+published EVENT if the page triggers something. The generated string
// is copy-pasted into the Replit agent, and it quotes AGENTS.md faithfully.
//
// Invariants (asserted in tests):
// - Reads stay DESCRIBE-ONLY — the console never names/guesses a table (no backticked identifier);
//   the agent's SQL skill picks it from the registry.
// - Events stay CATALOG-ANCHORED — reuse a built-in if one fits, else declareEvent + publishEvent.

export interface PagePromptInput {
  pageWant: string;
  readsNeeded: boolean;
  dataWant?: string;
  eventNeeded: boolean;
  eventWant?: string;
  // An advisory catalog pick, e.g. 'task.created'. The agent still makes the final reuse-vs-declare
  // call — this is only a candidate.
  reuseEventType?: string;
}

export function buildPagePrompt(input: PagePromptInput): string {
  const page = input.pageWant.trim() || '(describe the page or feature you want)';
  const blocks: string[] = [`Build me a page/feature: ${page}`];

  if (input.readsNeeded) {
    const show = input.dataWant?.trim() || page;
    blocks.push(
      [
        'DATA THIS PAGE READS (Noon data):',
        `Show: ${show}.`,
        'Follow AGENTS.md — use the SQL skill to pick the right Noon table from the registry, bake ' +
          'it as a read in server/queries run through synapse.athenaQuery (app-wide, no raw fetch, ' +
          'no per-user scope), and register it so it shows under my views. Bind this page to that read.',
      ].join('\n'),
    );
  }

  if (input.eventNeeded) {
    const when = input.eventWant?.trim() || '(describe what happens)';
    const reuse = input.reuseEventType?.trim();
    const reuseLine = reuse
      ? `First try to reuse a catalogued built-in event; "${reuse}" looks closest, so use it if it genuinely fits.`
      : 'First try to reuse a catalogued built-in event if one genuinely fits.';
    blocks.push(
      [
        'WHAT THIS PAGE TRIGGERS (an event Noon should know about):',
        `When: ${when}.`,
        `Follow AGENTS.md — ${reuseLine} If none fits, declare your own with ` +
          'synapse.declareEvent(type, { description, examplePayload }) — a lowercase-dotted, ' +
          'past-tense name, and a flat examplePayload that references Noon entities by ID, never ' +
          'whole records. Handle the result (created / suggested / blocked), then publish it with ' +
          'synapse.publishEvent(type, payload) when it happens.',
      ].join('\n'),
    );
  }

  blocks.push('Then add this page under "Your views."');

  return blocks.join('\n\n');
}
