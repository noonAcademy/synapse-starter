// `npm run check:api` (in `verify`, so it runs before every deployment): proves that no route
// answers an anonymous caller, unless it is on the public list (server/public-routes.ts), and that
// no public route returns fields that look like personal data.
//
// What it does:
//   1. Builds the real app (buildApp) in both modes, deployment and workspace.
//   2. Checks that the access gate is the first middleware, so nothing is registered before it.
//   3. Replaces every route handler with a stub (except public GET routes), then calls every route
//      anonymously, as Replit's proxy would deliver it, in lower and upper case. A stub that answers
//      means an anonymous caller reached the route. The stubs mean no real handler runs (no Athena
//      read, no event, no verify run).
//   4. Calls each public GET route for real, anonymously, and fails when its JSON has a field whose
//      name looks like personal data (name, email, phone, national ID, address, date of birth, …).
//      Public routes with other methods (a webhook) are never called for real, because a call could
//      write or publish; their responses are not scanned.
//   5. Fails on a route outside /api/ and /__synapse/ (data routes live under /api/), and on a
//      second server or a WebSocket upgrade handler in server/, because those skip the gate.
//
// Limits: it sees the routes that exist when buildApp runs, with `x` for every `:param`; a public
// route that returns personal data only for some inputs, or under a field name not on the list,
// passes; it says nothing about what a signed-in staff member may see (server/access.ts does).
// It is a tripwire, not a proof.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import type { Application, RequestHandler } from 'express';

export interface ApiGateProblem {
  mode: string;
  problem: string;
}

interface ExpressLayer {
  name: string;
  handle: RequestHandler & { stack?: ExpressLayer[] };
  method?: string;
  regexp?: RegExp;
  route?: { path: string; methods: Record<string, boolean>; stack: ExpressLayer[] };
}

export interface RouteInfo {
  method: string;
  path: string;
  layer: ExpressLayer;
  // The method as Express stores it on the route (`get`, `_all`); undefined for app.use handlers.
  routeMethod?: string;
}

const BUILT_IN_LAYERS = new Set(['query', 'expressInit']);
export const GATE_NAME = 'synapseAccessGate';
const REACHED = '__synapseCheckReached';
// A HEAD response has no body, so the stub also marks its reply with this header.
const REACHED_HEADER = 'x-synapse-check-reached';

function stackOf(app: Application): ExpressLayer[] {
  const router = (app as unknown as { _router?: { stack: ExpressLayer[] } })._router;
  return router?.stack ?? [];
}

// Express 4 keeps a mounted router's path only as a regular expression; this reads the common
// shape (`^\/api\/?(?=\/|$)`). Anything else is reported, so the check never skips a router quietly.
function mountPath(layer: ExpressLayer): string | null {
  const source = layer.regexp?.source ?? '';
  if (source === '^\\/?(?=\\/|$)') return '';
  const match = source.match(/^\^((?:\\\/[\w.-]+)+)\\\/\?\(\?=\\\/\|\$\)$/);
  return match?.[1] ? match[1].replace(/\\\//g, '/') : null;
}

export function listRoutes(
  stack: ExpressLayer[],
  prefix = '',
  problems: string[] = [],
): RouteInfo[] {
  const routes: RouteInfo[] = [];
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        // `app.all()` is stored as `_all`; GET exercises it.
        const verb = method === '_all' ? 'GET' : method.toUpperCase();
        routes.push({ method: verb, path: prefix + layer.route.path, layer, routeMethod: method });
      }
    } else if (layer.name === 'router' && layer.handle.stack) {
      const mount = mountPath(layer);
      if (mount === null) {
        problems.push(
          `cannot read the mount path of a router (${layer.regexp}); mount it at a plain path`,
        );
        continue;
      }
      routes.push(...listRoutes(layer.handle.stack, prefix + mount, problems));
    } else if (!BUILT_IN_LAYERS.has(layer.name) && layer.name !== GATE_NAME) {
      // `app.use('/api/x', handler)`: a handler mounted at a path answers like a route. A
      // middleware mounted at the root (express.json(), logging) is left alone.
      const mount = mountPath(layer);
      if (mount) routes.push({ method: 'GET', path: prefix + mount, layer });
    }
  }
  return routes;
}

