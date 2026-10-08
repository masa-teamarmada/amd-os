export type AccessRequestScope = { kind: "institution" | "project" | "dd" | "project_dd"; id: string };
export type AccessRequestScopeChoice = { value: string; label: string };
export const ACCESS_REQUEST_SCOPE_BLOCK = "workspace_access_destination";
export const ACCESS_REQUEST_SCOPE_ACTION = "workspace_access_scope";

export function parseAccessRequestScope(value: unknown): AccessRequestScope | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(institution|project|dd|project_dd):([A-Za-z0-9_-]{1,80})$/);
  if (!match) return null;
  const kind = match[1] as AccessRequestScope["kind"];
  if ((kind === "dd" || kind === "project_dd") && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match[2])) return null;
  return { kind, id: match[2] };
}

export function accessRequestScopeChoices(data: {
  institutionWorkspaces: { slug: string; name: string; status: string }[];
  projects: { project_id: string; project_name: string }[];
  ddPackages: { id: string; title: string; project_id: string; status: string }[];
}): AccessRequestScopeChoice[] {
  const projects = new Map(data.projects.map(p => [p.project_id, p.project_name]));
  return [
    ...data.ddPackages.filter(p => p.status === "open" && projects.has(p.project_id)).map(p => ({ value: `project_dd:${p.id}`, label: `${projects.get(p.project_id)} ワークスペース＋${p.title}（DD）` })),
    ...data.projects.map(p => ({ value: `project:${p.project_id}`, label: `${p.project_name} ワークスペース` })),
    ...data.ddPackages.filter(p => p.status === "open").map(p => ({ value: `dd:${p.id}`, label: `${p.title}（DDのみ）` })),
    ...data.institutionWorkspaces.filter(w => w.status === "active").map(w => ({ value: `institution:${w.slug}`, label: `${w.name} 機関ワークスペース` })),
  ];
}

// Selection is read from this request's named block, never from a different form field.
export function selectedAccessRequestScope(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const values = (state as { values?: Record<string, Record<string, { selected_option?: { value?: unknown } | null }>> }).values;
  const value = values?.[ACCESS_REQUEST_SCOPE_BLOCK]?.[ACCESS_REQUEST_SCOPE_ACTION]?.selected_option?.value;
  return parseAccessRequestScope(value) ? String(value) : null;
}
