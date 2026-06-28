// Read-only projection of the event-type catalog the SDK is built against, so builders can
// SEE which events already exist before publishing. The catalog ships as TypeScript types
// plus a runtime list of type names (SYNAPSE_EVENT_TYPES) — payload field shapes are types
// only and erased at runtime, so this view lists the type names grouped by namespace.
//
// NOTE: this is a *view*, not declaration. Today, a genuinely new event type still has to be
// catalogued in noon-citadel and the SDK republished; self-service declaration is a later
// slice (see README).

export interface CatalogGroup {
  namespace: string; // dotted prefix, e.g. "task" / "sanad_ticket"; "(core)" for unprefixed
  eventTypes: string[];
}

export interface EventCatalog {
  total: number;
  groups: CatalogGroup[];
}

export function buildCatalog(eventTypes: readonly string[]): EventCatalog {
  const groups = new Map<string, string[]>();
  for (const type of eventTypes) {
    const dot = type.indexOf('.');
    const namespace = dot === -1 ? '(core)' : type.slice(0, dot);
    const list = groups.get(namespace) ?? [];
    list.push(type);
    groups.set(namespace, list);
  }

  return {
    total: eventTypes.length,
    groups: [...groups.entries()]
      .map(([namespace, types]) => ({ namespace, eventTypes: [...types].sort() }))
      .sort((a, b) => a.namespace.localeCompare(b.namespace)),
  };
}
