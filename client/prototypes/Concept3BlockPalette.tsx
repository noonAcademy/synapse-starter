// THROWAWAY prototype — Concept 3: "Block palette". The builder adds coarse blocks to a canvas and
// binds each to a view (data) or an event (trigger) in the inspector; the canvas previews with
// sample data. The agent would bake any missing view, wire the events, and generate the real page.
// (Click-to-add stands in for drag-and-drop in this mock.)
import { useState } from 'react';
import { RowsTable } from '../RowsTable';
import { SectionHeading } from '../ui';
import { SAMPLE_COLUMNS, SAMPLE_EVENTS, SAMPLE_ROWS, SAMPLE_VIEWS } from './sampleData';

type BlockType = 'table' | 'stat' | 'button';
interface Block {
  id: number;
  type: BlockType;
  view: string;
  event: string;
  label: string;
}

const PALETTE: { type: BlockType; label: string }[] = [
  { type: 'table', label: 'Table (from a view)' },
  { type: 'stat', label: 'Big number / stat' },
  { type: 'button', label: 'Action button' },
];

export function Concept3BlockPalette() {
  const [blocks, setBlocks] = useState<Block[]>([
    { id: 1, type: 'table', view: 'courses-by-type', event: '', label: '' },
  ]);
  const [nextId, setNextId] = useState(2);
  const [selectedId, setSelectedId] = useState<number | null>(1);
  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  const addBlock = (type: BlockType) => {
    const b: Block = {
      id: nextId,
      type,
      view: type === 'button' ? '' : (SAMPLE_VIEWS[0]?.name ?? ''),
      event: type === 'button' ? (SAMPLE_EVENTS[0] ?? '') : '',
      label: type === 'button' ? 'Nudge' : '',
    };
    setBlocks((arr) => [...arr, b]);
    setNextId((n) => n + 1);
    setSelectedId(b.id);
  };

  const patch = (part: Partial<Block>) =>
    setBlocks((arr) => arr.map((b) => (b.id === selectedId ? { ...b, ...part } : b)));

  return (
    <div className="space-y-4">
      <SectionHeading title="Build a page">
        Drop blocks onto the page and bind each to a view or an event. The agent bakes any missing
        view, wires the events, and generates the real page.
      </SectionHeading>

      <div className="grid gap-3 lg:grid-cols-[12rem_minmax(0,1fr)_14rem]">
        {/* Palette */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400">Blocks</h4>
          {PALETTE.map((p) => (
            <button
              key={p.type}
              type="button"
              onClick={() => addBlock(p.type)}
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
            >
              + {p.label}
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div className="min-w-0 space-y-3 rounded-xl border border-dashed border-slate-300 bg-white/60 p-3">
          {blocks.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-400">
              Add blocks from the left to build your page.
            </p>
          )}
          {blocks.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedId(b.id)}
              className={`block w-full rounded-lg border p-3 text-left ${
                selectedId === b.id
                  ? 'border-indigo-400 ring-1 ring-indigo-200'
                  : 'border-slate-200'
              }`}
            >
              <BlockPreview block={b} />
            </button>
          ))}
        </div>

        {/* Inspector */}
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400">Inspect</h4>
          {!selected ? (
            <p className="text-sm text-slate-400">Select a block.</p>
          ) : selected.type === 'button' ? (
            <label className="block text-sm">
              <span className="text-slate-600">Fires event</span>
              <select
                value={selected.event}
                onChange={(e) => patch({ event: e.target.value })}
                className={SELECT}
              >
                {SAMPLE_EVENTS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className="mt-3 block text-slate-600">Label</span>
              <input
                value={selected.label}
                onChange={(e) => patch({ label: e.target.value })}
                className={SELECT}
              />
            </label>
          ) : (
            <label className="block text-sm">
              <span className="text-slate-600">Bind to view</span>
              <select
                value={selected.view}
                onChange={(e) => patch({ view: e.target.value })}
                className={SELECT}
              >
                {SAMPLE_VIEWS.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

const SELECT = 'mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm';

function viewTitle(name: string): string {
  return SAMPLE_VIEWS.find((v) => v.name === name)?.title ?? 'a view';
}

function BlockPreview({ block }: { block: Block }) {
  if (block.type === 'button') {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white">
          {block.label || 'Button'}
        </span>
        <span className="text-xs text-slate-400">→ fires {block.event || '(no event)'}</span>
      </span>
    );
  }
  if (block.type === 'stat') {
    const total = SAMPLE_ROWS.reduce((sum, r) => sum + Number(r.course_count ?? 0), 0);
    return (
      <div>
        <p className="text-xs text-slate-400">{viewTitle(block.view)}</p>
        <p className="text-2xl font-semibold text-slate-900">{total.toLocaleString()}</p>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-xs text-slate-400">{viewTitle(block.view)}</p>
      <RowsTable columns={SAMPLE_COLUMNS} rows={SAMPLE_ROWS} />
    </div>
  );
}
