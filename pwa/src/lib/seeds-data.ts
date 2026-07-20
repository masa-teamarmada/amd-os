// Seeds (研究シーズリスト) データアクセス層
// - 読み取りは anon key (RLS anon_read OK)
// - 書き込みは authClient (browser client)

import { createClient } from "@supabase/supabase-js";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import type {
  Seed,
  SeedFunding,
  SeedNews,
  SeedContactLog,
  SeedListItem,
  SeedDetail,
  SeedPublicView,
} from "@/types/seeds";
import { SEED_PUBLIC_VIEW_COLUMNS } from "@/types/seeds";
import { researchInstitutionSeedsOrgNameForProject } from "@/lib/kute-seeds-scoring";
export {
  researchInstitutionSeedsOrgNameForProject,
  computeKuteSeedScore,
  SEED_COMMERCIALIZATION_TYPE_LABEL,
  SEED_COMMERCIALIZATION_TYPE_ORDER,
  SEED_KUTE_MARKET_CONFIDENCE_LABEL,
  type KuteSeedScoreGroup,
  type KuteSeedScore,
} from "@/lib/kute-seeds-scoring";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder"
);

function getAuthClient() {
  return createBrowserSupabase();
}

// =====================================================================
// 読み取り
// =====================================================================

/** リスト画面: 集約済みカード一覧 */
export async function fetchSeedList(): Promise<SeedListItem[]> {
  const [seedsRes, fundingRes, newsRes, contactRes] = await Promise.all([
    supabase.from("seeds").select("*"),
    supabase.from("seed_funding").select("seed_id, amount_jpy, status, program_short, fiscal_year"),
    supabase.from("seed_news").select("seed_id, dismissed"),
    supabase.from("seed_contact_log").select("seed_id, contacted_on"),
  ]);

  const seeds = (seedsRes.data ?? []) as Seed[];
  const fundings = (fundingRes.data ?? []) as { seed_id: string; amount_jpy: number | null; status: string | null; program_short: string | null; fiscal_year: number | null }[];
  const news = (newsRes.data ?? []) as { seed_id: string; dismissed: boolean }[];
  const contacts = (contactRes.data ?? []) as { seed_id: string; contacted_on: string }[];

  // AMD owner code_name
  const ownerIds = Array.from(new Set(seeds.map((s) => s.amd_owner_member_id).filter((v): v is string => !!v)));
  const ownerNameMap = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: members } = await supabase
      .from("members")
      .select("member_id, code_name")
      .in("member_id", ownerIds);
    for (const m of (members ?? []) as { member_id: string; code_name: string }[]) {
      ownerNameMap.set(m.member_id, m.code_name);
    }
  }

  // PJ 名 (spun_off)
  const pjIds = Array.from(new Set(seeds.map((s) => s.spun_off_project_id).filter((v): v is string => !!v)));
  const pjNameMap = new Map<string, string>();
  if (pjIds.length > 0) {
    const { data: pjs } = await supabase
      .from("project_ventures")
      .select("project_id, short_label, projects(project_name)")
      .in("project_id", pjIds);
    for (const p of (pjs ?? []) as {
      project_id: string;
      short_label: string | null;
      projects: { project_name: string | null } | { project_name: string | null }[] | null;
    }[]) {
      const project = Array.isArray(p.projects) ? p.projects[0] : p.projects;
      pjNameMap.set(p.project_id, p.short_label ?? project?.project_name ?? p.project_id);
    }
  }

  // 集計
  const fundingCountBySeed = new Map<string, number>();
  const fundingTotalBySeed = new Map<string, number>();
  const fundingProgramsBySeed = new Map<string, { program: string; year: number | null }[]>();
  // 採択年度の新しい順 → プログラム名昇順 で並べる準備
  const sortedFundings = [...fundings].sort((a, b) => {
    const ay = a.fiscal_year ?? -1;
    const by = b.fiscal_year ?? -1;
    if (ay !== by) return by - ay;
    return (a.program_short ?? "").localeCompare(b.program_short ?? "");
  });
  for (const f of sortedFundings) {
    fundingCountBySeed.set(f.seed_id, (fundingCountBySeed.get(f.seed_id) ?? 0) + 1);
    if (f.amount_jpy != null) {
      fundingTotalBySeed.set(f.seed_id, (fundingTotalBySeed.get(f.seed_id) ?? 0) + f.amount_jpy);
    }
    if (f.program_short) {
      const list = fundingProgramsBySeed.get(f.seed_id) ?? [];
      // 同じ program は最新年度のみを残す (sortedFundings は年度 desc 順なので最初を保持)
      if (!list.some((x) => x.program === f.program_short)) {
        list.push({ program: f.program_short, year: f.fiscal_year });
        fundingProgramsBySeed.set(f.seed_id, list);
      }
    }
  }

  const newsCountBySeed = new Map<string, number>();
  for (const n of news) {
    if (n.dismissed) continue;
    newsCountBySeed.set(n.seed_id, (newsCountBySeed.get(n.seed_id) ?? 0) + 1);
  }

  const contactCountBySeed = new Map<string, number>();
  const lastContactBySeed = new Map<string, string>();
  for (const c of contacts) {
    contactCountBySeed.set(c.seed_id, (contactCountBySeed.get(c.seed_id) ?? 0) + 1);
    const cur = lastContactBySeed.get(c.seed_id);
    if (!cur || c.contacted_on > cur) lastContactBySeed.set(c.seed_id, c.contacted_on);
  }

  return seeds.map((s) => ({
    ...s,
    funding_count: fundingCountBySeed.get(s.id) ?? 0,
    funding_total_jpy: fundingTotalBySeed.get(s.id) ?? 0,
    funding_programs: fundingProgramsBySeed.get(s.id) ?? [],
    news_count: newsCountBySeed.get(s.id) ?? 0,
    contact_log_count: contactCountBySeed.get(s.id) ?? 0,
    last_contacted_on: lastContactBySeed.get(s.id) ?? null,
    amd_owner_code_name: s.amd_owner_member_id ? (ownerNameMap.get(s.amd_owner_member_id) ?? null) : null,
    spun_off_project_name: s.spun_off_project_id ? (pjNameMap.get(s.spun_off_project_id) ?? null) : null,
  }));
}

