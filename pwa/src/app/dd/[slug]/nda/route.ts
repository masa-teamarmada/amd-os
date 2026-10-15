import { NextResponse } from "next/server";
import { resolveDdPackageAccess } from "@/lib/dd-access";
import { loadDdNdaContext, recordDdNdaConfirmation } from "@/lib/dd-nda-server";
import { isSameOriginWorkspaceMutation } from "@/lib/workspace-mutation-origin";
export const dynamic = "force-dynamic";
const respond = (status: number) => NextResponse.json({ ok: false }, { status, headers: { "Cache-Control": "private, no-store" } });
function notFound() { return respond(404); }
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!isSameOriginWorkspaceMutation(request)) return respond(403);
  const { slug } = await params;
  const access = await resolveDdPackageAccess(slug, { requireNdaConfirmation: false });
  if (!access) return notFound();
  const body = await request.json().catch(() => null);
  if (body?.answer !== "yes") return respond(400);
  try {
    const context = await loadDdNdaContext(access);
    if (body.version !== context.version || body.promptHash !== context.promptHash) return respond(409);
    // 保存済みの回答が次回以降の確認元。保存失敗時は入場を閉じる。
    await recordDdNdaConfirmation(access, context);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return respond(500); }
}
