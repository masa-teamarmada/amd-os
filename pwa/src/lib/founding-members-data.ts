/**
 * project_founding_members データアクセス層。
 *
 * PJ 創業メンバー (= 創業者 / CEO候補 / 技術創業者 / PI など創業コア) を
 * LLM 抽出した結果。HRL 推定の主要根拠。
 * 仕様: pwa/scripts/migrations/040_project_founding_members.sql
 */

import { createClient } from "@/lib/supabase/client";

export type FoundingMemberRole =
  | "ceo_candidate"
  | "co_founder"
  | "tech_lead"
  | "business_advisor"
  | "investor"
  | "amd_support"
  | "researcher"
  | "partner"
  | "unknown";

export type FoundingMemberCategory =
  | "amd"
  | "university"
  | "vc"
  | "partner_company"
  | "government"
  | "individual"
  | "unknown";

export interface FoundingMemberRow {
  id: string;
  project_id: string;
  person_name: string;
  affiliation: string | null;
  role: FoundingMemberRole;
  role_label_jp: string | null;
  category: FoundingMemberCategory;
  responsibility: string | null;
  contribution: string | null;
  notes: string | null;
  status: "active" | "left" | "tentative" | "invalid";
  extracted_by: "llm" | "manual" | "tsukuyomi";
  source_documents: { type: string; id: string; ymOrDate?: string }[];
  first_observed_at: string | null;
  last_observed_at: string | null;
  updated_at: string;
}

export const ROLE_LABEL_JP: Record<FoundingMemberRole, string> = {
  ceo_candidate: "CEO 候補",
  co_founder: "共同創業者",
  tech_lead: "技術リード",
  business_advisor: "事業アドバイザ",
  investor: "投資家 / VC",
  amd_support: "AMD サポート",
  researcher: "研究者",
  partner: "産業パートナー",
  unknown: "(役割不明)",
};

export const CATEGORY_LABEL_JP: Record<FoundingMemberCategory, string> = {
  amd: "AMD",
  university: "大学・研究機関",
  vc: "VC / ファンド",
  partner_company: "産業パートナー",
  government: "政府・行政",
  individual: "個人",
  unknown: "(所属不明)",
};

export const CATEGORY_COLOR: Record<FoundingMemberCategory, string> = {
  amd: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  university: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  vc: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  partner_company: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  government: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  individual: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  unknown: "bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-500",
};

export async function fetchFoundingMembers(projectId: string): Promise<FoundingMemberRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_founding_members")
    .select(
      "id, project_id, person_name, affiliation, role, role_label_jp, category, responsibility, contribution, notes, status, extracted_by, source_documents, first_observed_at, last_observed_at, updated_at"
    )
    .eq("project_id", projectId)
    .neq("status", "invalid")
    .order("category", { ascending: true })
    .order("role", { ascending: true });
  if (error) {
    console.error("[fetchFoundingMembers]", error);
    return [];
  }
  return (data ?? []) as FoundingMemberRow[];
}

/**
 * HRL (Human Resources Readiness Level) を創業メンバー構成から簡易推定する。
 *
 * 内閣府 SIP HRL 9 段階定義に従う:
 *   0-3: 創業期 1-3 名 (CEO 候補識別段階、役割欠損あり)
 *   4-6: コア機能 (CEO/CTO/事業/投資家) 揃いつつあり、5-10 名規模
 *   7-9: 複数階層・カテゴリ多様性、10+ 名規模
 *
 * Phase 1 簡易版: ルールベース。Phase 3 で LLM 推定または BVAR Bayesian update に置き換え可。
 */
export function estimateHrlFromMembers(rows: FoundingMemberRow[]): {
  hrl: number;
  total: number;
  coreCount: number;
  categories: number;
  rationale: string;
} {
  const active = rows.filter((r) => r.status === "active");
  const total = active.length;
  const hasCeo = active.some((r) => r.role === "ceo_candidate" || r.role === "co_founder");
  const hasTech = active.some((r) => r.role === "tech_lead" || r.role === "researcher");
  const hasBiz = active.some((r) => r.role === "business_advisor" || r.role === "amd_support");
  const hasInvestor = active.some((r) => r.role === "investor");
  const coreCount = [hasCeo, hasTech, hasBiz, hasInvestor].filter(Boolean).length;
  const categories = new Set(active.map((r) => r.category).filter((c) => c !== "unknown")).size;

  let hrl: number;
  if (total === 0) hrl = 0;
  else if (total <= 3) hrl = Math.min(3, 1 + coreCount);
  else if (total <= 9) hrl = 3 + Math.min(3, coreCount);
  else hrl = 5 + Math.min(4, coreCount + Math.max(0, categories - 3));
  hrl = Math.max(0, Math.min(9, hrl));

  const labels = [hasCeo ? "CEO" : null, hasTech ? "技術" : null, hasBiz ? "事業" : null, hasInvestor ? "投資家" : null].filter(
    (x): x is string => Boolean(x)
  );
  const rationale = `${total} 名 / コア役割 ${coreCount}/4 (${labels.join(" + ") || "なし"}) / カテゴリ多様性 ${categories}`;

  return { hrl, total, coreCount, categories, rationale };
}

/** PJ ID から founding member 数のサマリ (HRL 推定の入力データ) */
export async function fetchFoundingMembersSummary(projectId: string): Promise<{
  total: number;
  byCategory: Record<string, number>;
  byRole: Record<string, number>;
  hasAmd: boolean;
  hasUniversity: boolean;
  hasVc: boolean;
  hasCeoCandidate: boolean;
  hasTechLead: boolean;
}> {
  const rows = await fetchFoundingMembers(projectId);
  const byCategory: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  for (const r of rows) {
    if (r.status !== "active") continue;
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    byRole[r.role] = (byRole[r.role] ?? 0) + 1;
  }
  return {
    total: rows.filter((r) => r.status === "active").length,
    byCategory,
    byRole,
    hasAmd: (byCategory["amd"] ?? 0) > 0,
    hasUniversity: (byCategory["university"] ?? 0) > 0,
    hasVc: (byCategory["vc"] ?? 0) > 0,
    hasCeoCandidate: (byRole["ceo_candidate"] ?? 0) > 0 || (byRole["co_founder"] ?? 0) > 0,
    hasTechLead: (byRole["tech_lead"] ?? 0) > 0 || (byRole["researcher"] ?? 0) > 0,
  };
}
