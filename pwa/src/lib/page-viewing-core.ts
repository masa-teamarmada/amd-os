import { COCKPIT_TAB_FORMATS, WORKSPACE_TAB_FORMATS, PROJECT_PAGE_LABELS, DD_ITEM_PAGES, DD_TAB_FORMAT, projectFormatTypeOf } from "./project-formats.ts";

export const PAGE_VIEWING_REFRESH_MS = 10_000;
export const PAGE_VIEWING_EXPIRY_MS = 30_000;
export type PageViewingInput = { pathname: string; pageLabel: string };
export type PageViewer = { key: string; label: string; self: boolean };
export type PageVisit = { id: string; label: string; self: boolean; startedAt: string; lastSeenAt: string };
export type PageViewingSnapshot = { title: string; viewers: PageViewer[]; history?: PageVisit[]; ownHistoryOnly: boolean; truncated: boolean };

export function parsePageViewingInput(value: unknown): PageViewingInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  // Never persist raw URLs, search parameters, signatures or fragments.
  if (typeof input.pathname !== "string" || input.pathname.length > 240 || !/^\/(?:[a-zA-Z0-9_-]+\/?)*$/.test(input.pathname)) return null;
  if (typeof input.pageLabel !== "string" || input.pageLabel.length > 80) return null;
  return { pathname: input.pathname.replace(/\/$/, "") || "/", pageLabel: input.pageLabel };
}

const EXTRA_LABELS: Record<string, string> = { "organization-chart": "組織図", "employee-register": "従業員名簿", "cost-fuel": "コスト試算" };
export function allowedProjectPageLabel(surface: "cockpit" | "workspace" | "dd", label: string, project: { projectId: string; projectCategory?: string | null }, external = false): string | null {
  const type = projectFormatTypeOf(project);
  const keys: readonly string[] = surface === "dd"
    ? [...DD_ITEM_PAGES.map(p => p.key), ...DD_TAB_FORMAT.flatMap(g => g.tabs)]
    : (surface === "cockpit" ? COCKPIT_TAB_FORMATS[type] : WORKSPACE_TAB_FORMATS[type]).flatMap(g => g.tabs);
  const externalKeys = new Set(["issues", "tasks", "gantt", "meetings", "slack", "partners", "drive", "technology", "competition", "business-model", "business-plan", "development-issues", "financial-projection", "capital-plan", "cost", "cost-fuel", "ip", "capital-policy", "company", "organization-chart", "employee-register", "contracts"]);
  const labels = keys.filter(k => !external || surface !== "workspace" || externalKeys.has(k)).map(k => surface === "dd"
    ? DD_ITEM_PAGES.find(p => p.key === k)?.label ?? PROJECT_PAGE_LABELS[k] ?? EXTRA_LABELS[k]
    : PROJECT_PAGE_LABELS[k] ?? EXTRA_LABELS[k]);
  return labels.includes(label) ? label : null;
}

export function deduplicatePageViewers(rows: Array<{ actor_key: string; actor_label: string }>, selfKey: string): PageViewer[] {
  const byActor = new Map<string, PageViewer>();
  for (const row of rows) if (!byActor.has(row.actor_key)) byActor.set(row.actor_key, { key: row.actor_key, label: row.actor_label, self: row.actor_key === selfKey });
  return [...byActor.values()].sort((a, b) => Number(b.self) - Number(a.self) || a.label.localeCompare(b.label, "ja"));
}
