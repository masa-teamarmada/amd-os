// Seeds (研究シーズリスト) データアクセス層
// - 読み取りは anon key (RLS anon_read OK)
// - 書き込みは authClient (authenticated browser client)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import type {
  Seed,
  SeedFunding,
  SeedNews,
  SeedContactLog,
  SeedListItem,
  SeedDetail,
  SeedPublicView,
  SeedProjectLink,
} from "@/types/seeds";
import { SEED_PUBLIC_VIEW_COLUMNS } from "@/types/seeds";
export {
  SEED_COMMERCIALIZATION_TYPE_LABEL,
  SEED_COMMERCIALIZATION_TYPE_ORDER,
  SEED_KUTE_MARKET_CONFIDENCE_LABEL,
  seedComparisonSortValue,
  compareSeedSortValues,
  groupSeedsByResearcher,
  sortSeedGroups,
  countDistinctResearchers,
  groupSeedsByInstitution,
  countDistinctInstitutions,
  seedProjectLifecycle,
  seedProjectPriority,
  seedListPriority,
  type SeedComparisonSortKey,
  type SeedResearcherGroup,
  type SeedInstitutionGroup,
} from "@/lib/kute-seeds-scoring";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = typeof window === "undefined"
  ? createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "amd-os-pwa-readonly-seeds",
      },
    },
  )
  : createBrowserSupabase();

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
    supabase
      .from("seed_funding")
      .select("seed_id, amount_jpy, status, program_short, fiscal_year"),
    supabase.from("seed_news").select("seed_id, dismissed"),
    supabase.from("seed_contact_log").select("seed_id, contacted_on"),
  ]);

  const seeds = (seedsRes.data ?? []) as Seed[];
  const projectLinksBySeed = await fetchSeedProjectLinks(
    seeds.map((seed) => seed.id),
  );
  const fundings = (fundingRes.data ?? []) as {
    seed_id: string;
    amount_jpy: number | null;
    status: string | null;
    program_short: string | null;
    fiscal_year: number | null;
  }[];
  const news = (newsRes.data ?? []) as {
    seed_id: string;
    dismissed: boolean;
  }[];
  const contacts = (contactRes.data ?? []) as {
    seed_id: string;
    contacted_on: string;
  }[];

  // AMD owner code_name
  const ownerIds = Array.from(
    new Set(
      seeds.map((s) => s.amd_owner_member_id).filter((v): v is string => !!v),
    ),
  );
  const ownerNameMap = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: members } = await supabase
      .from("members")
      .select("member_id, code_name")
      .in("member_id", ownerIds);
    for (const m of (members ?? []) as {
      member_id: string;
      code_name: string;
    }[]) {
      ownerNameMap.set(m.member_id, m.code_name);
    }
  }

  // PJ 名 (spun_off)
  const pjIds = Array.from(
    new Set(
      seeds.map((s) => s.spun_off_project_id).filter((v): v is string => !!v),
    ),
  );
  const pjNameMap = new Map<string, string>();
  if (pjIds.length > 0) {
    const { data: pjs } = await supabase
      .from("project_ventures")
      .select("project_id, short_label, projects(project_name)")
      .in("project_id", pjIds);
    for (const p of (pjs ?? []) as {
      project_id: string;
      short_label: string | null;
      projects:
        | { project_name: string | null }
        | { project_name: string | null }[]
        | null;
    }[]) {
      const project = Array.isArray(p.projects) ? p.projects[0] : p.projects;
      pjNameMap.set(
        p.project_id,
        p.short_label ?? project?.project_name ?? p.project_id,
      );
    }
  }

  // 集計
  const fundingCountBySeed = new Map<string, number>();
  const fundingTotalBySeed = new Map<string, number>();
  const fundingProgramsBySeed = new Map<
    string,
    { program: string; year: number | null }[]
  >();
  // 採択年度の新しい順 → プログラム名昇順 で並べる準備
  const sortedFundings = [...fundings].sort((a, b) => {
    const ay = a.fiscal_year ?? -1;
    const by = b.fiscal_year ?? -1;
    if (ay !== by) return by - ay;
    return (a.program_short ?? "").localeCompare(b.program_short ?? "");
  });
  for (const f of sortedFundings) {
    fundingCountBySeed.set(
      f.seed_id,
      (fundingCountBySeed.get(f.seed_id) ?? 0) + 1,
    );
    if (f.amount_jpy != null) {
      fundingTotalBySeed.set(
        f.seed_id,
        (fundingTotalBySeed.get(f.seed_id) ?? 0) + f.amount_jpy,
      );
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
    contactCountBySeed.set(
      c.seed_id,
      (contactCountBySeed.get(c.seed_id) ?? 0) + 1,
    );
    const cur = lastContactBySeed.get(c.seed_id);
    if (!cur || c.contacted_on > cur)
      lastContactBySeed.set(c.seed_id, c.contacted_on);
  }

  return seeds.map((s) => ({
    ...s,
    funding_count: fundingCountBySeed.get(s.id) ?? 0,
    funding_total_jpy: fundingTotalBySeed.get(s.id) ?? 0,
    funding_programs: fundingProgramsBySeed.get(s.id) ?? [],
    news_count: newsCountBySeed.get(s.id) ?? 0,
    contact_log_count: contactCountBySeed.get(s.id) ?? 0,
    last_contacted_on: lastContactBySeed.get(s.id) ?? null,
    amd_owner_code_name: s.amd_owner_member_id
      ? (ownerNameMap.get(s.amd_owner_member_id) ?? null)
      : null,
    spun_off_project_name: s.spun_off_project_id
      ? (pjNameMap.get(s.spun_off_project_id) ?? null)
      : null,
    project_links: projectLinksBySeed.get(s.id) ?? [],
  }));
}

