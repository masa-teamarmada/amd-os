export const COMPANY_INCORPORATION_PLAN_KEY = "company_incorporation_plan";
export type CompanyPlanRow = { label: string; value: string };
export type CompanyIncorporationPlan = {
  version: 1; capitalYen: number; issuedShares: number; dilutedShares: number;
  firstFiscalPeriod: string; organizationRows: CompanyPlanRow[];
  capitalRows: CompanyPlanRow[]; operationRows: CompanyPlanRow[]; sourceRef: string;
};

/** 設立計画は登記値・株式実績へ足さず、設立前の表示にだけ使う。 */
export function parseCompanyIncorporationPlan(value: unknown): CompanyIncorporationPlan | null {
  if (value == null || value === "") return null;
  const fail = () => { throw new Error("会社設立計画の登録形式が正しくない"); };
  let parsed: unknown;
  try { parsed = typeof value === "string" ? JSON.parse(value) : value; } catch { return fail(); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail();
  const data = parsed as Record<string, unknown>;
  const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
  const rows = (v: unknown): CompanyPlanRow[] => {
    if (!Array.isArray(v) || !v.every(row => row && isText(row.label) && isText(row.value))) return fail();
    return v.map(row => ({ label: row.label, value: row.value }));
  };
  if (data.version !== 1 || !isText(data.firstFiscalPeriod) || !isText(data.sourceRef)
    || ![data.capitalYen, data.issuedShares, data.dilutedShares].every(v => typeof v === "number" && Number.isSafeInteger(v) && v > 0)
    || Number(data.dilutedShares) < Number(data.issuedShares)) return fail();
  return { version: 1, capitalYen: data.capitalYen as number, issuedShares: data.issuedShares as number,
    dilutedShares: data.dilutedShares as number, firstFiscalPeriod: data.firstFiscalPeriod,
    organizationRows: rows(data.organizationRows), capitalRows: rows(data.capitalRows),
    operationRows: rows(data.operationRows), sourceRef: data.sourceRef };
}
