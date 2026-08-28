import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/api-auth";
import {
  buildMonthlyWorkAgreementBundle,
  currentYmJst,
  hashMonthlyAgreementSnapshot,
  isMissingMonthlyAgreementTableError,
  projectScopedSnapshot,
  resolveMemberForEmail,
} from "@/lib/monthly-work-agreement";
import type { MonthlyWorkAgreementBundle } from "@/lib/monthly-work-agreement-types";

function validYm(value: unknown): string {
  const ym = typeof value === "string" && value ? value : currentYmJst();
  if (!/^\d{6}$/.test(ym)) throw new Error("ym must be YYYYMM");
  return ym;
}

type AgreementInsert = {
  ym: string;
  member_id: string;
  project_id: string | null;
  status: "agreed";
  agreed_by: string;
  snapshot_json: unknown;
  snapshot_hash: string;
  current_hash: string;
};

/**
 * 合意はPJごとに成立させる (まさ確定 2026-08-28)。
 *
 * `projectId` を指定するとそのPJだけを保存する。指定しない場合は、まだ合意していない
 * PJをまとめて保存する。参加PJが無い月だけ、PJ単位化する前と同じ member 全体の1行を残す。
 */
function buildInserts(
  bundle: MonthlyWorkAgreementBundle,
  targetProjectId: string | null,
  agreedBy: string,
): { inserts: AgreementInsert[]; error: string | null } {
  if (bundle.projectAgreements.length === 0) {
    if (targetProjectId) return { inserts: [], error: `対象PJが見つかりません: ${targetProjectId}` };
    return {
      inserts: [
        {
          ym: bundle.ym,
          member_id: bundle.member.memberId,
          project_id: null,
          status: "agreed",
          agreed_by: agreedBy,
          snapshot_json: bundle.snapshot,
          snapshot_hash: bundle.currentHash,
          current_hash: bundle.currentHash,
        },
      ],
      error: null,
    };
  }

  const targets = targetProjectId
    ? bundle.projectAgreements.filter((item) => item.projectId === targetProjectId)
    : bundle.projectAgreements.filter((item) => item.status !== "agreed");
  if (targetProjectId && targets.length === 0) {
    return { inserts: [], error: `対象PJが見つかりません: ${targetProjectId}` };
  }

  const blocked = targets.find((item) => !item.canAgree);
  if (blocked) {
    return { inserts: [], error: blocked.blockedReason || `${blocked.projectName} には合意できません` };
  }

  const inserts: AgreementInsert[] = [];
  for (const agreement of targets) {
    const scoped = projectScopedSnapshot(bundle.snapshot, agreement.projectId);
    if (!scoped) continue;
    inserts.push({
      ym: bundle.ym,
      member_id: bundle.member.memberId,
      project_id: agreement.projectId,
      status: "agreed",
      agreed_by: agreedBy,
      snapshot_json: scoped,
      snapshot_hash: hashMonthlyAgreementSnapshot(scoped),
      current_hash: bundle.currentHash,
    });
  }
  return { inserts, error: null };
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  const body = (await req.json().catch(() => ({}))) as {
    ym?: unknown;
    memberId?: unknown;
    projectId?: unknown;
  };
  let ym: string;
  try {
    ym = validYm(body.ym);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "invalid ym" }, { status: 400 });
  }

  const admin = createAdminClient();
  const actor = await resolveMemberForEmail(admin, auth.user.email);
  if (!actor) return NextResponse.json({ ok: false, error: "member not found" }, { status: 404 });

  const memberId = typeof body.memberId === "string" && body.memberId.trim() ? body.memberId.trim() : actor.memberId;
  if (memberId !== actor.memberId) {
    return NextResponse.json({ ok: false, error: "本人以外の月次合意は保存できません" }, { status: 403 });
  }
  const projectId = typeof body.projectId === "string" && body.projectId.trim() ? body.projectId.trim() : null;

  try {
    const bundle = await buildMonthlyWorkAgreementBundle(admin, {
      ym,
      memberId,
      viewerMemberId: actor.memberId,
    });
    if (!bundle.tableReady) {
      return NextResponse.json(
        { ok: false, error: "member_monthly_work_agreements table is not ready" },
        { status: 503 },
      );
    }
    if (!bundle.canRequestRevision) {
      return NextResponse.json({ ok: false, error: "本人だけが合意できます" }, { status: 403 });
    }

    const { inserts, error: buildError } = buildInserts(bundle, projectId, actor.email || auth.user.email || "");
    if (buildError) {
      return NextResponse.json({ ok: false, error: buildError }, { status: 403 });
    }

    for (const insert of inserts) {
      const existingQuery = admin
        .from("member_monthly_work_agreements")
        .select("id")
        .eq("ym", insert.ym)
        .eq("member_id", insert.member_id)
        .eq("status", "agreed")
        .eq("snapshot_hash", insert.snapshot_hash);
      const { data: existing, error: existingError } = await (insert.project_id
        ? existingQuery.eq("project_id", insert.project_id)
        : existingQuery.is("project_id", null)
      ).maybeSingle();
      if (existingError && !isMissingMonthlyAgreementTableError(existingError)) throw existingError;
      if (existing) continue;

      // 同じPJの古い合意だけを閉じる。他のPJの合意はそのまま生かす
      const supersedeQuery = admin
        .from("member_monthly_work_agreements")
        .update({
          status: "superseded",
          invalidated_at: new Date().toISOString(),
          invalidation_reason: "new_agreement_snapshot",
          current_hash: insert.current_hash,
        })
        .eq("ym", insert.ym)
        .eq("member_id", insert.member_id)
        .eq("status", "agreed")
        .neq("snapshot_hash", insert.snapshot_hash);
      const { error: supersedeError } = await (insert.project_id
        ? supersedeQuery.eq("project_id", insert.project_id)
        : supersedeQuery.is("project_id", null));
      if (supersedeError) throw supersedeError;

      const { error: insertError } = await admin.from("member_monthly_work_agreements").insert(insert);
      if (insertError) throw insertError;
    }

    const refreshed = await buildMonthlyWorkAgreementBundle(admin, {
      ym,
      memberId,
      viewerMemberId: actor.memberId,
    });
    return NextResponse.json({ ok: true, bundle: refreshed });
  } catch (err) {
    const status = isMissingMonthlyAgreementTableError(err) ? 503 : 500;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status },
    );
  }
}
