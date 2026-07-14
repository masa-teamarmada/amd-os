import { NextResponse } from "next/server";
import {
  cleanText,
  mapBusinessCards,
  normalizeEmail,
  normalizePhone,
  nullableText,
  requireAmdMember,
  syncBusinessCardKnowledge,
  type BusinessCardRow,
} from "@/lib/business-card-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : "unknown";
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ cardId: string }> },
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.errorResponse;
    const admin = createAdminClient();
    const member = await requireAmdMember(admin, auth.user.email);
    if (!member) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { cardId } = await context.params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "入力を読めなかったよ" }, { status: 400 });
    }
    const fullName = cleanText(body.fullName, 240);
    const projectIds = Array.isArray(body.projectIds)
      ? Array.from(
          new Set(
            body.projectIds
              .map((value) => cleanText(value, 80))
              .filter(Boolean),
          ),
        ).slice(0, 40)
      : [];
    if (!fullName) {
      return NextResponse.json({ ok: false, error: "氏名を確認してね" }, { status: 400 });
    }
    if (projectIds.length === 0) {
      return NextResponse.json({ ok: false, error: "紐づけるPJを1つ以上選んでね" }, { status: 400 });
    }

    const { data: current, error: currentError } = await admin
      .from("business_cards")
      .select("id,status,confirmed_at")
      .eq("id", cardId)
      .neq("status", "archived")
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) {
      return NextResponse.json({ ok: false, error: "名刺が見つからないよ" }, { status: 404 });
    }

    const email = cleanText(body.email, 320);
    const phone = cleanText(body.phone, 80);
    const mobile = cleanText(body.mobile, 80);
    const metOnText = cleanText(body.metOn, 10);
    const metOn = /^\d{4}-\d{2}-\d{2}$/.test(metOnText) ? metOnText : null;
    const cardForKnowledge = {
      fullName,
      companyName: cleanText(body.companyName, 320),
      department: cleanText(body.department, 320),
      jobTitle: cleanText(body.jobTitle, 240),
      relationshipNote: cleanText(body.relationshipNote, 1000),
      metOn: metOn || "",
    };
    const now = new Date().toISOString();
    const { error: fieldUpdateError } = await admin
      .from("business_cards")
      .update({
        full_name: fullName,
        full_name_kana: nullableText(body.fullNameKana, 240),
        company_name: nullableText(body.companyName, 320),
        department: nullableText(body.department, 320),
        job_title: nullableText(body.jobTitle, 240),
        email: email || null,
        normalized_email: normalizeEmail(email),
        phone: phone || null,
        mobile: mobile || null,
        normalized_phone: normalizePhone(mobile) || normalizePhone(phone),
        postal_code: nullableText(body.postalCode, 40),
        address: nullableText(body.address, 600),
        website: nullableText(body.website, 500),
        relationship_note: nullableText(body.relationshipNote, 1000),
        met_on: metOn,
        updated_at: now,
        updated_by_email: member.email,
      })
      .eq("id", cardId);
    if (fieldUpdateError) throw fieldUpdateError;

    await syncBusinessCardKnowledge({
      admin,
      cardId,
      projectIds,
      editorEmail: member.email,
      card: cardForKnowledge,
    });

    const { data: confirmed, error: confirmError } = await admin
      .from("business_cards")
      .update({
        status: "confirmed",
        ocr_error: null,
        confirmed_by_email: member.email,
        confirmed_at: current.confirmed_at || now,
        updated_at: now,
        updated_by_email: member.email,
      })
      .eq("id", cardId)
      .select("*")
      .single();
    if (confirmError || !confirmed) {
      throw confirmError || new Error("名刺の確定に失敗したよ");
    }
    const [card] = await mapBusinessCards(admin, [confirmed as BusinessCardRow]);
    return NextResponse.json({ ok: true, card });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: 500 },
    );
  }
}
