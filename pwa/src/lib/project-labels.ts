export interface ProjectLabelSource {
  project_name?: string | null;
  client_name?: string | null;
  news_search_query?: string | null;
}

function cleanText(value: string | null | undefined): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function splitAliasCandidate(value: string): string[] {
  return value
    .split(/\s+OR\s+|\|/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function extractNewsSearchAliases(query: string | null | undefined): string[] {
  const raw = cleanText(query);
  if (!raw) return [];
  const quoted = Array.from(raw.matchAll(/"([^"]+)"/g)).flatMap((match) => splitAliasCandidate(match[1] || ""));
  const candidates = quoted.length > 0 ? quoted : splitAliasCandidate(raw);
  return Array.from(new Set(candidates.map((value) => value.trim()).filter(Boolean)));
}

export function getPrimaryProjectAlias(source: ProjectLabelSource): string | null {
  return (
    extractNewsSearchAliases(source.news_search_query)[0] ??
    cleanText(source.project_name) ??
    cleanText(source.client_name)
  );
}

export function getProjectSearchAliases(
  source: ProjectLabelSource,
  extras: Array<string | null | undefined> = []
): string[] {
  const values = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const text = cleanText(raw);
    if (text) values.add(text);
  };
  add(source.project_name);
  add(source.client_name);
  for (const alias of extractNewsSearchAliases(source.news_search_query)) add(alias);
  for (const extra of extras) add(extra);
  return Array.from(values);
}
