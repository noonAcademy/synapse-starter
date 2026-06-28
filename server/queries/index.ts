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

export const BAKED_QUERIES: Record<string, BakedQuery> = {
  [coursesByType.name]: toBakedQuery(coursesByType),
};

export function getBakedQuery(name: string): BakedQuery | null {
  return BAKED_QUERIES[name] ?? null;
}

export function listBakedQueries(): BakedQuery[] {
  return Object.values(BAKED_QUERIES);
}
