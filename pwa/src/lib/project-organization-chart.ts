export const ORGANIZATION_CHART_CONFIG_KEY = "organization_chart";
export type OrganizationNode = { id: string; label: string; roles: string[]; people: string[] };
export type OrganizationCollaboration = OrganizationNode & { departmentId: string; relationship: string };
export type ProjectOrganizationChartData = {
  version: 1; status: "proposed" | "confirmed"; asOf: string; sourceRef: string; note: string;
  governingBodies: { label: string; person?: string }[];
  departments: OrganizationNode[]; collaborations: OrganizationCollaboration[];
};
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 20 && value.every((s) => typeof s === "string" && s.length <= 240);
}
function node(value: unknown): value is OrganizationNode {
  if (!value || typeof value !== "object") return false;
  const n = value as Record<string, unknown>;
  return typeof n.id === "string" && n.id.length > 0 && typeof n.label === "string" && n.label.length <= 120 && strings(n.roles) && strings(n.people);
}
/** 構造だけを検証する。未登録・未合意の人員や会議体を補完しない。 */
export function parseProjectOrganizationChart(value: unknown): ProjectOrganizationChartData | null {
  if (value === null || value === undefined || value === "") return null;
  const v: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (!v || typeof v !== "object") throw new Error("組織図の登録形式が正しくない");
  const d = v as Record<string, unknown>;
  if (d.version !== 1 || !["proposed", "confirmed"].includes(String(d.status)) ||
      !["asOf", "sourceRef", "note"].every((k) => typeof d[k] === "string") ||
      !Array.isArray(d.governingBodies) || d.governingBodies.length < 1 || d.governingBodies.length > 8 ||
      !d.governingBodies.every((g) => g && typeof g.label === "string" && (g.person === undefined || typeof g.person === "string")) ||
      !Array.isArray(d.departments) || d.departments.length < 1 || d.departments.length > 12 || !d.departments.every(node) ||
      !Array.isArray(d.collaborations) || d.collaborations.length > 30 || !d.collaborations.every((c) => node(c) && typeof (c as OrganizationCollaboration).departmentId === "string" && typeof (c as OrganizationCollaboration).relationship === "string"))
    throw new Error("組織図の登録形式が正しくない");
  const ids = new Set(d.departments.map((n) => n.id));
  if (ids.size !== d.departments.length || !d.collaborations.every((c) => ids.has(c.departmentId))) throw new Error("組織図の接続先が正しくない");
  return d as ProjectOrganizationChartData;
}
