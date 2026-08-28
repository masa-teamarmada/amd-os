// PJコックピット「スコア詳細」タブの《組織》セクションのデータ。
//
// 3つを1回で返す。
//   1. 経営チームの八機能（モデル正本 §6.B-1）と、その充足の判定（§6.B-2）
//   2. 人・組織の観測ログ（§6.C-2 の種類15・16・17）
//   3. 人の一覧 — いま3つのテーブルに散らばっているものを名前で束ねる
//
// 個人の評価を含むので member 限定。外部ワークスペースからは開けない
//（まさ 2026-08-28「外部には見せないよ、スコア詳細タブの中にあるし」）。
import { NextResponse } from "next/server";
import { requireMember } from "@/lib/supabase/api-auth";
import { loadTeamFunctions } from "@/lib/bzm30/team-functions";
import { isThinRecord, judgeFunction, type OrgObservation } from "@/lib/bzm30/team-fulfillment";
import type { OrgMember, OrgMemberGroup, OrgRoleSlot } from "@/lib/project-org-model";

export const runtime = "nodejs";

/** 人の一覧は日単位でしか動かないので、短い再利用を許す。 */
const CACHE_CONTROL = "private, max-age=60, stale-while-revalidate=600";

const FOUNDING_GROUP: Record<string, OrgMemberGroup> = {
  amd: "amd",
  startup: "startup",
  university: "university",
  partner_company: "partner",
  vc: "vc",
  government: "other",
  individual: "other",
  unknown: "other",
};

const VENTURE_GROUP: Record<string, OrgMemberGroup> = {
  amd_internal: "amd",
  su_internal: "startup",
  support_org: "university",
};

const GROUP_ORDER: OrgMemberGroup[] = ["startup", "amd", "university", "partner", "vc", "other"];
const STATUS_ORDER = { active: 0, tentative: 1, inactive: 2 } as const;

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;
  const { projectId } = await params;
  const supabase = auth.supabase;

  const [obsRes, ventureRes, foundingRes, rolesRes] = await Promise.all([
    supabase
      .from("project_org_observations")
      .select(
        "id, observed_on, kind, person_name, function_no, headline, detail, source_tag, source_ref, effect, direction, recorded_by",
      )
      .eq("project_id", projectId)
      .order("observed_on", { ascending: false }),
    supabase
      .from("project_venture_members")
      .select("full_name, role, member_kind, started_at, ended_at, note")
      .eq("project_id", projectId),
    supabase
      .from("project_founding_members")
      .select("person_name, affiliation, role_label_jp, role, category, responsibility, status, last_observed_at")
      .eq("project_id", projectId),
    supabase
      .from("project_management_organization_roles")
      .select("role_name, candidate, join_condition, due_date, vacancy, last_verified_at")
      .eq("project_id", projectId)
      .is("deleted_at", null),
  ]);

  if (obsRes.error) {
    return NextResponse.json(
      { ok: false, error: "人・組織の観測を読めなかった" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const observations: OrgObservation[] = (obsRes.data ?? []).map((row) => ({
    id: row.id as string,
    observedOn: row.observed_on as string,
    kind: row.kind as OrgObservation["kind"],
    personName: (row.person_name as string | null) ?? null,
    functionNo: (row.function_no as number | null) ?? null,
    headline: row.headline as string,
    detail: (row.detail as string | null) ?? null,
    sourceTag: row.source_tag as OrgObservation["sourceTag"],
    sourceRef: (row.source_ref as string | null) ?? null,
    effect: (row.effect as string | null) ?? null,
    direction: row.direction as OrgObservation["direction"],
    recordedBy: row.recorded_by as string,
  }));

  const asOf = new Date().toISOString().slice(0, 10);
  const defs = loadTeamFunctions();
  // 記帳が薄い PJ では、空席かどうかを判定しない（§6.C-3 の3。記録の薄さを案件の悪材料と混同しない）。
  const thinRecord = isThinRecord(observations, asOf);
  const functions = defs.map((def) => ({
    ...def,
    // 正本の「拡張枠」（中身も埋まり方も未定の行）はまだ機能ではないので、充足を判定しない。
    placeholder: def.fillPath === "—" && def.movable === "—",
    judgement: judgeFunction(observations, def.no, asOf, { thinRecord }),
  }));

  // 人の一覧。同じ人が複数のテーブルに出るので名前で束ねる（SU側の登録を優先）。
  const byName = new Map<string, OrgMember>();
  const put = (member: OrgMember) => {
    const existing = byName.get(member.name);
    if (!existing) {
      byName.set(member.name, member);
      return;
    }
    byName.set(member.name, {
      ...existing,
      affiliation: existing.affiliation ?? member.affiliation,
      role: existing.role ?? member.role,
      note: existing.note ?? member.note,
      lastSeen:
        existing.lastSeen && member.lastSeen
          ? existing.lastSeen > member.lastSeen
            ? existing.lastSeen
            : member.lastSeen
          : (existing.lastSeen ?? member.lastSeen),
      // 片方でも生きているなら生きている扱いにする。
      status: STATUS_ORDER[existing.status] <= STATUS_ORDER[member.status] ? existing.status : member.status,
      sources: Array.from(new Set([...existing.sources, ...member.sources])),
    });
  };

  for (const row of ventureRes.data ?? []) {
    put({
      name: row.full_name as string,
      affiliation: null,
      role: (row.role as string | null) ?? null,
      group: VENTURE_GROUP[(row.member_kind as string) ?? ""] ?? "other",
      status: row.ended_at ? "inactive" : "active",
      note: (row.note as string | null) ?? null,
      lastSeen: (row.started_at as string | null) ?? null,
      sources: ["SUメンバー"],
    });
  }
  for (const row of foundingRes.data ?? []) {
    const raw = (row.status as string) ?? "unknown";
    put({
      name: row.person_name as string,
      affiliation: (row.affiliation as string | null) ?? null,
      role: ((row.role_label_jp as string | null) ?? (row.role as string | null)) ?? null,
      group: FOUNDING_GROUP[(row.category as string) ?? ""] ?? "other",
      status: raw === "active" ? "active" : raw === "tentative" ? "tentative" : "inactive",
      note: (row.responsibility as string | null) ?? null,
      lastSeen: (row.last_observed_at as string | null) ?? null,
      sources: ["関連メンバー抽出"],
    });
  }

  const members = Array.from(byName.values()).sort((a, b) => {
    if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    const ga = GROUP_ORDER.indexOf(a.group);
    const gb = GROUP_ORDER.indexOf(b.group);
    if (ga !== gb) return ga - gb;
    return (b.lastSeen ?? "").localeCompare(a.lastSeen ?? "");
  });

  const roleSlots: OrgRoleSlot[] = (rolesRes.data ?? []).map((row) => ({
    roleName: row.role_name as string,
    candidate: (row.candidate as string | null) ?? null,
    joinCondition: (row.join_condition as string | null) || null,
    dueDate: (row.due_date as string | null) ?? null,
    vacant: Boolean(row.vacancy),
  }));

  return NextResponse.json(
    { ok: true as const, asOf, thinRecord, functions, observations, members, roleSlots },
    { headers: { "Cache-Control": CACHE_CONTROL } },
  );
}