/** 詳細画面: シーズ + 全関連レコード */
export async function fetchSeedDetail(seedId: string): Promise<SeedDetail | null> {
  const [seedRes, fundingRes, newsRes, contactRes] = await Promise.all([
    supabase.from("seeds").select("*").eq("id", seedId).maybeSingle(),
    supabase.from("seed_funding").select("*").eq("seed_id", seedId).order("fiscal_year", { ascending: false, nullsFirst: false }),
    supabase.from("seed_news").select("*").eq("seed_id", seedId).order("occurred_on", { ascending: false, nullsFirst: false }).limit(100),
    supabase.from("seed_contact_log").select("*").eq("seed_id", seedId).order("contacted_on", { ascending: false }),
  ]);

  const seed = seedRes.data as Seed | null;
  if (!seed) return null;

  const contactLog = (contactRes.data ?? []) as SeedContactLog[];

  // メンバー名解決 (owner + contact_log の amd_member_id)
  const memberIds = new Set<string>();
  if (seed.amd_owner_member_id) memberIds.add(seed.amd_owner_member_id);
  for (const c of contactLog) {
    if (c.amd_member_id) memberIds.add(c.amd_member_id);
  }
  const memberNameMap = new Map<string, string>();
  if (memberIds.size > 0) {
    const { data: members } = await supabase
      .from("members")
      .select("member_id, code_name")
      .in("member_id", Array.from(memberIds));
    for (const m of (members ?? []) as { member_id: string; code_name: string }[]) {
      memberNameMap.set(m.member_id, m.code_name);
    }
  }

  // PJ 名 (spun_off)
  let spunOffProjectName: string | null = null;
  if (seed.spun_off_project_id) {
    const { data: pj } = await supabase
      .from("project_ventures")
      .select("short_label, projects(project_name)")
      .eq("project_id", seed.spun_off_project_id)
      .maybeSingle();
    if (pj) {
      const p = pj as {
        short_label: string | null;
        projects: { project_name: string | null } | { project_name: string | null }[] | null;
      };
      const project = Array.isArray(p.projects) ? p.projects[0] : p.projects;
      spunOffProjectName = p.short_label ?? project?.project_name ?? seed.spun_off_project_id;
    }
  }

  return {
    seed,
    funding: (fundingRes.data ?? []) as SeedFunding[],
    news: (newsRes.data ?? []) as SeedNews[],
    contact_log: contactLog.map((c) => ({
      ...c,
      amd_member_code_name: c.amd_member_id ? (memberNameMap.get(c.amd_member_id) ?? null) : null,
    })),
    amd_owner_code_name: seed.amd_owner_member_id ? (memberNameMap.get(seed.amd_owner_member_id) ?? null) : null,
    spun_off_project_name: spunOffProjectName,
  };
}

