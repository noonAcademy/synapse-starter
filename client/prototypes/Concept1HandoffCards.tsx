// THROWAWAY prototype — Concept 1: "Hand-off cards". The baseline. The builder describes a page +
// two toggles (reads data? fires event?), and we generate the exact paste-to-agent instruction via
// the real buildPagePrompt. Nothing new to persist; the agent writes all the code.
import { type ReactNode, useState } from 'react';
import { buildPagePrompt } from '../pagePrompt';
import { Button, Card, CopyBox, SectionHeading } from '../ui';
import { SAMPLE_EVENTS } from './sampleData';

export function Concept1HandoffCards() {
  const [pageWant, setPageWant] = useState('');
  const [readsNeeded, setReadsNeeded] = useState(true);
  const [dataWant, setDataWant] = useState('');
  const [eventNeeded, setEventNeeded] = useState(false);
  const [eventWant, setEventWant] = useState('');
  const [reuseEventType, setReuseEventType] = useState('');

  const prompt = pageWant.trim()
    ? buildPagePrompt({
        pageWant,
        readsNeeded,
        dataWant,
        eventNeeded,
        eventWant,
        reuseEventType: reuseEventType || undefined,
      })
    : '';

  return (
    <div className="max-w-3xl space-y-5">
      <SectionHeading title="Add a page">
        Describe the page or feature. We write the exact instruction for the Replit agent —
        including the read it needs and any event it should send.
      </SectionHeading>

      <Card>
        <Field label="What's the page or feature?">
          <textarea
            value={pageWant}
            onChange={(e) => setPageWant(e.target.value)}
            rows={2}
            placeholder="e.g. homework completion per class, with a Nudge button for students who are behind"
            className={INPUT}
          />
        </Field>

        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <Toggle
            checked={readsNeeded}
            onChange={setReadsNeeded}
            label="This page shows Noon data"
          />
          {readsNeeded && (
            <textarea
              value={dataWant}
              onChange={(e) => setDataWant(e.target.value)}
              rows={2}
              placeholder="What data? (optional — defaults to the page description)"
              className={INPUT}
            />
          )}
        </div>

        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <Toggle
            checked={eventNeeded}
            onChange={setEventNeeded}
            label="This page triggers something Noon should know about"
          />
          {eventNeeded && (
            <div className="space-y-2">
              <textarea
                value={eventWant}
                onChange={(e) => setEventWant(e.target.value)}
                rows={2}
                placeholder="What happens? e.g. a teacher nudges a student who's behind"
                className={INPUT}
              />
              <label className="block text-xs text-slate-500">
                Is it like one of these? (optional)
                <select
                  value={reuseEventType}
                  onChange={(e) => setReuseEventType(e.target.value)}
                  className="mt-1 block w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                >
                  <option value="">Let the agent decide</option>
                  {SAMPLE_EVENTS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
      </Card>

      {prompt ? (
        <Card className="border-indigo-200 bg-indigo-50/50">
          <h3 className="text-sm font-semibold text-indigo-900">
            Your instruction — paste it to the Replit agent
          </h3>
          <div className="mt-2">
            <CopyBox text={prompt} wrap />
          </div>
        </Card>
      ) : (
        <Button disabled>Write the instruction for the builder</Button>
      )}
    </div>
  );
}

const INPUT =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-indigo-600"
      />
      {label}
    </label>
  );
}
