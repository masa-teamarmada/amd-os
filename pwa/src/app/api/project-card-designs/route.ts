import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOriginWorkspaceMutation } from "@/lib/workspace-mutation-origin";
import {
  amieCardAccess,
  amieCardCanRead,
  amieLoadCardDesigns,
  amieValidateCardAssets,
  amieInvalidateCardCache,
} from "@/lib/project-card-designs-server";
import { cardText } from "@/lib/project-card-designs";
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
function fields(raw: unknown, keys: string[]) {
  const r: Record<string, string | number | boolean> = {};
  if (raw && typeof raw === "object")
    for (const key of keys) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === "string") r[key] = cardText(v, 400);
      else if (typeof v === "number" && Number.isFinite(v)) r[key] = v;
      else if (typeof v === "boolean") r[key] = v;
    }
  return r;
}
export async function GET(request: Request) {
  const member = await amieCardAccess();
  if (!member) return reply({ error: "ログインしてください" }, 401);
  const url = new URL(request.url);
  const pid = url.searchParams.get("project_id") || undefined;
  if (url.searchParams.get("admin") === "1" && !member.isAdmin)
    return reply({ error: "管理者のみ閲覧できます" }, 403);
  if (!pid && !member.isAdmin) return reply({ error: "PJを選んでください" }, 403);
  if (pid && !amieCardCanRead(member, pid))
    return reply({ error: "閲覧権限がありません" }, 403);
  try {
    return reply(
      await amieLoadCardDesigns(
        member,
        pid,
        url.searchParams.get("fresh") === "1",
      ),
    );
  } catch {
    return reply({ error: "名刺案を読み込みに失敗しました" }, 500);
  }
}
export async function POST(request: Request) {
  if (!isSameOriginWorkspaceMutation(request))
    return reply({ error: "この画面から保存してください" }, 403);
  const member = await amieCardAccess();
  if (!member) return reply({ error: "ログインしてください" }, 401);
  const p = await request.json().catch(() => null);
  if (!p || typeof p !== "object" || JSON.stringify(p).length > 30000)
    return reply({ error: "入力を確認してください" }, 400);
  if (
    !/^[0-9a-f-]{36}$/i.test(p.request_key) ||
    !Number.isInteger(p.expected_version) ||
    p.expected_version < 0
  )
    return reply({ error: "版の情報を確認してください" }, 400);
  for (const key of [
    "holder_label",
    "holder_key",
    "variant_key",
    "brand_label",
    "revision_label",
  ])
    if (!cardText(p[key]))
      return reply({ error: "氏名・ブランド・版を入力してください" }, 400);
  if (!["draft", "review"].includes(p.status))
    return reply({ error: "新しい版は案として保存してください" }, 400);
  try {
    const checked = await amieValidateCardAssets(member, p);
    const payload = {
      ...checked,
      owner_project_id: checked.owner,
      related_project_ids: checked.related,
      holder_label: cardText(p.holder_label, 120),
      holder_key: cardText(p.holder_key, 120),
      variant_key: cardText(p.variant_key, 80),
      brand_label: cardText(p.brand_label, 120),
      revision_label: cardText(p.revision_label, 120),
      expected_version: p.expected_version,
      request_key: p.request_key,
      status: p.status,
      note: cardText(p.note, 2000),
      actor: member.memberId,
      print_spec: fields(p.print_spec, [
        "paper",
        "quantity",
        "size",
        "bleed",
        "sides",
        "finishing",
      ]),
      order_record: {},
    };
    const { data, error } = await createAdminClient().rpc(
      "amie_save_card_version",
      { p: payload },
    );
    if (error)
      return reply(
        {
          error:
            error.code === "40001"
              ? "他の利用者が更新しました。最新の版を読み込んでください"
              : "保存に失敗しました",
        },
        error.code === "40001" ? 409 : 400,
      );
    amieInvalidateCardCache();
    return reply({ ok: true, ...data });
  } catch (e) {
    return reply(
      { error: e instanceof Error ? e.message : "資料を確認できませんでした" },
      400,
    );
  }
}
