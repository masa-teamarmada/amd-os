import { createClient } from "@supabase/supabase-js";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import type {
  PocCompany,
  PocCompanyListItem,
  PocCompanyStatus,
  PocHubData,
  PocMatch,
  PocMatchListItem,
  PocMatchStatus,
  PocMemberRef,
  PocPriority,
  PocProjectRef,
  PocSeedRef,
} from "@/types/poc";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder",
);

function getAuthClient() {
  return createBrowserSupabase();
}

export async function fetchPocHub(): Promise<PocHubData> {
  const [companiesRes, matchesRes, seedsRes, projectsRes, membersRes] = await Promise.all([
    supabase.from("poc_companies").select("*").order("updated_at", { ascending: false }),
    supabase.from("poc_matches").select("*").order("updated_at", { ascending: false }),
    supabase
      .from("seeds")
      .select("id,title,org_name,domain_lane,industry_target,status,amd_rating,updated_at")
      .order("updated_at", { ascending: false })
      .limit(400),
    supabase
      .from("projects")
      .select("project_id,project_name,status,project_category")
      .order("project_id", { ascending: true }),
    supabase.from("members").select("member_id,code_name").order("code_name", { ascending: true }),
  ]);

  throwFirstError([companiesRes.error, matchesRes.error, seedsRes.error, projectsRes.error, membersRes.error]);

  const companies = (companiesRes.data ?? []) as PocCompany[];
  const matches = (matchesRes.data ?? []) as PocMatch[];
  const seeds = (seedsRes.data ?? []) as PocSeedRef[];
  const projects = (projectsRes.data ?? []) as PocProjectRef[];
  const members = (membersRes.data ?? []) as PocMemberRef[];

  const companyById = new Map(companies.map((company) => [company.id, company]));
  const seedById = new Map(seeds.map((seed) => [seed.id, seed]));
  const projectById = new Map(projects.map((project) => [project.project_id, project]));
  const memberById = new Map(members.map((member) => [member.member_id, member.code_name]));

  const matchCountByCompany = new Map<string, number>();
  const activeMatchCountByCompany = new Map<string, number>();
  for (const match of matches) {
    if (!match.company_id) continue;
    matchCountByCompany.set(match.company_id, (matchCountByCompany.get(match.company_id) ?? 0) + 1);
    if (match.status !== "deal" && match.status !== "archived") {
      activeMatchCountByCompany.set(match.company_id, (activeMatchCountByCompany.get(match.company_id) ?? 0) + 1);
    }
  }

  const companyItems: PocCompanyListItem[] = companies.map((company) => ({
    ...company,
    owner_code_name: company.owner_member_id ? (memberById.get(company.owner_member_id) ?? null) : null,
    match_count: matchCountByCompany.get(company.id) ?? 0,
    active_match_count: activeMatchCountByCompany.get(company.id) ?? 0,
  }));

  const matchItems: PocMatchListItem[] = matches.map((match) => ({
    ...match,
    seed: match.seed_id ? (seedById.get(match.seed_id) ?? null) : null,
    company: match.company_id ? (companyById.get(match.company_id) ?? null) : null,
    project: match.project_id ? (projectById.get(match.project_id) ?? null) : null,
    owner_code_name: match.owner_member_id ? (memberById.get(match.owner_member_id) ?? null) : null,
  }));

  return {
    companies: companyItems,
    matches: matchItems,
    seeds,
    projects,
    members,
  };
}

export async function insertPocCompany(
  payload: Partial<PocCompany> & { company_name: string },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const client = getAuthClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("poc_companies")
    .insert({ ...payload, updated_at: now })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string }).id };
}

export async function updatePocCompany(
  id: string,
  patch: Partial<PocCompany>,
): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("poc_companies")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function insertPocMatch(
  payload: Partial<PocMatch> & { match_title: string },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const client = getAuthClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("poc_matches")
    .insert({ ...payload, updated_at: now })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string }).id };
}

export async function updatePocMatch(
  id: string,
  patch: Partial<PocMatch>,
): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("poc_matches")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function splitInputList(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function throwFirstError(errors: unknown[]) {
  const first = errors.find(Boolean);
  if (first instanceof Error) throw first;
  if (first && typeof first === "object" && "message" in first) {
    throw new Error(String((first as { message: unknown }).message));
  }
}

export const POC_COMPANY_STATUS_LABEL: Record<PocCompanyStatus, string> = {
  candidate: "候補",
  listed: "リスト化",
  contacted: "接触済",
  hearing: "ヒアリング中",
  poc_ready: "PoC設計可",
  archived: "アーカイブ",
};

export const POC_MATCH_STATUS_LABEL: Record<PocMatchStatus, string> = {
  candidate: "候補",
  hearing_design: "質問設計",
  introduced: "紹介済",
  hearing_done: "ヒアリング済",
  poc_design: "PoC設計中",
  poc_running: "PoC実施中",
  deal: "案件化",
  archived: "アーカイブ",
};

export const POC_PRIORITY_LABEL: Record<PocPriority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export const POC_COMPANY_STATUS_ORDER: PocCompanyStatus[] = [
  "candidate",
  "listed",
  "contacted",
  "hearing",
  "poc_ready",
  "archived",
];

export const POC_MATCH_STATUS_ORDER: PocMatchStatus[] = [
  "candidate",
  "hearing_design",
  "introduced",
  "hearing_done",
  "poc_design",
  "poc_running",
  "deal",
  "archived",
];

export const POC_PRIORITY_ORDER: PocPriority[] = ["high", "medium", "low"];

export const POC_COMPANY_STATUS_COLOR: Record<PocCompanyStatus, string> = {
  candidate: "border-slate-300/40 bg-slate-400/10 text-slate-700 dark:text-slate-200",
  listed: "border-sky-300/45 bg-sky-400/14 text-sky-700 dark:text-sky-200",
  contacted: "border-amber-300/45 bg-amber-400/14 text-amber-700 dark:text-amber-200",
  hearing: "border-cyan-300/45 bg-cyan-400/14 text-cyan-700 dark:text-cyan-200",
  poc_ready: "border-emerald-300/45 bg-emerald-400/14 text-emerald-700 dark:text-emerald-200",
  archived: "border-slate-500/30 bg-slate-700/12 text-slate-500 dark:text-slate-400",
};

export const POC_MATCH_STATUS_COLOR: Record<PocMatchStatus, string> = {
  candidate: "border-slate-300/40 bg-slate-400/10 text-slate-700 dark:text-slate-200",
  hearing_design: "border-blue-300/45 bg-blue-400/14 text-blue-700 dark:text-blue-200",
  introduced: "border-violet-300/45 bg-violet-400/14 text-violet-700 dark:text-violet-200",
  hearing_done: "border-cyan-300/45 bg-cyan-400/14 text-cyan-700 dark:text-cyan-200",
  poc_design: "border-amber-300/45 bg-amber-400/14 text-amber-700 dark:text-amber-200",
  poc_running: "border-emerald-300/45 bg-emerald-400/14 text-emerald-700 dark:text-emerald-200",
  deal: "border-lime-300/45 bg-lime-400/14 text-lime-700 dark:text-lime-200",
  archived: "border-slate-500/30 bg-slate-700/12 text-slate-500 dark:text-slate-400",
};

export const POC_PRIORITY_COLOR: Record<PocPriority, string> = {
  high: "border-rose-300/50 bg-rose-400/14 text-rose-700 dark:text-rose-200",
  medium: "border-amber-300/50 bg-amber-400/14 text-amber-700 dark:text-amber-200",
  low: "border-slate-300/40 bg-slate-400/10 text-slate-600 dark:text-slate-300",
};
