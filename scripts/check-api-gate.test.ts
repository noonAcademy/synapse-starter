import express from 'express';
import { describe, expect, it } from 'vitest';
import { createWorkspaceGate } from '../server/access-gate.js';
import { buildApp } from '../server/index.js';
import { checkApp, concretePath, piiFields, sourceProblems } from './check-api-gate.js';

const KEY = 'unit-test-key'.repeat(4);
const gate = () => createWorkspaceGate({ workspaceKey: KEY, trustLocalCalls: false });

describe('checkApp', () => {
  it('passes the real app in both modes', async () => {
    const workspace = buildApp({
      isReplitDeployment: false,
      workspaceKey: KEY,
      trustLocalCalls: false,
    });
    expect(await checkApp('workspace', workspace, [])).toEqual([]);
    const deployment = buildApp({ isReplitDeployment: true, authDeps: null });
    expect(await checkApp('deployment', deployment, [])).toEqual([]);
  });

  it('fails a route registered before the gate, and says the anonymous call reached it', async () => {
    const app = express();
    app.get('/api/early', (_req, res) => {
      res.json({ ok: true });
    });
    app.use(gate());
    const problems = (await checkApp('workspace', app, [])).map((p) => p.problem);
    expect(problems.some((p) => p.includes('not the first middleware'))).toBe(true);
    expect(problems.some((p) => p.includes('anonymous GET /api/early reached'))).toBe(true);
  });

  it('fails a data route outside /api/', async () => {
    const app = express();
    app.use(gate());
    app.post('/report', (_req, res) => {
      res.json({});
    });
    const problems = (await checkApp('workspace', app, [])).map((p) => p.problem);
    expect(problems.some((p) => p.includes('outside /api/'))).toBe(true);
  });

  it('checks routes inside a mounted router', async () => {
    const app = express();
    const router = express.Router();
    router.get('/people', (_req, res) => {
      res.json([]);
    });
    app.use('/api/v2', router);
    app.use(gate());
    const problems = (await checkApp('workspace', app, [])).map((p) => p.problem);
    expect(problems.some((p) => p.includes('GET /api/v2/people reached'))).toBe(true);
  });

  it('fails a public route that returns personal data, and one with no reason', async () => {
    const app = express();
    app.use(
      createWorkspaceGate({
        workspaceKey: KEY,
        trustLocalCalls: false,
        publicRoutes: [{ method: 'GET', path: '/api/staff', reason: 'demo' }],
      }),
    );
    app.get('/api/staff', (_req, res) => {
      res.json({ rows: [{ id: 1, fullName: 'A', contact: { email: 'a@b.c' } }] });
    });
    const problems = (
      await checkApp('workspace', app, [
        { method: 'GET', path: '/api/staff', reason: 'demo' },
        { method: 'GET', path: '/api/other', reason: ' ' },
      ])
    ).map((p) => p.problem);
    expect(
      problems.some((p) => p.includes('rows[].fullName') && p.includes('rows[].contact.email')),
    ).toBe(true);
    expect(problems.some((p) => p.includes('/api/other has no reason'))).toBe(true);
  });

  it('scans a public GET that shares its route with a private POST', async () => {
    const publicRoutes = [{ method: 'GET' as const, path: '/api/contact', reason: 'demo' }];
    const app = express();
    app.use(createWorkspaceGate({ workspaceKey: KEY, trustLocalCalls: false, publicRoutes }));
    app
      .route('/api/contact')
      .get((_req, res) => {
        res.json({ email: 'x@y.z' });
      })
      .post((_req, res) => {
        res.json({ ok: true });
      });
    const problems = (await checkApp('workspace', app, publicRoutes)).map((p) => p.problem);
    expect(problems.some((p) => p.includes('GET /api/contact') && p.includes('email'))).toBe(true);
  });

  it('reports a private POST that a shared .all() handler would answer', async () => {
    const publicRoutes = [
      { method: 'GET' as const, path: '/api/form', reason: 'demo' },
      { method: 'POST' as const, path: '/api/form', reason: 'demo' },
    ];
    const app = express();
    app.use(createWorkspaceGate({ workspaceKey: KEY, trustLocalCalls: false, publicRoutes }));
    app
      .route('/api/form')
      .all((req, res, next) => {
        if (req.method === 'POST') res.json({ saved: true });
        else next();
      })
      .get((_req, res) => {
        res.json({ ok: true });
      })
      .post((_req, res) => {
        res.json({ ok: true });
      });
    const problems = (await checkApp('workspace', app, publicRoutes.slice(0, 1))).map(
      (p) => p.problem,
    );
    expect(problems.some((p) => p.includes('anonymous POST /api/form reached'))).toBe(true);
    expect(problems.some((p) => p.includes('anonymous GET'))).toBe(false);
  });

  it('reports a private explicit HEAD that a shared .all() handler would answer', async () => {
    const publicRoutes = [
      { method: 'GET' as const, path: '/api/ping', reason: 'demo' },
      { method: 'HEAD' as const, path: '/api/ping', reason: 'demo' },
    ];
    const app = express();
    app.use(createWorkspaceGate({ workspaceKey: KEY, trustLocalCalls: false, publicRoutes }));
    app
      .route('/api/ping')
      .all((req, res, next) => {
        if (req.method === 'HEAD') res.end();
        else next();
      })
      .get((_req, res) => {
        res.json({ ok: true });
      })
      .head((_req, res) => {
        res.end();
      });
    const problems = (await checkApp('workspace', app, publicRoutes.slice(0, 1))).map(
      (p) => p.problem,
    );
    expect(problems.some((p) => p.includes('anonymous HEAD /api/ping reached'))).toBe(true);
  });

  it('reports a public HEAD entry that runs a private GET handler', async () => {
    const app = express();
    app.use(
      createWorkspaceGate({
        workspaceKey: KEY,
        trustLocalCalls: false,
        publicRoutes: [{ method: 'HEAD', path: '/api/report', reason: 'demo' }],
      }),
    );
    app.get('/api/report', (_req, res) => {
      res.json({ rows: [] });
    });
    const problems = (await checkApp('workspace', app, [])).map((p) => p.problem);
    expect(problems.some((p) => p.includes('anonymous HEAD /api/report reached'))).toBe(true);
  });

  it('does not report a public explicit HEAD next to a private GET', async () => {
    const publicRoutes = [{ method: 'HEAD' as const, path: '/api/report', reason: 'demo' }];
    const app = express();
    app.use(createWorkspaceGate({ workspaceKey: KEY, trustLocalCalls: false, publicRoutes }));
    app
      .route('/api/report')
      .get((_req, res) => {
        res.json({ rows: [] });
      })
      .head((_req, res) => {
        res.end();
      });
    expect(await checkApp('workspace', app, publicRoutes)).toEqual([]);
  });

  it('reports a HEAD route that the gate lets through, though HEAD has no body', async () => {
    const app = express();
    app.use(
      createWorkspaceGate({
        workspaceKey: KEY,
        trustLocalCalls: false,
        publicRoutes: [{ method: 'HEAD', path: '/api/ping', reason: 'demo' }],
      }),
    );
    app.head('/api/ping', (_req, res) => {
      res.end();
    });
    const problems = (await checkApp('workspace', app, [])).map((p) => p.problem);
    expect(problems.some((p) => p.includes('anonymous HEAD /api/ping reached'))).toBe(true);
  });

  it('accepts a public route that returns no personal data', async () => {
    const publicRoutes = [{ method: 'GET' as const, path: '/api/health', reason: 'uptime' }];
    const app = express();
    app.use(createWorkspaceGate({ workspaceKey: KEY, trustLocalCalls: false, publicRoutes }));
    app.get('/api/health', (_req, res) => {
      res.json({ ok: true, count: 3 });
    });
    expect(await checkApp('workspace', app, publicRoutes)).toEqual([]);
  });
});

