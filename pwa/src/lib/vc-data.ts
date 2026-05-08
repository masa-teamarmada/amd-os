// VC List データアクセス層
// - 読み取りは anon key (RLS anon_read OK)
// - 書き込みは authClient (browser client) または admin (server)

import { createClient } from "@supabase/supabase-js";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import type {
  Vc,
  VcFund,
  VcInvestment,
  VcContact,
  ProjectVcRelation,
  VcNews,
  VcListItem,
  VcDetail,
} from "@/types/vc";

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
export async function fetchVcList(): Promise<VcListItem[]> {
  const [vcsRes, fundsRes, relsRes, newsRes, amdInvRes] = await Promise.all([
    supabase.from("vcs").select("*"),
    supabase.from("vc_funds").select("*"),
    supabase
      .from("project_vc_relations")
      .select("vc_id, project_id, status, last_touch_at, vc_contact_id"),
    supabase.from("vc_news").select("vc_id, verified, dismissed"),
    supabase
      .from("vc_investments")
      .select("vc_id, our_project_id, amount_jpy")
      .not("our_project_id", "is", null),
  ]);

  const vcs = (vcsRes.data ?? []) as Vc[];
  const funds = (fundsRes.data ?? []) as VcFund[];
  const rels = (relsRes.data ?? []) as {
    vc_id: string;
    project_id: string;
    status: string;
    last_touch_at: string | null;
    vc_contact_id: string | null;
  }[];
  const news = (newsRes.data ?? []) as { vc_id: string; verified: boolean; dismissed: boolean }[];
  const amdInvs = (amdInvRes.data ?? []) as { vc_id: string; our_project_id: string; amount_jpy: number | null }[];

  // AMD PJ 名解決 (出資 + コンタクト両方の PJ をまとめて解決)
  const pjIds = Array.from(
    new Set([...amdInvs.map((i) => i.our_project_id), ...rels.map((r) => r.project_id)])
  );
  const pjNameMap = new Map<string, string>();
  if (pjIds.length > 0) {
    const { data: pjs } = await supabase
      .from("project_ventures")
      .select("project_id, display_name, short_label")
      .in("project_id", pjIds);
    for (const p of (pjs ?? []) as { project_id: string; display_name: string; short_label: string | null }[]) {
      pjNameMap.set(p.project_id, p.short_label ?? p.display_name);
    }
  }

  // VC × 出資先 PJ 集計
  const amdInvByVc = new Map<string, { project_id: string; project_name: string; amount_jpy: number | null }[]>();
  for (const inv of amdInvs) {
    const list = amdInvByVc.get(inv.vc_id) ?? [];
    list.push({
      project_id: inv.our_project_id,
      project_name: pjNameMap.get(inv.our_project_id) ?? inv.our_project_id,
      amount_jpy: inv.amount_jpy,
    });
    amdInvByVc.set(inv.vc_id, list);
  }

  // 担当者名解決 (relations.vc_contact_id → vc_contacts.name)
  const contactIds = Array.from(new Set(rels.map((r) => r.vc_contact_id).filter((id): id is string => !!id)));
  const contactNameMap = new Map<string, string>();
  if (contactIds.length > 0) {
    const { data: cs } = await supabase.from("vc_contacts").select("id, name").in("id", contactIds);
    for (const c of (cs ?? []) as { id: string; name: string }[]) contactNameMap.set(c.id, c.name);
  }

  // VC × コンタクト PJ 集計 (status != 'invested' を含む全てのリレーション。
  //  「出資未完でもコンタクトしてきた」も拾うため status フィルタは入れない)
  const amdContactsByVc = new Map<string, Map<string, { status: string; last_touch_at: string | null; contact_names: Set<string> }>>();
  for (const r of rels) {
    let pjMap = amdContactsByVc.get(r.vc_id);
    if (!pjMap) {
      pjMap = new Map();
      amdContactsByVc.set(r.vc_id, pjMap);
    }
    let entry = pjMap.get(r.project_id);
    if (!entry) {
      entry = { status: r.status, last_touch_at: r.last_touch_at, contact_names: new Set() };
      pjMap.set(r.project_id, entry);
    }
    if (r.vc_contact_id) {
      const cname = contactNameMap.get(r.vc_contact_id);
      if (cname) entry.contact_names.add(cname);
    }
  }

  const fundsByVc = new Map<string, VcFund[]>();
  for (const f of funds) {
    const list = fundsByVc.get(f.vc_id) ?? [];
    list.push(f);
    fundsByVc.set(f.vc_id, list);
  }

  const relsByVc = new Map<string, { vc_id: string; last_touch_at: string | null }[]>();
  for (const r of rels) {
    const list = relsByVc.get(r.vc_id) ?? [];
    list.push(r);
    relsByVc.set(r.vc_id, list);
  }

  const unverifiedByVc = new Map<string, number>();
  for (const n of news) {
    if (!n.verified && !n.dismissed) {
      unverifiedByVc.set(n.vc_id, (unverifiedByVc.get(n.vc_id) ?? 0) + 1);
    }
  }

  return vcs.map((v) => {
    const fundList = fundsByVc.get(v.id) ?? [];
    const active = pickActiveFund(fundList);
    const relList = relsByVc.get(v.id) ?? [];
    const lastTouch = relList
      .map((r) => r.last_touch_at)
      .filter((d): d is string => !!d)
      .sort()
      .pop() ?? null;

    let dpLow: number | null = null;
    let dpHigh: number | null = null;
    for (const f of fundList) {
      if (f.status === "investing" || f.status === "first_closed" || f.status === "final_closed" || f.status === "raising") {
        if (f.dry_powder_jpy_low != null) dpLow = (dpLow ?? 0) + f.dry_powder_jpy_low;
        if (f.dry_powder_jpy_high != null) dpHigh = (dpHigh ?? 0) + f.dry_powder_jpy_high;
      }
    }

    const amdInvList = (amdInvByVc.get(v.id) ?? []).slice();
    // 出資額が大きい順 → 名前順 でソート
    amdInvList.sort((a, b) => (b.amount_jpy ?? -1) - (a.amount_jpy ?? -1) || a.project_name.localeCompare(b.project_name));
    const amdTotal = amdInvList.reduce((s, x) => s + (x.amount_jpy ?? 0), 0);

    // コンタクト履歴を array にまとめる (出資成立 PJ を除外、なぜならそれは出資列で表示済)
    const investedPjIds = new Set(amdInvList.map((x) => x.project_id));
    const pjMap = amdContactsByVc.get(v.id);
    const amdContacts = pjMap
      ? Array.from(pjMap.entries())
          .filter(([pjId]) => !investedPjIds.has(pjId))
          .map(([pjId, e]) => ({
            project_id: pjId,
            project_name: pjNameMap.get(pjId) ?? pjId,
            status: e.status as VcListItem["amd_pj_contacts"][number]["status"],
            contact_names: Array.from(e.contact_names),
            last_touch_at: e.last_touch_at,
          }))
          .sort((a, b) => (b.last_touch_at ?? "").localeCompare(a.last_touch_at ?? ""))
      : [];

    return {
      ...v,
      active_fund: active,
      fund_count: fundList.length,
      pj_relation_count: relList.length,
      last_touch_at: lastTouch,
      unverified_news_count: unverifiedByVc.get(v.id) ?? 0,
      total_dry_powder_low: dpLow,
      total_dry_powder_high: dpHigh,
      amd_pj_investments: amdInvList,
      amd_pj_total_amount_jpy: amdTotal,
      amd_pj_contacts: amdContacts,
    };
  });
}

