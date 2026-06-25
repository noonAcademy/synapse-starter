export function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center text-slate-900">
      <h1 className="text-2xl font-semibold">Synapse starter — running.</h1>
      <p className="max-w-md text-sm text-slate-500">
        Slice 1 publishes one <code className="font-mono">synapse_smoke_test</code> event to staging
        Citadel when the server boots. Check the server logs for the result.
      </p>
    </main>
  );
}
