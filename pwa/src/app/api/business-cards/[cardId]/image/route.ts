import { NextResponse } from "next/server";
import { requireAmdMember } from "@/lib/business-card-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ cardId: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;
  const admin = createAdminClient();
  const member = await requireAmdMember(admin, auth.user.email);
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { cardId } = await context.params;
  const { data: card, error } = await admin
    .from("business_cards")
    .select("storage_bucket,storage_path,mime_type,original_file_name,status")
    .eq("id", cardId)
    .neq("status", "archived")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: image, error: downloadError } = await admin.storage
    .from(String(card.storage_bucket))
    .download(String(card.storage_path));
  if (downloadError || !image) {
    return NextResponse.json(
      { error: downloadError?.message || "image not found" },
      { status: 404 },
    );
  }

  return new Response(await image.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": String(card.mime_type || "application/octet-stream"),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(String(card.original_file_name || "business-card"))}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