export function gateProblems(app: Application): string[] {
  const own = stackOf(app).filter((layer) => !BUILT_IN_LAYERS.has(layer.name));
  const first = own[0];
  if (!first || first.name !== GATE_NAME) {
    const what = first?.route ? `the route ${first.route.path}` : `"${first?.name ?? 'nothing'}"`;
    return [
      `the access gate is not the first middleware (first is ${what}); call installAccessGate straight after express()`,
    ];
  }
  return [];
}

function stubRoutes(routes: RouteInfo[]): void {
  const stub: RequestHandler = (_req, res) => {
    res.setHeader(REACHED_HEADER, '1');
    res.json({ [REACHED]: true });
  };
  // One app.route(path) chain keeps every method's handlers in one stack, so the stubbing is per
  // method: a public GET on the same path still runs for real.
  const stubbedMethods = new Map<ExpressLayer, Set<string>>();
  for (const { layer, routeMethod } of routes) {
    if (!layer.route) {
      layer.handle = stub;
      continue;
    }
    const methods = stubbedMethods.get(layer) ?? new Set<string>();
    methods.add(routeMethod ?? '_all');
    stubbedMethods.set(layer, methods);
  }
  for (const [layer, methods] of stubbedMethods) {
    for (const handler of layer.route?.stack ?? []) {
      if (handler.method === undefined) {
        if (methods.has('_all')) {
          handler.handle = stub;
          continue;
        }
        // A shared .all() handler: real for the public method, the stub for a private one, so a
        // private request is marked before the shared handler can answer it or write.
        const shared = handler.handle;
        handler.handle = (req, res, next) => {
          // Express answers HEAD with the GET handlers only when the route has no HEAD handler.
          const headAsGet = req.method === 'HEAD' && !layer.route?.methods.head;
          const method = headAsGet ? 'get' : req.method.toLowerCase();
          if (methods.has(method)) stub(req, res, next);
          else shared(req, res, next);
        };
      } else if (methods.has(handler.method)) {
        handler.handle = stub;
      }
    }
  }
}

export function concretePath(path: string): string {
  return path.replace(/:\w+\??/g, 'x').replace(/\*/g, 'x');
}

const PII_NAME =
  /^(?:(?:first|last|full|middle|family|given|display|user|student|parent|guardian|teacher)_?name|name|e_?mail(?:_?address)?|phone(?:_?number)?|mobile(?:_?number)?|msisdn|whats_?app|national_?id|nid|iqama(?:_?number)?|passport(?:_?number)?|(?:home_?|street_?|postal_?)?address|street|dob|date_?of_?birth|birth_?date|birthday)$/i;

export function piiFields(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => piiFields(item, `${path}[]`));
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const here = path ? `${path}.${key}` : key;
    return [
      ...(PII_NAME.test(key.replace(/([a-z])([A-Z])/g, '$1_$2')) ? [here] : []),
      ...piiFields(child, here),
    ];
  });
}

interface Reply {
  status: number;
  body: string;
  reached: boolean;
}

function call(port: number, method: string, path: string): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        // A fresh socket per call: a kept-alive one can point at a closed server on a reused port.
        agent: false,
        method,
        path,
        headers: {
          host: 'synapse-check.replit.dev',
          'x-forwarded-for': '203.0.113.7',
          'content-type': 'application/json',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body,
            reached: res.headers[REACHED_HEADER] === '1' || body.includes(REACHED),
          }),
        );
      },
    );
    req.on('error', reject);
    req.end(method === 'GET' || method === 'HEAD' ? undefined : '{}');
  });
}

export interface PublicRouteLike {
  method: string;
  path: string;
  reason: string;
}

