import { useEffect, useState } from 'react';

// Small shared loader for the workspace JSON endpoints. Tabs render off one of three
// states, so the loading / error / empty branches stay consistent across the console.
export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

export function useJson<T>(url: string): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`request failed (${res.status})`);
        }
        return res.json() as Promise<T>;
      })
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'ready', data });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'failed to load',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
