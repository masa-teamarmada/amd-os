import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

// AMD全体の累計資金調達額 + 累計助成金額 (営業アピール用ダッシュボード数字)。
// 会社の全ラウンド/全助成金をリストしつつ、累計には AMD 貢献として明示された金額だけを入れる。
// cap table の持株比率・投資家別内訳は返さない (機密保持)。read はログイン済みメンバーに開放。
// 設計: pwa/design/governance_action_items.md

const SECURED = ["adopted", "active", "completed"];
const CONTRIBUTION_STATUSES = ["full", "partial", "none", "unreviewed"] as const;

type ContributionStatus = (typeof CONTRIBUTION_STATUSES)[number];
type FundingKind = "funding" | "grant";
type ProjectRow = { project_id: string; project_name: string | null };
type VentureRow = { project_id: string; display_name: string | null; short_label: string | null };
type FundingRoundRow = {
  id: string;
  project_id: string;
  round_name: string | null;
  round_date: string | null;
  round_ym: string | null;
  raised_yen: number | null;
  status: string | null;
  security_type: string | null;
  amd_contribution_status: string | null;
  amd_contributed_yen: number | null;
  amd_contribution_note: string | null;
};
type GrantRow = {
  id: string;
  project_id: string;
  grant_name: string;
  agency: string | null;
  grant_type: string | null;
  amount_yen: number | null;
  status: string | null;
  adopted_date: string | null;
  period_start_ym: string | null;
  period_end_ym: string | null;
  amd_contribution_status: string | null;
  amd_contributed_yen: number | null;
  amd_contribution_note: string | null;
};
type FundingItem = {
  id: string;
  kind: FundingKind;
  projectId: string;
  companyName: string;
  projectName: string;
  label: string;
  date: string | null;
  status: string | null;
  amountYen: number;
  amdContributedYen: number;
  contributionStatus: ContributionStatus;
  contributionNote: string | null;
  eligibleForTotal: boolean;
  meta: string | null;
};
type CompanyGroup = {
  projectId: string;
  companyName: string;
  projectName: string;
  registeredYen: number;
  amdContributedYen: number;
  itemCount: number;
  contributedItemCount: number;
  items: FundingItem[];
};

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  const db = createAdminClient();
  const [roundsRes, grantsRes, projectsRes, venturesRes] = await Promise.all([
    db
      .from("project_valuation_rounds")
      .select("id, project_id, round_name, round_date, round_ym, raised_yen, status, security_type, amd_contribution_status, amd_contributed_yen, amd_contribution_note"),
    db
      .from("project_grants")
      .select("id, project_id, grant_name, agency, grant_type, amount_yen, status, adopted_date, period_start_ym, period_end_ym, amd_contribution_status, amd_contributed_yen, amd_contribution_note"),
    db.from("projects").select("project_id, project_name"),
    db.from("project_ventures").select("project_id, display_name, short_label"),
  ]);

  if (roundsRes.error || grantsRes.error || projectsRes.error || venturesRes.error) {
    return NextResponse.json({
      ok: false,
      error: roundsRes.error?.message || grantsRes.error?.message || projectsRes.error?.message || venturesRes.error?.message,
    }, { status: 500 });
  }

  const nameOf: Record<string, string> = {};
  const projectNameOf: Record<string, string> = {};
  ((projectsRes.data ?? []) as ProjectRow[]).forEach((p) => {
    projectNameOf[p.project_id] = p.project_name || p.project_id;
    nameOf[p.project_id] = p.project_name || p.project_id;
  });
  ((venturesRes.data ?? []) as VentureRow[]).forEach((v) => {
    nameOf[v.project_id] = v.display_name || v.short_label || nameOf[v.project_id] || v.project_id;
  });

  const fundingItems = ((roundsRes.data ?? []) as FundingRoundRow[])
    .map((r) => buildFundingItem(r, nameOf, projectNameOf))
    .sort(compareItems);
  const grantItems = ((grantsRes.data ?? []) as GrantRow[])
    .map((g) => buildGrantItem(g, nameOf, projectNameOf))
    .sort(compareItems);

  const fundingCompanies = groupByCompany(fundingItems);
  const grantCompanies = groupByCompany(grantItems);

  const total = (items: FundingItem[], key: "amountYen" | "amdContributedYen") =>
    items.filter((item) => item.eligibleForTotal).reduce((sum, item) => sum + item[key], 0);
  const contributedCount = (items: FundingItem[]) =>
    items.filter((item) => item.eligibleForTotal && item.amdContributedYen > 0).length;
  const companyBreakdown = (groups: CompanyGroup[]) =>
    groups
      .map((group) => ({
        projectId: group.projectId,
        name: group.companyName,
        amountYen: group.amdContributedYen,
        registeredYen: group.registeredYen,
        itemCount: group.itemCount,
        contributedItemCount: group.contributedItemCount,
      }))
      .sort((a, b) => b.amountYen - a.amountYen || b.registeredYen - a.registeredYen);

  return NextResponse.json({
    ok: true,
    funding: {
      totalRaisedYen: total(fundingItems, "amdContributedYen"),
      totalRegisteredYen: total(fundingItems, "amountYen"),
      roundCount: fundingItems.length,
      contributedRoundCount: contributedCount(fundingItems),
      fundedPjCount: fundingCompanies.filter((group) => group.amdContributedYen > 0).length,
      companyCount: fundingCompanies.length,
      breakdown: companyBreakdown(fundingCompanies),
      companies: fundingCompanies,
    },
    grants: {
      totalSecuredYen: total(grantItems, "amdContributedYen"),
      totalRegisteredYen: total(grantItems, "amountYen"),
      securedCount: grantItems.filter((item) => item.eligibleForTotal).length,
      contributedGrantCount: contributedCount(grantItems),
      grantPjCount: grantCompanies.filter((group) => group.amdContributedYen > 0).length,
      companyCount: grantCompanies.length,
      breakdown: companyBreakdown(grantCompanies),
      companies: grantCompanies,
    },
  });
}

