import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  loadBusinessCardProjects,
  mapBusinessCards,
  normalizeEmail,
  normalizePhone,
  requireAmdMember,
  type BusinessCardRow,
} from "@/lib/business-card-server";
import { extractBusinessCard } from "@/lib/business-card-ocr";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "business-cards";
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : "unknown";
}

function safeFileName(value: string): string {
  return value.replace(/[\u0000-\u001f/\\]/g, "_").slice(0, 240);
}

function datePath() {
  const date = new Date();
  return `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function authenticate() {
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false as const, response: auth.errorResponse };
  const admin = createAdminClient();
  const member = await requireAmdMember(admin, auth.user.email);
  if (!member) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const, auth, admin, member };
}

export async function GET(request: Request) {
  try {
    const access = await authenticate();
    if (!access.ok) return access.response;

    const url = new URL(request.url);
    const query = (url.searchParams.get("q") || "").trim().toLowerCase();
    const projectId = (url.searchParams.get("project_id") || "").trim();
    const status = (url.searchParams.get("status") || "").trim();

    const { data, error } = await access.admin
      .from("business_cards")
      .select("*")
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(250);
    if (error) throw error;

    const cards = await mapBusinessCards(
      access.admin,
      (data ?? []) as BusinessCardRow[],
    );
    const filtered = cards.filter((card) => {
      if (status && status !== "all" && card.status !== status) return false;
      if (projectId && !card.projects.some((project) => project.projectId === projectId)) {
        return false;
      }
      if (!query) return true;
      return [
        card.fullName,
        card.fullNameKana,
        card.companyName,
        card.department,
        card.jobTitle,
        card.email,
        card.phone,
        card.mobile,
      ].some((value) => value.toLowerCase().includes(query));
    });
    const projects = await loadBusinessCardProjects(access.admin);

    return NextResponse.json({
      ok: true,
      cards: filtered.slice(0, 120),
      projects,
      counts: {
        total: cards.length,
        needsReview: cards.filter((card) => card.status === "needs_review" || card.status === "ocr_failed").length,
        confirmed: cards.filter((card) => card.status === "confirmed").length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const access = await authenticate();
    if (!access.ok) return access.response;
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "名刺画像を選んでね" },
        { status: 400 },
      );
    }
    const extension = CONTENT_TYPES[file.type];
    if (!extension) {
      return NextResponse.json(
        { ok: false, error: "JPEG / PNG / WebP の画像を使ってね" },
        { status: 400 },
      );
    }
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "画像は4MB以内にしてね" },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const cardId = randomUUID();
    const storagePath = `${datePath()}/${cardId}.${extension}`;
    const imageSha256 = createHash("sha256").update(bytes).digest("hex");
    const { error: uploadError } = await access.admin.storage
      .from(BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: false,
        cacheControl: "3600",
      });
    if (uploadError) throw uploadError;

    const now = new Date().toISOString();
    const { data: inserted, error: insertError } = await access.admin
      .from("business_cards")
      .insert({
        id: cardId,
        status: "processing",
        storage_bucket: BUCKET,
        storage_path: storagePath,
        original_file_name: safeFileName(file.name || `business-card.${extension}`),
        mime_type: file.type,
        file_size_bytes: bytes.length,
        image_sha256: imageSha256,
        captured_at: now,
        met_on: now.slice(0, 10),
        created_by_user_id: access.auth.user.id,
        created_by_email: access.member.email,
        updated_by_email: access.member.email,
      })
      .select("*")
      .single();
    if (insertError || !inserted) {
      await access.admin.storage.from(BUCKET).remove([storagePath]);
      throw insertError || new Error("名刺台帳の作成に失敗したよ");
    }

    let ocrWarning = "";
    try {
      const ocr = await extractBusinessCard({
        admin: access.admin,
        bytes,
        mimeType: file.type,
      });
      const normalizedPhone = normalizePhone(ocr.mobile) || normalizePhone(ocr.phone);
      const { error: updateError } = await access.admin
        .from("business_cards")
        .update({
          full_name: ocr.fullName || null,
          full_name_kana: ocr.fullNameKana || null,
          company_name: ocr.companyName || null,
          department: ocr.department || null,
          job_title: ocr.jobTitle || null,
          email: ocr.email || null,
          normalized_email: normalizeEmail(ocr.email),
          phone: ocr.phone || null,
          mobile: ocr.mobile || null,
          normalized_phone: normalizedPhone,
          postal_code: ocr.postalCode || null,
          address: ocr.address || null,
          website: ocr.website || null,
          raw_ocr_text: ocr.rawText || null,
          field_confidence: ocr.fieldConfidence,
          ocr_confidence: ocr.confidence,
          ocr_model: ocr.model,
          ocr_error: null,
          status: "needs_review",
          updated_at: new Date().toISOString(),
          updated_by_email: access.member.email,
        })
        .eq("id", cardId);
      if (updateError) throw updateError;
    } catch (error) {
      ocrWarning = errorMessage(error);
      const { error: failureUpdateError } = await access.admin
        .from("business_cards")
        .update({
          status: "ocr_failed",
          ocr_error: ocrWarning,
          updated_at: new Date().toISOString(),
          updated_by_email: access.member.email,
        })
        .eq("id", cardId);
      if (failureUpdateError) throw failureUpdateError;
    }

    const { data: cardRow, error: cardError } = await access.admin
      .from("business_cards")
      .select("*")
      .eq("id", cardId)
      .single();
    if (cardError || !cardRow) throw cardError || new Error("名刺を再取得できなかったよ");
    const [card] = await mapBusinessCards(access.admin, [cardRow as BusinessCardRow]);

    const duplicateFilters = [
      normalizeEmail(card.email),
      normalizePhone(card.mobile) || normalizePhone(card.phone),
    ].filter(Boolean) as string[];
    let duplicateCount = 0;
    if (duplicateFilters.length > 0) {
      const { data: existing } = await access.admin
        .from("business_cards")
        .select("id,normalized_email,normalized_phone")
        .neq("id", cardId)
        .neq("status", "archived")
        .limit(100);
      duplicateCount = (existing ?? []).filter((row) =>
        duplicateFilters.includes(String(row.normalized_email || "")) ||
        duplicateFilters.includes(String(row.normalized_phone || "")),
      ).length;
    }

    return NextResponse.json({
      ok: true,
      card,
      duplicateCount,
      warning: ocrWarning || null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: 500 },
    );
  }
}