function pickActiveFund(funds: VcFund[]): VcFund | null {
  const active = funds.filter(
    (f) =>
      f.status === "raising" ||
      f.status === "investing" ||
      f.status === "first_closed" ||
      f.status === "final_closed"
  );
  if (active.length === 0) return null;
  return active.sort((a, b) => (b.fund_no ?? 0) - (a.fund_no ?? 0))[0];
}

/** 詳細画面: 全関連レコード */
export async function fetchVcDetail(vcId: string): Promise<VcDetail | null> {
  const [vcRes, fundsRes, invsRes, contactsRes, relsRes, newsRes] = await Promise.all([
    supabase.from("vcs").select("*").eq("id", vcId).maybeSingle(),
    supabase.from("vc_funds").select("*").eq("vc_id", vcId).order("fund_no", { ascending: true }),
    supabase.from("vc_investments").select("*").eq("vc_id", vcId).order("invested_at", { ascending: false }),
    supabase.from("vc_contacts").select("*").eq("vc_id", vcId).order("name"),
    supabase.from("project_vc_relations").select("*").eq("vc_id", vcId),
    supabase.from("vc_news").select("*").eq("vc_id", vcId).order("occurred_on", { ascending: false, nullsFirst: false }).limit(100),
  ]);

  const vc = vcRes.data as Vc | null;
  if (!vc) return null;

  const relations = (relsRes.data ?? []) as ProjectVcRelation[];
  // PJ 名 / コンタクト名 / AMD オーナー code_name を埋める
  const pjIds = relations.map((r) => r.project_id).filter((v, i, a) => a.indexOf(v) === i);
  const contactIds = relations.map((r) => r.vc_contact_id).filter((v): v is string => !!v);
  const ownerIds = relations.map((r) => r.amd_owner_member_id).filter((v): v is string => !!v);

  const [pjRes, contactNameRes, memberRes] = await Promise.all([
    pjIds.length > 0
      ? supabase.from("project_ventures").select("project_id, display_name").in("project_id", pjIds)
      : Promise.resolve({ data: [] }),
    contactIds.length > 0
      ? supabase.from("vc_contacts").select("id, name").in("id", contactIds)
      : Promise.resolve({ data: [] }),
    ownerIds.length > 0
      ? supabase.from("members").select("member_id, code_name").in("member_id", ownerIds)
      : Promise.resolve({ data: [] }),
  ]);
  const pjMap = new Map<string, string>();
  for (const p of (pjRes.data ?? []) as { project_id: string; display_name: string }[]) {
    pjMap.set(p.project_id, p.display_name);
  }
  const contactMap = new Map<string, string>();
  for (const c of (contactNameRes.data ?? []) as { id: string; name: string }[]) {
    contactMap.set(c.id, c.name);
  }
  const memberMap = new Map<string, string>();
  for (const m of (memberRes.data ?? []) as { member_id: string; code_name: string }[]) {
    memberMap.set(m.member_id, m.code_name);
  }

  return {
    vc,
    funds: (fundsRes.data ?? []) as VcFund[],
    investments: (invsRes.data ?? []) as VcInvestment[],
    contacts: (contactsRes.data ?? []) as VcContact[],
    relations: relations.map((r) => ({
      ...r,
      project_name: pjMap.get(r.project_id),
      contact_name: r.vc_contact_id ? contactMap.get(r.vc_contact_id) : null,
      amd_owner_code_name: r.amd_owner_member_id ? memberMap.get(r.amd_owner_member_id) : null,
    })),
    news: (newsRes.data ?? []) as VcNews[],
  };
}

