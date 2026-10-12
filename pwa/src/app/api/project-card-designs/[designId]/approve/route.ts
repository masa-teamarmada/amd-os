import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOriginWorkspaceMutation } from "@/lib/workspace-mutation-origin";
import {
  amieCardAccess,
  amieCardCanEdit,
  amieInvalidateCardCache,
} from "@/lib/project-card-designs-server";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ designId: string }> },
) {
  if (!isSameOriginWorkspaceMutation(request))
    return NextResponse.json(
      { error: "この画面から承認してください" },
      { status: 403 },
    );
  const member = await amieCardAccess();
  if (!member)
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  const { designId } = await params;
  const db = createAdminClient();
  const { data: design } = await db
    .from("project_card_designs")
    .select("owner_project_id")
    .eq("design_id", designId)
    .maybeSingle();
  if (!design || !amieCardCanEdit(member, design.owner_project_id))
    return NextResponse.json({ error: "承認権限がありません" }, { status: 403 });
  const p = await request.json().catch(() => null);
  if (
    !p ||
    p.print_verified !== true ||
    !Number.isInteger(p.expected_version) ||
    !p.version_id
  )
    return NextResponse.json(
      { error: "表裏・文字・塗り足しを確認してください" },
      { status: 400 },
    );
  const { error } = await db.rpc("amie_approve_card_version", {
    p_design_id: designId,
    p_version_id: p.version_id,
    p_expected: p.expected_version,
    p_actor: member.memberId,
  });
  if (error)
    return NextResponse.json(
      {
        error:
          error.code === "40001"
            ? "他の利用者が更新しました。最新の版を読み込んでください"
            : "入稿用の表裏と確認PDFを登録してください",
      },
      { status: error.code === "40001" ? 409 : 400 },
    );
  amieInvalidateCardCache();
  return NextResponse.json({ ok: true });
}
