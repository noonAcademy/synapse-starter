import { useEffect, useState } from 'react';

// Noon-branded sign-in wall for the deployed app. One path in: Google Identity Services returns a
// credential in the browser, which we POST to /auth/callback; the server exchanges it with Citadel
// and sets the session cookie. No email/password, no role picker — just "Sign in with Noon".

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';

// Load the Google Identity Services script once, resolving when it's ready.
function loadGsi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('gsi load failed')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('gsi load failed')), { once: true });
    document.head.appendChild(script);
  });
}

export function LoginScreen() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // The client id is config, not baked into the bundle — fetch it from the server.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { googleClientId?: string | null } | null) => {
        if (!cancelled) {
          setClientId(data?.googleClientId ?? null);
        }
      })
      .catch(() => {
        /* leave clientId null — the config-missing message renders below */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId) {
      return;
    }
    let cancelled = false;

    async function handleCredential(response: GoogleCredentialResponse): Promise<void> {
      if (!response.credential) {
        setError('No credential returned from Google. Please try again.');
        return;
      }
      setPending(true);
      setError(null);
      try {
        const res = await fetch('/auth/callback', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ credential: response.credential }),
        });
        if (res.ok) {
          window.location.assign('/');
          return;
        }
        let message = 'Sign-in failed. Please try again.';
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) {
            message = body.error;
          }
        } catch {
          /* keep the default message */
        }
        setError(message);
      } catch {
        setError('Network error. Please check your connection and try again.');
      } finally {
        setPending(false);
      }
    }

    loadGsi()
      .then(() => {
        if (cancelled) {
          return;
        }
        const id = window.google?.accounts?.id;
        const parent = document.getElementById('gsi-button');
        if (!id || !parent) {
          setError('Could not load Google sign-in. Please refresh.');
          return;
        }
        id.initialize({ client_id: clientId, callback: (r) => void handleCredential(r) });
        id.renderButton(parent, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          width: 280,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load Google sign-in. Please refresh.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-semibold tracking-tight text-slate-900">noon</div>
          <h1 className="mt-4 text-lg font-medium text-slate-900">Sign in with Noon</h1>
          <p className="mt-1 text-sm text-slate-500">
            Use your Noon staff Google account to continue.
          </p>
        </div>

        <div className="flex min-h-[44px] items-center justify-center">
          {clientId ? (
            <div id="gsi-button" aria-busy={pending} />
          ) : (
            <p className="text-center text-sm text-slate-400">Sign-in is not configured yet.</p>
          )}
        </div>

        {/* Inline slot for the 403 "not a Noon staff account", network, and expired-code cases. */}
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
