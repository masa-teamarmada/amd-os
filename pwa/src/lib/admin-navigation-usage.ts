export type AdminNavigationItem = { label: string; href: string; group: string };
export type AdminPageUsage = { visitCount: number; lastVisitedAt: string | null };
export type AdminNavigationUsage = Record<string, AdminPageUsage>;
export type AdminVisitAggregate = { pathname: string; visit_count: number | string; last_visited_at: string | null };

/** 詳細ページの履歴は最も具体的なメニューへ一度だけ集計する。 */
export function summarizeAdminVisits(rows: AdminVisitAggregate[], paths: readonly string[]): AdminNavigationUsage {
  const result: AdminNavigationUsage = Object.fromEntries(paths.map((path) => [path, { visitCount: 0, lastVisitedAt: null }]));
  const longestFirst = [...paths].sort((a, b) => b.length - a.length);
  for (const row of rows) {
    const path = longestFirst.find((path) => row.pathname === path || row.pathname.startsWith(`${path}/`));
    const count = Number(row.visit_count);
    if (!path || !Number.isSafeInteger(count) || count < 0) continue;
    const entry = result[path];
    entry.visitCount += count;
    const at = row.last_visited_at;
    if (at && Number.isFinite(Date.parse(at)) && (!entry.lastVisitedAt || Date.parse(at) > Date.parse(entry.lastVisitedAt))) entry.lastVisitedAt = at;
  }
  return result;
}

const normalized = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ja").trim();
export function adminNavigationMatches(item: AdminNavigationItem, query: string): boolean {
  const terms = normalized(query).split(/\s+/).filter(Boolean);
  const text = normalized(`${item.label} ${item.group}`);
  return terms.every((term) => text.includes(term));
}

export function rankAdminNavigation(items: readonly AdminNavigationItem[], usage: AdminNavigationUsage, query = "") {
  const selected = items.filter((item) => adminNavigationMatches(item, query));
  const visited = selected.filter((item) => (usage[item.href]?.visitCount ?? 0) > 0).sort((a, b) => {
    const left = usage[a.href], right = usage[b.href];
    return right.visitCount - left.visitCount
      || Date.parse(right.lastVisitedAt ?? "1970-01-01") - Date.parse(left.lastVisitedAt ?? "1970-01-01");
  });
  return { visited, unvisited: selected.filter((item) => (usage[item.href]?.visitCount ?? 0) === 0) };
}
