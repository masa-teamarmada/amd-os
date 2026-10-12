import { NextResponse } from "next/server";
import { resolveDdPackageAccess } from "@/lib/dd-access";
import { loadDdNdaContext, createDdNdaSession, ddNdaCookieName, recordDdNdaConfirmation } from "@/lib/dd-nda-server";
import { DD_NDA_SESSION_MAX_AGE } from "@/lib/dd-nda-session-core";
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
    // 署名作成が失敗したら記録だけを残さない。保存失敗時はcookieを出さず入場も閉じる。
    const ticket = createDdNdaSession(access, context);
    await recordDdNdaConfirmation(access, context);
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
    response.cookies.set(ddNdaCookieName(access), ticket, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: DD_NDA_SESSION_MAX_AGE });
    return response;
  } catch { return respond(500); }
}
