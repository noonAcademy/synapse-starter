// Registry of baked reads, keyed by query name. Adding a read = adding a
// server/queries/<name>.sql.ts file and registering it here; the read route and the Read
// tab pick it up automatically.

import * as coursesByType from './courses-by-type.sql.js';

export interface BakedQuery {
  name: string;
  title: string;
  description: string;
  sql: string;
  registryVersion: string;
  skillVersion: string;
}

function toBakedQuery(m: typeof coursesByType): BakedQuery {
  return {
    name: m.name,
    title: m.title,
    description: m.description,
    sql: m.sql,
    registryVersion: m.registryVersion,
    skillVersion: m.skillVersion,
  };
}

// Null-prototype map so a request for an inherited key (e.g. `__proto__`) resolves to
// undefined instead of Object.prototype — otherwise getBakedQuery would treat it as a hit.
export const BAKED_QUERIES: Record<string, BakedQuery> = Object.assign(Object.create(null), {
  [coursesByType.name]: toBakedQuery(coursesByType),
});

export function getBakedQuery(name: string): BakedQuery | null {
  return BAKED_QUERIES[name] ?? null;
}

export function listBakedQueries(): BakedQuery[] {
  return Object.values(BAKED_QUERIES);
}
