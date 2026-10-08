import { NextResponse } from "next/server";
import { resolveDdPackageAccess } from "@/lib/dd-access";
import { recordDdAccessEvent } from "@/lib/dd-package-server";
import { DD_CONFIDENTIALITY_VERSION } from "@/lib/dd-confidentiality";
import { isSameOriginWorkspaceMutation } from "@/lib/workspace-mutation-origin";
export const dynamic = "force-dynamic";
function notFound() { return NextResponse.json({ ok: false }, { status: 404, headers: { "Cache-Control": "no-store" } }); }

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!isSameOriginWorkspaceMutation(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const { slug } = await params;
  const access = await resolveDdPackageAccess(slug);
  if (!access) return notFound();
  const body = await request.json().catch(() => null);
  if (body?.noticeVersion !== DD_CONFIDENTIALITY_VERSION) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    await recordDdAccessEvent(access, "dd_confidentiality_confirmed");
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ ok: false }, { status: 500 }); }
}
