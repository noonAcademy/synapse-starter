// THROWAWAY prototype — Concept 2: "Page manifest". The builder fills a structured spec (sections
// bound to views, actions bound to events); the right pane shows the crisp instruction it compiles
// to (via buildPagePrompt). The agent still writes every line of code — from a form, not free prose.
import { type ReactNode, useState } from 'react';
import { buildPagePrompt } from '../pagePrompt';
import { Button, Card, CopyBox, SectionHeading } from '../ui';
import { SAMPLE_EVENTS, SAMPLE_VIEWS } from './sampleData';

interface Section {
  kind: 'table' | 'stat' | 'chart';
  dataDescription: string;
  boundView: string;
}
interface Action {
  label: string;
  eventWant: string;
  reuseType: string;
}

export function Concept2PageManifest() {
  const [title, setTitle] = useState('Homework health');
  const [route, setRoute] = useState('/homework');
  const [sections, setSections] = useState<Section[]>([
    {
      kind: 'table',
      dataDescription: 'completion this week, per class',
      boundView: 'courses-by-type',
    },
  ]);
  const [actions, setActions] = useState<Action[]>([]);

  const prompt = buildPagePrompt({
    pageWant: `${title} (route ${route})`,
    readsNeeded: sections.length > 0,
    dataWant: sections.map((s) => `${s.kind}: ${s.dataDescription}`).join('; '),
    eventNeeded: actions.length > 0,
    eventWant: actions.map((a) => `"${a.label}" — ${a.eventWant}`).join('; '),
    reuseEventType: actions.find((a) => a.reuseType)?.reuseType || undefined,
  });

  return (
    <div className="space-y-4">
      <SectionHeading title="New page">
        Lay out the page as a structured brief. The agent turns it into a real page — one read per
        data section, one event per action.
      </SectionHeading>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: the form */}
        <Card>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Route</span>
              <input value={route} onChange={(e) => setRoute(e.target.value)} className={INPUT} />
            </label>
          </div>

          <Group
            title="Sections"
            onAdd={() =>
              setSections((s) => [...s, { kind: 'table', dataDescription: '', boundView: '' }])
            }
          >
            {sections.map((s, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: throwaway prototype, rows never reorder
              <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-2.5">
                <div className="flex gap-2">
                  <select
                    value={s.kind}
                    onChange={(e) =>
                      patch(setSections, i, { kind: e.target.value as Section['kind'] })
                    }
                    className={SELECT}
                  >
                    <option value="table">Table</option>
                    <option value="stat">Stat</option>
                    <option value="chart">Chart</option>
                  </select>
                  <select
                    value={s.boundView}
                    onChange={(e) => patch(setSections, i, { boundView: e.target.value })}
                    className={SELECT}
                  >
                    <option value="">bind a view…</option>
                    {SAMPLE_VIEWS.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.title}
                      </option>
                    ))}
                  </select>
                  <RemoveBtn onClick={() => setSections((arr) => arr.filter((_, j) => j !== i))} />
                </div>
                <input
                  value={s.dataDescription}
                  onChange={(e) => patch(setSections, i, { dataDescription: e.target.value })}
                  placeholder="what data should it show?"
                  className={INPUT}
                />
              </div>
            ))}
          </Group>

          <Group
            title="Actions"
            onAdd={() => setActions((a) => [...a, { label: '', eventWant: '', reuseType: '' }])}
          >
            {actions.map((a, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: throwaway prototype, rows never reorder
              <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-2.5">
                <div className="flex gap-2">
                  <input
                    value={a.label}
                    onChange={(e) => patch(setActions, i, { label: e.target.value })}
                    placeholder="button label, e.g. Nudge"
                    className={INPUT}
                  />
                  <select
                    value={a.reuseType}
                    onChange={(e) => patch(setActions, i, { reuseType: e.target.value })}
                    className={SELECT}
                  >
                    <option value="">event: agent decides</option>
                    {SAMPLE_EVENTS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <RemoveBtn onClick={() => setActions((arr) => arr.filter((_, j) => j !== i))} />
                </div>
                <input
                  value={a.eventWant}
                  onChange={(e) => patch(setActions, i, { eventWant: e.target.value })}
                  placeholder="what happens when it's clicked?"
                  className={INPUT}
                />
              </div>
            ))}
          </Group>
        </Card>

        {/* Right: the compiled instruction */}
        <Card className="border-indigo-200 bg-indigo-50/50">
          <h3 className="text-sm font-semibold text-indigo-900">Instruction for the agent</h3>
          <p className="mt-1 text-xs text-indigo-800/80">
            Compiled live from the brief on the left — copy-paste into the Replit agent.
          </p>
          <div className="mt-2">
            <CopyBox text={prompt} wrap />
          </div>
        </Card>
      </div>
    </div>
  );
}

function patch<T>(setter: (fn: (a: T[]) => T[]) => void, i: number, part: Partial<T>) {
  setter((arr) => arr.map((item, j) => (j === i ? { ...item, ...part } : item)));
}

const INPUT =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none';
const SELECT = 'rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-800';

function Group({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-slate-700">{title}</h4>
        <Button onClick={onAdd} className="px-2 py-1 text-xs">
          + Add
        </Button>
      </div>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove"
      className="shrink-0 rounded-lg border border-slate-200 px-2 text-sm text-slate-400 hover:text-rose-600"
    >
      ×
    </button>
  );
}
