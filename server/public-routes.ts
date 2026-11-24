// Routes that anyone on the internet may call without signing in. SHARED with the builder.
//
// Every /api route needs a Noon session in a deployment, and the builder's workspace key in the
// workspace (server/access-gate.ts). This list is the only way out of that rule. Add a route here
// only when it must work for someone who is not signed in (a health check for an uptime monitor,
// a webhook from another service), and say why in `reason`. Never return personal data from a
// public route: `npm run check:api` calls each one anonymously and fails when its JSON has fields
// such as name, email, phone, national ID, address or date of birth.
//
// Paths match exactly (no `:params`, no prefixes), ignoring letter case.
//
//   export const PUBLIC_ROUTES: PublicRoute[] = [
//     { method: 'GET', path: '/api/health', reason: 'Uptime monitor; returns { ok: true } only.' },
//   ];

export interface PublicRoute {
  method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  reason: string;
}

export const PUBLIC_ROUTES: PublicRoute[] = [];