/** 詳細画面: シーズ + 全関連レコード */
export async function fetchSeedDetail(
  seedId: string,
): Promise<SeedDetail | null> {
  const [seedRes, fundingRes, newsRes, contactRes] = await Promise.all([
    supabase.from("seeds").select("*").eq("id", seedId).maybeSingle(),
    supabase
      .from("seed_funding")
      .select("*")
      .eq("seed_id", seedId)
      .order("fiscal_year", { ascending: false, nullsFirst: false }),
    supabase
      .from("seed_news")
      .select("*")
      .eq("seed_id", seedId)
      .order("occurred_on", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase
      .from("seed_contact_log")
      .select("*")
      .eq("seed_id", seedId)
      .order("contacted_on", { ascending: false }),
  ]);

  const seed = seedRes.data as Seed | null;
  if (!seed) return null;
  const projectLinksBySeed = await fetchSeedProjectLinks([seed.id]);

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
    for (const m of (members ?? []) as {
      member_id: string;
      code_name: string;
    }[]) {
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
        projects:
          | { project_name: string | null }
          | { project_name: string | null }[]
          | null;
      };
      const project = Array.isArray(p.projects) ? p.projects[0] : p.projects;
      spunOffProjectName =
        p.short_label ?? project?.project_name ?? seed.spun_off_project_id;
    }
  }

  return {
    seed,
    funding: (fundingRes.data ?? []) as SeedFunding[],
    news: (newsRes.data ?? []) as SeedNews[],
    contact_log: contactLog.map((c) => ({
      ...c,
      amd_member_code_name: c.amd_member_id
        ? (memberNameMap.get(c.amd_member_id) ?? null)
        : null,
    })),
    amd_owner_code_name: seed.amd_owner_member_id
      ? (memberNameMap.get(seed.amd_owner_member_id) ?? null)
      : null,
    spun_off_project_name: spunOffProjectName,
    project_links: projectLinksBySeed.get(seed.id) ?? [],
  };
}

// =====================================================================
// 書き込み (authClient)
// =====================================================================