/** ニュース受信箱: 未確認 vc_news 全部 */
export async function fetchVcInbox(): Promise<(VcNews & { vc_name: string })[]> {
  const { data: news } = await supabase
    .from("vc_news")
    .select("*")
    .eq("verified", false)
    .eq("dismissed", false)
    .order("occurred_on", { ascending: false, nullsFirst: false })
    .limit(200);

  const list = (news ?? []) as VcNews[];
  if (list.length === 0) return [];

  const vcIds = list.map((n) => n.vc_id).filter((v, i, a) => a.indexOf(v) === i);
  const { data: vcs } = await supabase.from("vcs").select("id, name").in("id", vcIds);
  const nameMap = new Map<string, string>();
  for (const v of (vcs ?? []) as { id: string; name: string }[]) nameMap.set(v.id, v.name);

  return list.map((n) => ({ ...n, vc_name: nameMap.get(n.vc_id) ?? "(unknown)" }));
}

export async function fetchVcInboxCount(): Promise<number> {
  const { count } = await supabase
    .from("vc_news")
    .select("*", { count: "exact", head: true })
    .eq("verified", false)
    .eq("dismissed", false);
  return count ?? 0;
}

// =====================================================================
// 書き込み (authClient)
// =====================================================================

export async function upsertVc(payload: Partial<Vc> & { name: string }): Promise<{ ok: boolean; id?: string; error?: string }> {
  const client = getAuthClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("vcs")
    .upsert({ ...payload, updated_at: now }, { onConflict: "name" })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateVc(id: string, patch: Partial<Vc>): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("vcs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function upsertVcFund(payload: Partial<VcFund> & { vc_id: string; fund_no: number }): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("vc_funds")
    .upsert({ ...payload, updated_at: new Date().toISOString() }, { onConflict: "vc_id,fund_no" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteVcFund(id: string): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("vc_funds").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function insertVcInvestment(payload: Partial<VcInvestment> & { vc_id: string; target_company: string }): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("vc_investments").insert(payload);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateVcInvestment(id: string, patch: Partial<VcInvestment>): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("vc_investments")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteVcInvestment(id: string): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("vc_investments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function insertVcContact(payload: Partial<VcContact> & { vc_id: string; name: string }): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("vc_contacts").insert(payload);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateVcContact(id: string, patch: Partial<VcContact>): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("vc_contacts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteVcContact(id: string): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("vc_contacts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function upsertProjectVcRelation(payload: Partial<ProjectVcRelation> & { project_id: string; vc_id: string }): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("project_vc_relations")
    .upsert({ ...payload, updated_at: new Date().toISOString() }, { onConflict: "project_id,vc_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteProjectVcRelation(id: string): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("project_vc_relations").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function verifyVcNews(id: string): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("vc_news")
    .update({ verified: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function dismissVcNews(id: string): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client
    .from("vc_news")
    .update({ dismissed: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function insertVcNews(payload: Partial<VcNews> & { vc_id: string; title: string; kind: VcNews["kind"] }): Promise<{ ok: boolean; error?: string }> {
  const client = getAuthClient();
  const { error } = await client.from("vc_news").insert(payload);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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

export function formatJpyRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return "—";
  if (low != null && high != null && low === high) return formatJpy(low);
  if (low != null && high != null) return `${formatJpy(low)}〜${formatJpy(high)}`;
  return formatJpy(low ?? high);
}

export const VC_TYPE_LABEL: Record<string, string> = {
  independent: "独立系",
  cvc: "CVC",
  gov: "政府系",
  government: "政府系",
  corporate: "事業会社系",
  university_affiliated: "大学発",
  overseas: "海外",
};

export const FUND_STATUS_LABEL: Record<string, string> = {
  raising: "募集中",
  first_closed: "1st クローズ",
  final_closed: "ファイナルクローズ",
  investing: "投資中",
  harvesting: "ハーベスト",
  closed: "クローズ済",
  unknown: "不明",
};

export const PVR_STATUS_LABEL: Record<string, string> = {
  not_contacted: "未接触",
  pitching: "ピッチ中",
  evaluating: "検討中",
  dd: "DD 中",
  term_sheet: "ターム協議",
  invested: "投資済",
  passed: "見送り",
  declined: "辞退",
};

export const DRY_POWDER_SOURCE_LABEL: Record<string, string> = {
  estimated: "推定",
  heard_from_contact: "担当直聞き",
  public_disclosure: "公表値",
};

export const VC_NEWS_KIND_LABEL: Record<string, string> = {
  fundraise: "ファンド募集",
  investment: "投資",
  personnel: "人事",
  fund_close: "ファンドクローズ",
  thesis_change: "テーゼ変化",
  press: "プレス",
  other: "その他",
};