it('checks a handler mounted with app.use at a data path', async () => {
  const app = express();
  app.use('/api/raw', (_req, res) => {
    res.json({});
  });
  app.use(gate());
  const problems = (await checkApp('workspace', app, [])).map((p) => p.problem);
  expect(problems.some((p) => p.includes('GET /api/raw reached'))).toBe(true);
});

it('never calls a public non-GET route for real (it could publish or write)', async () => {
  const publicRoutes = [
    { method: 'POST' as const, path: '/api/webhook', reason: 'partner webhook' },
  ];
  let called = false;
  const app = express();
  app.use(createWorkspaceGate({ workspaceKey: KEY, trustLocalCalls: false, publicRoutes }));
  app.post('/api/webhook', (_req, res) => {
    called = true;
    res.json({ email: 'x@y.z' });
  });
  expect(await checkApp('workspace', app, publicRoutes)).toEqual([]);
  expect(called).toBe(false);
});

describe('piiFields', () => {
  it('finds snake_case, camelCase and nested names, and ignores ids and counts', () => {
    expect(
      piiFields({
        student_name: 'x',
        nationalId: '1',
        phone_number: '2',
        dob: '3',
        id: 4,
        total: 5,
      }),
    ).toEqual(['student_name', 'nationalId', 'phone_number', 'dob']);
    expect(piiFields([{ campus: { address: 'x' } }])).toEqual(['[].campus.address']);
  });
});

describe('concretePath', () => {
  it('fills params and wildcards', () => {
    expect(concretePath('/api/views/:name')).toBe('/api/views/x');
  });
});

describe('sourceProblems', () => {
  const read = (text: string) => () => text;
  it('flags a second server outside server/index.ts and any WebSocket upgrade handler', () => {
    expect(sourceProblems(['server/extra.ts'], read('const app = express();'))).toHaveLength(1);
    expect(sourceProblems(['server/index.ts'], read('const app = express();'))).toHaveLength(0);
    expect(sourceProblems(['server/index.ts'], read("server.on('upgrade', h)"))).toHaveLength(1);
    expect(sourceProblems(['server/extra.ts'], read('// express() in a comment'))).toHaveLength(0);
    expect(sourceProblems(['server/plans.ts'], read("const status = 'upgrade';"))).toHaveLength(0);
  });
});
