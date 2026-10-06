export const DEVELOPMENT_ISSUE_GROUPS = [
  { key: "technology", label: "技術開発課題" },
  { key: "business", label: "事業開発課題" },
  { key: "organization", label: "組織開発課題" },
] as const;
export type DevelopmentIssue = { id: string; group: (typeof DEVELOPMENT_ISSUE_GROUPS)[number]["key"]; title: string; current: string; approach: string; owner: string; dueOn: string; status: string };
export type ProjectDevelopmentIssuesData = { version: 1; issues: DevelopmentIssue[]; sourceRef: string };
export function parseDevelopmentIssues(value: unknown): ProjectDevelopmentIssuesData | null {
  if (value == null || value === "") return null;
  let parsed: unknown;
  try { parsed = typeof value === "string" ? JSON.parse(value) : value; } catch { throw new Error("開発課題の登録形式が正しくない"); }
  const data = parsed as ProjectDevelopmentIssuesData;
  if (!data || data.version !== 1 || typeof data.sourceRef !== "string" || !Array.isArray(data.issues) || !data.issues.every(issue => issue && DEVELOPMENT_ISSUE_GROUPS.some(group => group.key === issue.group) && [issue.id, issue.title, issue.current, issue.approach, issue.owner, issue.dueOn, issue.status].every(field => typeof field === "string") && issue.id.trim() && issue.title.trim()) || new Set(data.issues.map(issue => issue.id)).size !== data.issues.length) throw new Error("開発課題の登録形式が正しくない");
  return data;
}