export async function insertSeed(
  payload: Partial<Seed> & { title: string; org_name: string },
): Promise<{ ok: boolean; id?: string; error?: string }> {
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

export async function updateSeed(
  id: string,
  patch: Partial<Seed>,
): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("seeds")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteSeed(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("seeds").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function insertSeedFunding(
  payload: Partial<SeedFunding> & { seed_id: string; program: string },
): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("seed_funding").insert(payload);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateSeedFunding(
  id: string,
  patch: Partial<SeedFunding>,
): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("seed_funding")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteSeedFunding(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("seed_funding").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function insertSeedNews(
  payload: Partial<SeedNews> & {
    seed_id: string;
    title: string;
    kind: SeedNews["kind"];
  },
): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("seed_news").insert(payload);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateSeedNews(
  id: string,
  patch: Partial<SeedNews>,
): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("seed_news")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteSeedNews(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("seed_news").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function insertSeedContactLog(
  payload: Partial<SeedContactLog> & {
    seed_id: string;
    contacted_on: string;
    note: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("seed_contact_log").insert(payload);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateSeedContactLog(
  id: string,
  patch: Partial<SeedContactLog>,
): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("seed_contact_log")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteSeedContactLog(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
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
  const fundings = (fundingRes.data ?? []) as {
    seed_id: string;
    program_short: string | null;
    fiscal_year: number | null;
  }[];

  const fundingProgramsBySeed = new Map<
    string,
    { program: string; year: number | null }[]
  >();
  const sortedFundings = [...fundings].sort(
    (a, b) => (b.fiscal_year ?? -1) - (a.fiscal_year ?? -1),
  );
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

export async function verifySeed(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("seeds")
    .update({
      discovery_status: "reviewed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function dismissSeed(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("seeds")
    .update({
      discovery_status: "dismissed",
      updated_at: new Date().toISOString(),
    })
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
 * PJ cockpit (KUTE / EHM 等) の研究機関公開面向け: 対象 project_id にひもづく
 * institution_id のシーズを取得する。kute-seeds-scoring の唯一のマッピングを経由するため、
 * project_id → institution_id 対応をここに重複定義しない。
 */
export async function fetchResearchInstitutionSeedsForProject(
  projectId: string,
): Promise<SeedPublicView[]> {
  const institutionId = await fetchInstitutionIdForProject(projectId);
  return institutionId ? fetchSeedsForInstitution(institutionId) : [];
}

/** institution_projects を正本に project_id の研究機関スコープを解決する。 */
export async function fetchInstitutionIdForProject(
  projectId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("institution_projects")
    .select("institution_id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.institution_id ? String(data.institution_id) : null;
}

/**
 * 「土壌×シーズ」タブ向け: 対象 institution_id に直接ひもづく研究機関シーズを
 * ホワイトリスト select で取得する (org_name 文字列一致の projectId 経由ではなく
 * seeds.institution_id (migration 202) を直接フィルタする)。
 * internal_notes / source_detail 等は select 句に含めないため、レスポンスにも一切乗らない。
 */
export async function fetchSeedsForInstitution(
  institutionId: string,
): Promise<SeedPublicView[]> {
  const { data, error } = await supabase
    .from("seeds")
    .select(SEED_PUBLIC_VIEW_COLUMNS.join(", "))
    .eq("institution_id", institutionId)
    .order("researcher_name", { ascending: true });
  if (error) throw new Error(error.message);
  const seeds = (data ?? []) as unknown as SeedPublicView[];
  const seedIds = seeds.map((seed) => seed.id);
  const projectLinksBySeed = await fetchSeedProjectLinks(seedIds);
  return seeds.map((s) => ({
    ...s,
    // 退役評価テーブルは現行経路から読まない。現行帯はservice_role APIで別取得する。
    latest_sps: null,
    project_links: projectLinksBySeed.get(s.id) ?? [],
  }));
}

/**
 * /seeds (全機関横断比較) 向け: 全シーズを公開安全なホワイトリスト select で取得する。
 * org_name / institution_id での絞り込みは行わない。internal_notes / source_detail /
 * evaluator / axis_evidence は select 句に含めないため、レスポンスにも一切乗らない。
 */
export async function fetchAllResearchInstitutionSeeds(
  readClient: SupabaseClient = supabase,
): Promise<SeedPublicView[]> {
  const { data, error } = await readClient
    .from("seeds")
    .select(SEED_PUBLIC_VIEW_COLUMNS.join(", "))
    .order("org_name", { ascending: true })
    .order("researcher_name", { ascending: true });
  if (error) throw new Error(error.message);
  const seeds = (data ?? []) as unknown as SeedPublicView[];
  const seedIds = seeds.map((seed) => seed.id);
  const projectLinksBySeed = await fetchSeedProjectLinks(seedIds, readClient);
  return seeds.map((s) => ({
    ...s,
    latest_sps: null,
    project_links: projectLinksBySeed.get(s.id) ?? [],
  }));
}

/**
 * .in() へ渡すIDの一括上限。
 * PostgREST は条件をURLのクエリ文字列へ載せるため、IDを一度に渡しすぎるとURL長の上限に当たり
 * HTTP 400 (Bad Request) になる。UUIDは1件あたり約37バイトなので、200件で約7.4KB に収まる。
 * 2026-08-23: シーズが735件へ増え、全件を一度に渡してシーズリスト全体が
 * 「Bad Request」で表示できなくなっていたのを修正した。
 */
const IN_FILTER_CHUNK_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** seed_projects をAMD契約レイヤーとして取得する。seeds.status/spun_off_project_id は関係判定に使わない。 */
async function fetchSeedProjectLinks(
  seedIds: string[],
  readClient: SupabaseClient = supabase,
): Promise<Map<string, SeedProjectLink[]>> {
  const result = new Map<string, SeedProjectLink[]>();
  if (seedIds.length === 0) return result;
  const pages = await Promise.all(
    chunk(seedIds, IN_FILTER_CHUNK_SIZE).map((ids) =>
      readClient
        .from("seed_projects")
        .select(
          "seed_id,project_id,commercialization_stage,commercialization_route,venture_name,target_market,projects(project_name,status)",
        )
        .in("seed_id", ids),
    ),
  );
  const data = [];
  for (const page of pages) {
    if (page.error) throw new Error(page.error.message);
    data.push(...(page.data ?? []));
  }

  for (const row of data) {
    const project = Array.isArray(row.projects)
      ? row.projects[0]
      : row.projects;
    const link: SeedProjectLink = {
      project_id: String(row.project_id),
      project_name: project?.project_name || String(row.project_id),
      project_status: project?.status || "unknown",
      commercialization_stage: row.commercialization_stage ?? null,
      commercialization_route: row.commercialization_route ?? null,
      venture_name: row.venture_name ?? null,
      target_market: row.target_market ?? null,
    };
    const seedId = String(row.seed_id);
    const links = result.get(seedId);
    if (links) links.push(link);
    else result.set(seedId, [link]);
  }
  return result;
}

/**
 * 「土壌×シーズ」タブの時系列・クロスセクション整列向け: 対象シーズ群の
 * SPS 評価履歴を全件 (評価日昇順) 取得し、公開安全なサマリの配列へ変換する。
 * `institution-soil-seeds.ts` の as-of 整列関数にそのまま渡せる形。
 */

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
  spun_off: "スピンアウト済み",
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
  candidate: "border border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  investigating: "border border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200",
  contacted: "border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  discussing: "border border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  spun_off: "border border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200",
  declined: "border border-slate-400 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
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
  slack: "Slack",
  teams: "Teams",
  meeting: "MTG / 面談",
  event: "イベント",
  referral: "紹介",
  visit: "訪問",
  other: "その他",
};

// 一次選別スクリーニング帯の根拠Lv (スコア成熟度)。
// 正本: bzm/BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md §6 確定13
export const SEED_EVIDENCE_LEVEL_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: "Lv0",
  1: "Lv1",
  2: "Lv2",
  3: "Lv3",
};

export const SEED_EVIDENCE_LEVEL_DESCRIPTION: Record<0 | 1 | 2 | 3, string> = {
  0: "根拠Lv0 = ネットの情報だけ（一次選別の帯のみ）",
  1: "根拠Lv1 = 実際に会ってヒアリング済み",
  2: "根拠Lv2 = OSにPJの情報が抽出できている",
  3: "根拠Lv3 = 月次試算表が作成されている",
};

/** 円 → 億円の丸め表示。整数億円は小数点を出さない (例: 60 / 0.5)。null は "—"。 */
export function formatOkuYen(yen: number | null): string {
  if (yen == null) return "—";
  const oku = yen / 100_000_000;
  const rounded = Math.round(oku * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * スクリーニング帯の中央値 (円)。算術中点 (lower+upper)/2。仮置き実装 (まさ裁定 2026-08-15:
 * 「帯にしちゃってるからソーティングがきかない。一旦仮置きで中央値をSPSとして」)。
 * 上限・下限のどちらかが欠けている場合は中央値を計算できないため null。
 */
export function seedScreeningBandMedianYen(
  lowerYen: number | null,
  upperYen: number | null,
): number | null {
  if (lowerYen == null || upperYen == null) return null;
  return (lowerYen + upperYen) / 2;
}

/**
 * 「中央値 (下限〜上限)」表示。例: "30.3 (0.5〜60)"。仮置き実装 (まさ裁定 2026-08-15)。
 * 中央値を計算できない (どちらかが null) 場合は、値がある方だけを単独表示する。両方 null なら "—"。
 */
export function formatSpsBandWithMedian(lowerYen: number | null, upperYen: number | null): string {
  const median = seedScreeningBandMedianYen(lowerYen, upperYen);
  if (median != null) {
    return `${formatOkuYen(median)} (${formatOkuYen(lowerYen)}〜${formatOkuYen(upperYen)})`;
  }
  if (lowerYen != null || upperYen != null) {
    return formatOkuYen(lowerYen ?? upperYen);
  }
  return "—";
}