export async function checkApp(
  mode: string,
  app: Application,
  publicRoutes: PublicRouteLike[],
): Promise<ApiGateProblem[]> {
  const problems: string[] = [...gateProblems(app)];
  const routes = listRoutes(stackOf(app), '', problems);
  const isPublic = (route: RouteInfo) =>
    publicRoutes.some(
      (p) => p.method === route.method && p.path.toLowerCase() === route.path.toLowerCase(),
    );
  for (const p of publicRoutes) {
    if (!p.reason?.trim()) problems.push(`public route ${p.method} ${p.path} has no reason`);
  }
  const callForReal = (route: RouteInfo) => isPublic(route) && route.method === 'GET';
  stubRoutes(routes.filter((route) => !callForReal(route)));

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  try {
    for (const route of routes) {
      const lower = route.path.toLowerCase();
      if (!(lower.startsWith('/api/') || lower === '/api' || lower.startsWith('/__synapse/'))) {
        problems.push(
          `${route.method} ${route.path} is outside /api/ — data routes go under /api/ so the gate can protect them`,
        );
      }
      const path = concretePath(route.path);
      if (isPublic(route) && !callForReal(route)) continue;
      if (callForReal(route)) {
        const reply = await call(port, route.method, path);
        let json: unknown = null;
        try {
          json = JSON.parse(reply.body);
        } catch {
          // Not JSON: nothing to scan.
        }
        const fields = piiFields(json);
        if (fields.length > 0) {
          problems.push(
            `public route ${route.method} ${route.path} returns fields that look like personal data (${fields.join(', ')}); remove them or take the route off PUBLIC_ROUTES`,
          );
        }
        continue;
      }
      // Express answers HEAD with the GET handler, so a private GET is also probed with HEAD.
      const methods = route.method === 'GET' ? ['GET', 'HEAD'] : [route.method];
      for (const method of methods) {
        for (const variant of [path, path.toUpperCase()]) {
          const reply = await call(port, method, variant);
          if (reply.reached) {
            problems.push(
              `an anonymous ${method} ${variant} reached its handler (status ${reply.status})`,
            );
          }
        }
      }
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  return problems.map((problem) => ({ mode, problem }));
}

const SECOND_SERVER = /\bexpress\(\)|\.listen\(|\bcreateServer\(/;
const UPGRADE_HANDLER = /WebSocketServer|socket\.io|\.on\(\s*['"]upgrade['"]/;

function serverFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return serverFiles(full);
    return full.endsWith('.ts') && !full.endsWith('.test.ts') ? [full] : [];
  });
}

export function sourceProblems(
  files: string[],
  read = (f: string) => readFileSync(f, 'utf8'),
): ApiGateProblem[] {
  const problems: ApiGateProblem[] = [];
  for (const file of files) {
    read(file)
      .split('\n')
      .forEach((line, index) => {
        const code = line.replace(/\/\/.*$/, '');
        const where = `${file}:${index + 1}`;
        if (UPGRADE_HANDLER.test(code)) {
          problems.push({
            mode: 'source',
            problem: `${where} handles WebSocket upgrades, which skip the access gate; check the session in the upgrade handler and ask the Synapse team`,
          });
        } else if (SECOND_SERVER.test(code) && !file.endsWith(join('server', 'index.ts'))) {
          problems.push({
            mode: 'source',
            problem: `${where} starts a second server or app, which is not behind the access gate; add routes in buildApp (server/index.ts) instead`,
          });
        }
      });
  }
  return problems;
}

async function main(): Promise<void> {
  process.env.SYNAPSE_SKIP_MAIN = '1';
  const { buildApp } = await import('../server/index.js');
  const { buildEndUserAuthDeps } = await import('../server/auth-routes.js');
  const { PUBLIC_ROUTES } = await import('../server/public-routes.js');
  const authDeps = buildEndUserAuthDeps({
    baseUrl: 'https://citadel.invalid',
    appId: 'check-app',
    appSecret: 'check-app-secret',
    redirectUri: 'https://synapse-check.invalid/oauth/callback',
    sessionSecret: 'check-session-secret',
    secure: true,
  });
  const problems = [
    ...(await checkApp(
      'deployment',
      buildApp({ isReplitDeployment: true, authDeps }),
      PUBLIC_ROUTES,
    )),
    ...(await checkApp(
      'workspace',
      buildApp({
        isReplitDeployment: false,
        workspaceKey: 'check-key'.repeat(4),
        trustLocalCalls: false,
      }),
      PUBLIC_ROUTES,
    )),
    ...sourceProblems(serverFiles('server')),
  ];
  if (problems.length === 0) {
    console.log(
      `[check-api-gate] every route is behind the access gate; ${PUBLIC_ROUTES.length} public route(s), none returns personal data — OK.`,
    );
    return;
  }
  console.error(
    `[check-api-gate] ${problems.length} problem(s). Every /api route needs a Noon session (deployment)\n` +
      "or the builder's key (workspace). A route open to anyone must be listed in server/public-routes.ts\n" +
      'with a reason, and must not return personal data. See the synapse-access-control skill.\n',
  );
  for (const p of problems) console.error(`  ✗ [${p.mode}] ${p.problem}`);
  process.exit(1);
}

if (process.env.VITEST === undefined) {
  void main();
}