// =====================================================================
// 書き込み (authClient)
// =====================================================================

export async function insertSeed(payload: Partial<Seed> & { title: string; org_name: string }): Promise<{ ok: boolean; id?: string; error?: string }> {
  const client = getAuthClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("seeds")
    .insert({ ...payload, updated_at: now })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateSeed(id: string, patch: Partial<Seed>): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("seeds")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteSeed(id: string): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("seeds").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function insertSeedFunding(payload: Partial<SeedFunding> & { seed_id: string; program: string }): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("seed_funding").insert(payload);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateSeedFunding(id: string, patch: Partial<SeedFunding>): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("seed_funding")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteSeedFunding(id: string): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("seed_funding").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function insertSeedNews(payload: Partial<SeedNews> & { seed_id: string; title: string; kind: SeedNews["kind"] }): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("seed_news").insert(payload);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateSeedNews(id: string, patch: Partial<SeedNews>): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("seed_news")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteSeedNews(id: string): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("seed_news").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function insertSeedContactLog(payload: Partial<SeedContactLog> & { seed_id: string; contacted_on: string; note: string }): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("seed_contact_log").insert(payload);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateSeedContactLog(id: string, patch: Partial<SeedContactLog>): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("seed_contact_log")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteSeedContactLog(id: string): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("seed_contact_log").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// =====================================================================
// 受信箱 (cron 自動収集分の未確認シーズ) — discovery_status='discovered' のみ
// =====================================================================

export interface SeedInboxItem extends Seed {
  funding_programs: { program: string; year: number | null }[];
}

/** /seeds/inbox 画面: cron が新規発見した未確認シーズを新着順で取得 */
export async function fetchSeedInbox(): Promise<SeedInboxItem[]> {
  const [seedsRes, fundingRes] = await Promise.all([
    supabase
      .from("seeds")
      .select("*")
      .eq("discovery_status", "discovered")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("seed_funding").select("seed_id, program_short, fiscal_year"),
  ]);
  const seeds = (seedsRes.data ?? []) as Seed[];
  const fundings = (fundingRes.data ?? []) as { seed_id: string; program_short: string | null; fiscal_year: number | null }[];

  const fundingProgramsBySeed = new Map<string, { program: string; year: number | null }[]>();
  const sortedFundings = [...fundings].sort((a, b) => (b.fiscal_year ?? -1) - (a.fiscal_year ?? -1));
  for (const f of sortedFundings) {
    if (!f.program_short) continue;
    const list = fundingProgramsBySeed.get(f.seed_id) ?? [];
    if (!list.some((x) => x.program === f.program_short)) {
      list.push({ program: f.program_short, year: f.fiscal_year });
      fundingProgramsBySeed.set(f.seed_id, list);
    }
  }

  return seeds.map((s) => ({
    ...s,
    funding_programs: fundingProgramsBySeed.get(s.id) ?? [],
  }));
}

/** GlobalNav バッジ用: 未確認 (discovered) シーズ件数 */
export async function fetchSeedInboxCount(): Promise<number> {
  const { count } = await supabase
    .from("seeds")
    .select("*", { count: "exact", head: true })
    .eq("discovery_status", "discovered");
  return count ?? 0;
}

export async function verifySeed(id: string): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("seeds")
    .update({ discovery_status: "reviewed", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function dismissSeed(id: string): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("seeds")
    .update({ discovery_status: "dismissed", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// =====================================================================
// KUTE (PJ cockpit) 向け公開面境界 — 単一の source of truth (seeds) を
// project_id ごとの研究機関スコープにマップする唯一の場所。
// org_name の inline filter を他所に散らさない。
// スコープ判定 / スコア計算の純粋ロジックは kute-seeds-scoring.ts に集約し、
// ここでは re-export + Supabase 読み取りのみを行う。
// =====================================================================

/**
 * PJ cockpit の KUTE 公開面向け: 対象 project_id にひもづく研究機関シーズを
 * ホワイトリスト select で取得する。internal_notes / source_detail 等は
 * select 句に含めないため、レスポンスにも一切乗らない。
 */
export async function fetchResearchInstitutionSeedsForProject(projectId: string): Promise<SeedPublicView[]> {
  const orgName = researchInstitutionSeedsOrgNameForProject(projectId);
  if (!orgName) return [];
  const { data, error } = await supabase
    .from("seeds")
    .select(SEED_PUBLIC_VIEW_COLUMNS.join(", "))
    .eq("org_name", orgName)
    .order("researcher_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SeedPublicView[];
}

// =====================================================================
// Util
// =====================================================================

export function formatJpy(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}兆`;
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}億`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(0)}万`;
  return `${n}`;
}

export const SEED_STATUS_LABEL: Record<string, string> = {
  candidate: "候補",
  investigating: "調査中",
  contacted: "接触済",
  discussing: "協議中",
  spun_off: "PJ化",
  declined: "見送り",
};

export const SEED_STATUS_ORDER: string[] = [
  "candidate",
  "investigating",
  "contacted",
  "discussing",
  "spun_off",
  "declined",
];

export const SEED_STATUS_COLOR: Record<string, string> = {
  candidate: "border border-slate-300/35 bg-slate-300/12 text-slate-100",
  investigating: "border border-sky-300/45 bg-sky-400/16 text-sky-100",
  contacted: "border border-amber-300/45 bg-amber-400/16 text-amber-100",
  discussing: "border border-emerald-300/45 bg-emerald-400/16 text-emerald-100",
  spun_off: "border border-violet-300/45 bg-violet-400/16 text-violet-100",
  declined: "border border-slate-500/35 bg-slate-700/24 text-slate-300",
};

export const SEED_ORG_TYPE_LABEL: Record<string, string> = {
  university: "大学",
  national_lab: "国研",
  kosen: "高専",
  private_lab: "民間研",
  other: "その他",
};

export const SEED_DOMAIN_LANE_LABEL: Record<string, string> = {
  gx_energy: "GX/エネルギー",
  gx_circular: "GX/サーキュラー",
  life: "ライフ/医療",
  materials: "素材/ナノ",
  robo: "ロボ/農・モビ",
  ict: "ICT",
  other: "その他",
};

export const SEED_SOURCE_LABEL: Record<string, string> = {
  introduction: "紹介",
  web_search: "Web検索",
  conference: "学会",
  referral: "リファラル",
  cold: "コールド",
  grant_db: "助成DB",
  researchmap: "researchmap",
  other: "その他",
};

export const SEED_FUNDING_STATUS_LABEL: Record<string, string> = {
  awarded: "採択",
  ongoing: "実施中",
  completed: "完了",
  rejected: "不採択",
  pending: "申請中",
};

export const SEED_NEWS_KIND_LABEL: Record<string, string> = {
  publication: "論文",
  press: "プレス",
  grant: "助成",
  patent: "特許",
  event: "イベント",
  other: "その他",
};

export const SEED_CONTACT_METHOD_LABEL: Record<string, string> = {
  email: "メール",
  phone: "電話",
  meeting: "面談",
  event: "イベント",
  referral: "紹介",
  visit: "訪問",
  other: "その他",
};
