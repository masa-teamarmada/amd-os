import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const RECEIPT_BUCKET = "reimbursement-receipts";
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_RECEIPT_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const CATEGORIES = new Set(["transport", "lodging", "supplies", "meal", "other"]);
const TRANSPORT_MODES = new Set(["train", "bus", "taxi", "car", "other"]);

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    const email = user?.email?.toLowerCase() ?? "";
    if (userError || !user || !email) {
      return NextResponse.json({ error: "ログイン情報が取れなかった" }, { status: 401 });
    }

    const form = await request.formData();
    const mode = readText(form, "mode") === "update" ? "update" : "create";
    const reimbursementId = readText(form, "reimbursement_id") || crypto.randomUUID();
    const projectId = readText(form, "project_id");
    const projectName = readText(form, "project_name") || projectId;
    const date = readText(form, "date");
    const category = normalizeValue(readText(form, "category"), CATEGORIES, "other");
    const amount = Number(readText(form, "amount").replace(/,/g, ""));
    const taxRate = Number(readText(form, "tax_rate"));
    const description = readText(form, "description").trim();
    const transportMode = normalizeValue(readText(form, "transport_mode"), TRANSPORT_MODES, "train");
    const transportFrom = readText(form, "transport_from").trim();
    const transportTo = readText(form, "transport_to").trim();
    const transportTrip = readText(form, "transport_trip") === "round" ? "round" : "oneway";
    const files = form.getAll("receipts").filter((entry): entry is File => entry instanceof File && entry.size > 0);

    const validation = validateInput({
      projectId,
      date,
      description,
      category,
      amount,
      taxRate,
      transportFrom,
      transportTo,
      files,
    });
    if (validation) return NextResponse.json({ error: validation }, { status: 400 });

    const admin = createAdminClient();
    let existingPaths: string[] = [];
    let existingNames: string[] = [];

    if (mode === "update") {
      const { data: existing, error: existingError } = await admin
        .from("reimbursements")
        .select("created_by, status, receipt_storage_paths, receipt_file_names")
        .eq("reimbursement_id", reimbursementId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing) return NextResponse.json({ error: "対象の立替が見つからなかった" }, { status: 404 });
      if (String(existing.created_by ?? "").toLowerCase() !== email) {
        return NextResponse.json({ error: "自分の申請だけ編集できる" }, { status: 403 });
      }
      if (String(existing.status ?? "") !== "submitted") {
        return NextResponse.json({ error: "submitted の申請だけ編集できる" }, { status: 409 });
      }
      existingPaths = stringArray(existing.receipt_storage_paths);
      existingNames = stringArray(existing.receipt_file_names);
    }

    const uploaded = await uploadReceiptFiles(admin, user.id, reimbursementId, files);
    const now = new Date().toISOString();
    const finalAmount = category === "transport" && transportTrip === "round" ? amount * 2 : amount;
    const row = {
      reimbursement_id: reimbursementId,
      project_id: projectId,
      project_name: projectName,
      date,
      category,
      amount: finalAmount,
      tax_rate: Number.isFinite(taxRate) ? taxRate : 0.1,
      description,
      transport_mode: category === "transport" ? transportMode : null,
      transport_from: category === "transport" ? transportFrom : null,
      transport_to: category === "transport" ? transportTo : null,
      transport_trip: category === "transport" ? transportTrip : null,
      receipt_storage_paths: [...existingPaths, ...uploaded.paths],
      receipt_file_names: [...existingNames, ...uploaded.names],
      updated_at: now,
    };

    const result = mode === "update"
      ? await admin
          .from("reimbursements")
          .update(row)
          .eq("reimbursement_id", reimbursementId)
          .eq("created_by", email)
          .eq("status", "submitted")
          .select("reimbursement_id")
          .maybeSingle()
      : await admin
          .from("reimbursements")
          .insert({ ...row, status: "submitted", created_by: email, created_at: now })
          .select("reimbursement_id")
          .maybeSingle();

    if (result.error) {
      if (uploaded.paths.length > 0) {
        await admin.storage.from(RECEIPT_BUCKET).remove(uploaded.paths);
      }
      throw result.error;
    }

    return NextResponse.json({
      ok: true,
      reimbursement_id: result.data?.reimbursement_id ?? reimbursementId,
      mode,
    });
  } catch (error) {
    console.error("[api/reimbursements] save failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "立替申請の保存に失敗した" },
      { status: 500 }
    );
  }
}

function readText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function normalizeValue(value: string, allowed: Set<string>, fallback: string) {
  return allowed.has(value) ? value : fallback;
}

function validateInput(input: {
  projectId: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  taxRate: number;
  transportFrom: string;
  transportTo: string;
  files: File[];
}) {
  if (!input.projectId) return "PJを選んで";
  if (!input.date) return "発生日を入れて";
  if (!input.description) return "摘要を入れて";
  if (!Number.isFinite(input.amount) || input.amount <= 0) return "金額は0より大きくして";
  if (!Number.isFinite(input.taxRate)) return "税率を選んで";
  if (input.category === "transport") {
    if (!input.transportFrom) return "出発を入れて";
    if (!input.transportTo) return "到着を入れて";
  }
  for (const file of input.files) {
    const type = file.type || contentTypeFromName(file.name);
    if (file.size > MAX_RECEIPT_BYTES) return `${file.name} が10MBを超えてる`;
    if (!ACCEPTED_RECEIPT_TYPES.has(type)) return `${file.name} はPNG/JPEG/WebP/PDFだけ対応`;
  }
  return null;
}

async function uploadReceiptFiles(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  reimbursementId: string,
  files: File[]
) {
  const paths: string[] = [];
  const names: string[] = [];
  for (const [index, file] of files.entries()) {
    const safeName = safeFileName(file.name);
    const path = `${userId}/${reimbursementId}/${Date.now()}-${index}-${safeName}`;
    const body = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage.from(RECEIPT_BUCKET).upload(path, body, {
      cacheControl: "3600",
      contentType: file.type || contentTypeFromName(file.name),
      upsert: false,
    });
    if (error) {
      if (paths.length > 0) await admin.storage.from(RECEIPT_BUCKET).remove(paths);
      throw error;
    }
    paths.push(path);
    names.push(file.name);
  }
  return { paths, names };
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function safeFileName(name: string) {
  return name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 120) || "receipt";
}

function contentTypeFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}
