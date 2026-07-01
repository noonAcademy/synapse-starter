// THROWAWAY — a dev-only gallery to compare the three compose-in-console directions before
// committing to one. Reached via `?prototype` (see main.tsx). NOT part of the shipped app or the
// console; delete client/prototypes/ once a direction is chosen.
import { useState } from 'react';
import { Concept1HandoffCards } from './Concept1HandoffCards';
import { Concept2PageManifest } from './Concept2PageManifest';
import { Concept3BlockPalette } from './Concept3BlockPalette';

const CONCEPTS = [
  { id: '1', label: '1 · Hand-off cards', render: () => <Concept1HandoffCards /> },
  { id: '2', label: '2 · Page manifest', render: () => <Concept2PageManifest /> },
  { id: '3', label: '3 · Block palette', render: () => <Concept3BlockPalette /> },
] as const;

export function PrototypeGallery() {
  const [active, setActive] = useState<string>('1');
  const current = CONCEPTS.find((c) => c.id === active) ?? CONCEPTS[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-800">
        Prototype gallery — for comparing compose-in-console directions. Not shipped; delete once a
        direction is chosen.
      </div>

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <h1 className="text-lg font-semibold">“My app” — compose directions</h1>
          <p className="text-sm text-slate-500">
            Same two Synapse needs in each: a read if the page shows data, a declared + published
            event if it triggers something. Only how much you assemble changes.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <nav className="flex gap-1 border-b border-slate-200" aria-label="Prototype concepts">
          {CONCEPTS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActive(c.id)}
              aria-current={active === c.id ? 'page' : undefined}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                active === c.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {c.label}
            </button>
          ))}
        </nav>

        <main className="py-6">{current.render()}</main>
      </div>
    </div>
  );
}