function buildFundingItem(row: FundingRoundRow, nameOf: Record<string, string>, projectNameOf: Record<string, string>): FundingItem {
  const amountYen = positiveYen(row.raised_yen);
  const contributionStatus = normalizeContributionStatus(row.amd_contribution_status);
  const eligibleForTotal = row.status !== "planned" && amountYen > 0;
  return {
    id: row.id,
    kind: "funding",
    projectId: row.project_id,
    companyName: nameOf[row.project_id] || row.project_id,
    projectName: projectNameOf[row.project_id] || row.project_id,
    label: row.round_name || "ラウンド",
    date: row.round_date || ymToDate(row.round_ym),
    status: row.status,
    amountYen,
    amdContributedYen: eligibleForTotal ? contributionAmount(amountYen, contributionStatus, row.amd_contributed_yen) : 0,
    contributionStatus,
    contributionNote: row.amd_contribution_note,
    eligibleForTotal,
    meta: row.security_type,
  };
}

function buildGrantItem(row: GrantRow, nameOf: Record<string, string>, projectNameOf: Record<string, string>): FundingItem {
  const amountYen = positiveYen(row.amount_yen);
  const contributionStatus = normalizeContributionStatus(row.amd_contribution_status);
  const eligibleForTotal = SECURED.includes(row.status || "") && amountYen > 0;
  return {
    id: row.id,
    kind: "grant",
    projectId: row.project_id,
    companyName: nameOf[row.project_id] || row.project_id,
    projectName: projectNameOf[row.project_id] || row.project_id,
    label: row.grant_name || "助成金・補助金",
    date: row.adopted_date || ymToDate(row.period_start_ym),
    status: row.status,
    amountYen,
    amdContributedYen: eligibleForTotal ? contributionAmount(amountYen, contributionStatus, row.amd_contributed_yen) : 0,
    contributionStatus,
    contributionNote: row.amd_contribution_note,
    eligibleForTotal,
    meta: [row.agency, row.grant_type].filter(Boolean).join(" / ") || null,
  };
}

function groupByCompany(items: FundingItem[]): CompanyGroup[] {
  const map = new Map<string, CompanyGroup>();
  for (const item of items) {
    const group = map.get(item.projectId) || {
      projectId: item.projectId,
      companyName: item.companyName,
      projectName: item.projectName,
      registeredYen: 0,
      amdContributedYen: 0,
      itemCount: 0,
      contributedItemCount: 0,
      items: [],
    };
    if (item.eligibleForTotal) {
      group.registeredYen += item.amountYen;
      group.amdContributedYen += item.amdContributedYen;
      if (item.amdContributedYen > 0) group.contributedItemCount += 1;
    }
    group.itemCount += 1;
    group.items.push(item);
    map.set(item.projectId, group);
  }
  return [...map.values()].sort((a, b) => b.amdContributedYen - a.amdContributedYen || b.registeredYen - a.registeredYen);
}

function normalizeContributionStatus(raw: string | null | undefined): ContributionStatus {
  return CONTRIBUTION_STATUSES.includes(raw as ContributionStatus) ? raw as ContributionStatus : "unreviewed";
}

function contributionAmount(amountYen: number, status: ContributionStatus, rawContributedYen: number | null | undefined) {
  const explicit = positiveYen(rawContributedYen);
  if (status === "full") return explicit > 0 ? Math.min(explicit, amountYen) : amountYen;
  if (status === "partial") return Math.min(explicit, amountYen);
  return 0;
}

function positiveYen(value: number | null | undefined) {
  const n = Number(value) || 0;
  return n > 0 ? Math.round(n) : 0;
}

function ymToDate(ym: string | null | undefined) {
  if (!ym || !/^\d{6}$/.test(ym)) return null;
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`;
}

function compareItems(a: FundingItem, b: FundingItem) {
  const dateA = a.date || "";
  const dateB = b.date || "";
  if (dateA !== dateB) return dateA < dateB ? 1 : -1;
  return b.amountYen - a.amountYen;
}
