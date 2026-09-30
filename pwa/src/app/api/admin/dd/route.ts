// DDパッケージの管理 API（AMD admin 限定）。
//
// 守ること（scripts/check_dd_package_contract.mjs で検査する）:
//   1. すべての操作は requireAdmin() と同一サイト確認のあとに、service_role（createAdminClient）で読み書きする。
//   2. action を明示させる。何でも受け付ける upsert の経路は作らない。
//   3. 公開は「公開中にする／やめる」の切り替え（setDdItemPublished）だけ。画面から中身（payload）は受け取らない。
//      中身は閲覧のたびに元データの最新から作る（2026-09-30 まさ「中身を変えたらちゃんと変わるように」）。
//   4. 付与の作成で、停止・失効した付与を復活させない。戻すのは update_grant の明示の status 変更だけ。
//   5. DD の付与はワークスペースの所属（project_access_memberships 等）を作らない。
//   6. 要秘匿（confidential）の技術台帳ページは、acknowledgeConfidential=true の明示なしに追加しない。
//   7. 正式版（PDF）の出力の記録（record_export）は、サーバが公開中の項目と元データの更新日時を読み直して残す
//      （画面から送られた一覧は使わない）。
//   8. GET は管理画面（コックピット・ワークスペースの「DDパッケージ」タブ）の読み取り。可変系なので毎回読む（no-store）。

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { isSameOriginWorkspaceMutation } from "@/lib/workspace-mutation-origin";
import { recordWorkspaceAuditEvent } from "@/lib/workspace-access-audit";
import { normalizeWorkspaceEmail } from "@/lib/workspace-email";
import {
  isDdSectionKey,
  isUuid,
  normalizeDdCapabilities,
  normalizeDdUnverifiedNotes,
  type DdGrantStatus,
  type DdPackageStatus,
} from "@/lib/dd-package-core";
import { isDdItemKind } from "@/lib/dd-payload";
import { DdSourceError, isSourceKeyForKind, listDdSourceCandidates } from "@/lib/dd-sources";
import {
  loadDdAdminState,
  loadDdItem,
  loadDdPackageRow,
  loadDdPublishedLive,
  recordDdPackageExport,
  setDdItemPublished,
} from "@/lib/dd-package-server";
import { invalidateDdPackageSummaryCache } from "@/lib/dd-package-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = Record<string, unknown>;

const PACKAGE_STATUSES = new Set<DdPackageStatus>(["draft", "open", "closed"]);
const GRANT_STATUSES = new Set<DdGrantStatus>(["invited", "active", "suspended", "revoked"]);
const GRANT_CREATE_STATUSES = new Set<DdGrantStatus>(["invited", "active"]);

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

function ok(body: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...body }, { headers: { "Cache-Control": "no-store" } });
}

function failed(error: string, cause: unknown) {
  console.error(`[admin/dd] ${error}:`, cause instanceof Error ? cause.message : String(cause));
  return NextResponse.json({ ok: false, error }, { status: 500, headers: { "Cache-Control": "no-store" } });
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function has(body: Body, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

async function readBody(request: Request): Promise<Body | null> {
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Body) : null;
  } catch {
    return null;
  }
}

async function actorMemberId(email: string): Promise<string | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("members")
    .select("member_id,is_admin,status")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (!data?.member_id || !data.is_admin || data.status !== "active") return null;
  return String(data.member_id);
}

async function audit(projectId: string | null, detail: Record<string, string | number | boolean | null>) {
  await recordWorkspaceAuditEvent(createAdminClient(), {
    eventType: "admin_dd_mutation",
    projectId,
    detail,
  });
}

/** GET /api/admin/dd?projectId=p21 … 管理画面の中身（パッケージ・掲載項目・閲覧権限・閲覧記録・PDF出力の記録・追加できる元データ）。 */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() ?? "";
  if (!projectId || projectId.length > 160) return bad("invalid_project");
  try {
    const [state, candidates] = await Promise.all([loadDdAdminState(projectId), listDdSourceCandidates(projectId)]);
    return ok({ state, candidates: state ? candidates : [] });
  } catch (error) {
    return failed("load_failed", error);
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  if (!isSameOriginWorkspaceMutation(request)) return bad("same_origin_required", 403);
  const body = await readBody(request);
  if (!body) return bad("invalid_body");
  const actor = await actorMemberId(auth.user.email);
  if (!actor) return bad("admin_member_required", 403);

  const action = typeof body.action === "string" ? body.action : "";
  try {
    switch (action) {
      case "add_item":
        return await addItem(body, actor);
      case "update_item":
        return await updateItem(body, actor);
      case "publish_item":
        return await publishItem(body, actor);
      case "withdraw_item":
        return await withdrawItem(body, actor);
      case "archive_item":
        return await setItemStatus(body, actor, "archived");
      case "restore_item":
        return await setItemStatus(body, actor, "active");
      case "update_package":
        return await updatePackage(body, actor);
      case "create_grant":
        return await createGrant(body, actor);
      case "update_grant":
        return await updateGrant(body, actor);
      case "record_export":
        return await recordExport(body, auth.user.email);
      default:
        return bad("unknown_action");
    }
  } catch (error) {
    if (error instanceof DdSourceError) return bad(error.message, 422);
    return failed(`${action}_failed`, error);
  }
}

async function loadPackageRow(packageId: string) {
  const db = createAdminClient();
  const { data, error } = await db.from("dd_packages").select("id,project_id,status").eq("id", packageId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; project_id: string; status: DdPackageStatus } | null;
}

async function addItem(body: Body, actor: string) {
  const packageId = text(body.packageId, 64);
  const itemKind = body.itemKind;
  const sourceKey = text(body.sourceKey, 300);
  const sectionKey = body.sectionKey;
  if (!packageId || !isUuid(packageId) || !isDdItemKind(itemKind) || !sourceKey || !isDdSectionKey(sectionKey)) {
    return bad("invalid_item");
  }
  if (!isSourceKeyForKind(itemKind, sourceKey)) return bad("invalid_source_key");
  const pkg = await loadPackageRow(packageId);
  if (!pkg) return bad("package_not_found", 404);

  // 元データが同じPJに実在し、DDに載せられる形かを候補一覧で確かめる（別PJのIDを指定させない）。
  const candidates = await listDdSourceCandidates(pkg.project_id);
  const candidate = candidates.find((row) => row.itemKind === itemKind && row.sourceKey === sourceKey);
  if (!candidate) return bad("source_not_found", 404);
  if (candidate.blockedReason) return bad(candidate.blockedReason, 422);
  if (candidate.confidentiality === "confidential" && body.acknowledgeConfidential !== true) {
    return bad("confidential_requires_acknowledgement", 422);
  }

  const db = createAdminClient();
  const { data: last } = await db
    .from("dd_package_items")
    .select("sort_order")
    .eq("package_id", pkg.id)
    .eq("section_key", sectionKey)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const title = text(body.title, 200) ?? candidate.title.slice(0, 200);
  const { data, error } = await db
    .from("dd_package_items")
    .insert({
      package_id: pkg.id,
      project_id: pkg.project_id,
      section_key: sectionKey,
      item_kind: itemKind,
      source_key: sourceKey,
      title,
      sort_order: Number(last?.sort_order ?? 0) + 10,
      created_by_member_id: actor,
      updated_by_member_id: actor,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return bad("already_added", 409);
    throw new Error(error.message);
  }
  await audit(pkg.project_id, { action: "add_item", item_id: String(data.id), item_kind: itemKind, section_key: sectionKey });
  return ok({ itemId: data.id });
}

function normalizeSourceOptions(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const options: Record<string, unknown> = {};
  if (has(input, "autoUnverified")) {
    if (typeof input.autoUnverified !== "boolean") return null;
    options.autoUnverified = input.autoUnverified;
  }
  return options;
}

async function updateItem(body: Body, actor: string) {
  const itemId = text(body.itemId, 64);
  if (!itemId || !isUuid(itemId)) return bad("invalid_item");
  const item = await loadDdItem(itemId);
  if (!item) return bad("item_not_found", 404);

  const patch: Record<string, unknown> = { updated_by_member_id: actor };
  if (has(body, "sectionKey")) {
    if (!isDdSectionKey(body.sectionKey)) return bad("invalid_section");
    patch.section_key = body.sectionKey;
  }
  if (has(body, "title")) {
    const title = text(body.title, 200);
    if (!title) return bad("title_required");
    patch.title = title;
  }
  if (has(body, "summary")) patch.summary = text(body.summary, 1000);
  if (has(body, "unverifiedNotes")) patch.unverified_notes = normalizeDdUnverifiedNotes(body.unverifiedNotes);
  if (has(body, "sortOrder")) {
    const sortOrder = Number(body.sortOrder);
    if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 1_000_000) return bad("invalid_sort_order");
    patch.sort_order = sortOrder;
  }
  if (has(body, "sourceOptions")) {
    const options = normalizeSourceOptions(body.sourceOptions);
    if (!options) return bad("invalid_source_options");
    patch.source_options = { ...(item.source_options ?? {}), ...options };
  }
  if (has(body, "evidenceItemIds")) {
    const raw = Array.isArray(body.evidenceItemIds) ? body.evidenceItemIds : null;
    if (!raw || raw.length > 30 || !raw.every(isUuid)) return bad("invalid_evidence");
    const ids = Array.from(new Set(raw as string[])).filter((id) => id !== item.id);
    if (ids.length > 0) {
      const db = createAdminClient();
      const { data, error } = await db
        .from("dd_package_items")
        .select("id")
        .eq("package_id", item.package_id)
        .eq("item_kind", "document")
        .in("id", ids);
      if (error) throw new Error(error.message);
      if ((data ?? []).length !== ids.length) return bad("evidence_must_be_documents_in_same_package", 422);
    }
    patch.evidence_item_ids = ids;
  }

  const db = createAdminClient();
  const { error } = await db.from("dd_package_items").update(patch).eq("id", item.id);
  if (error) throw new Error(error.message);
  await audit(item.project_id, { action: "update_item", item_id: item.id });
  return ok();
}

async function publishItem(body: Body, actor: string) {
  const itemId = text(body.itemId, 64);
  if (!itemId || !isUuid(itemId)) return bad("invalid_item");
  const item = await loadDdItem(itemId);
  if (!item) return bad("item_not_found", 404);
  if (item.status !== "active") return bad("item_archived", 409);
  await setDdItemPublished(item.id, true, actor);
  await audit(item.project_id, { action: "publish_item", item_id: item.id });
  return ok();
}

async function withdrawItem(body: Body, actor: string) {
  const itemId = text(body.itemId, 64);
  if (!itemId || !isUuid(itemId)) return bad("invalid_item");
  const item = await loadDdItem(itemId);
  if (!item) return bad("item_not_found", 404);
  await setDdItemPublished(item.id, false, actor);
  await audit(item.project_id, { action: "withdraw_item", item_id: item.id });
  return ok();
}

async function recordExport(body: Body, actorEmail: string) {
  const packageId = text(body.packageId, 64);
  if (!packageId || !isUuid(packageId)) return bad("invalid_package");
  const pkg = await loadDdPackageRow(packageId);
  if (!pkg) return bad("package_not_found", 404);
  const loaded = await loadDdPublishedLive(pkg.id);
  await recordDdPackageExport({
    pkg,
    actorEmail,
    items: loaded.map(({ row, meta }) => ({ itemId: row.id, sourceAsOf: meta.sourceAsOf })),
  });
  return ok({ itemCount: loaded.length });
}

async function setItemStatus(body: Body, actor: string, status: "active" | "archived") {
  const itemId = text(body.itemId, 64);
  if (!itemId || !isUuid(itemId)) return bad("invalid_item");
  const item = await loadDdItem(itemId);
  if (!item) return bad("item_not_found", 404);
  const db = createAdminClient();
  const patch: Record<string, unknown> = { status, updated_by_member_id: actor };
  // 外す項目は、先に公開をやめる（DB の制約でも保証している）。戻しても非公開のまま。
  if (status === "archived") patch.is_published = false;
  const { error } = await db.from("dd_package_items").update(patch).eq("id", item.id);
  if (error) throw new Error(error.message);
  await audit(item.project_id, { action: status === "archived" ? "archive_item" : "restore_item", item_id: item.id });
  return ok();
}

async function updatePackage(body: Body, actor: string) {
  const packageId = text(body.packageId, 64);
  if (!packageId || !isUuid(packageId)) return bad("invalid_package");
  const pkg = await loadPackageRow(packageId);
  if (!pkg) return bad("package_not_found", 404);
  const patch: Record<string, unknown> = { updated_by_member_id: actor };
  if (has(body, "status")) {
    if (typeof body.status !== "string" || !PACKAGE_STATUSES.has(body.status as DdPackageStatus)) return bad("invalid_status");
    patch.status = body.status;
  }
  if (has(body, "title")) {
    const title = text(body.title, 200);
    if (!title) return bad("title_required");
    patch.title = title;
  }
  if (has(body, "noticeText")) patch.notice_text = text(body.noticeText, 2000);
  const db = createAdminClient();
  const { error } = await db.from("dd_packages").update(patch).eq("id", pkg.id);
  if (error) throw new Error(error.message);
  invalidateDdPackageSummaryCache();
  await audit(pkg.project_id, {
    action: "update_package",
    package_id: pkg.id,
    status: typeof patch.status === "string" ? patch.status : null,
  });
  return ok();
}

function parseExpiresAt(raw: unknown): { ok: true; value: string | null } | { ok: false } {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false };
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return { ok: false };
  return { ok: true, value: new Date(ms).toISOString() };
}

async function createGrant(body: Body, actor: string) {
  const packageId = text(body.packageId, 64);
  if (!packageId || !isUuid(packageId)) return bad("invalid_package");
  const pkg = await loadPackageRow(packageId);
  if (!pkg) return bad("package_not_found", 404);
  const email = normalizeWorkspaceEmail(body.email);
  if (!email) return bad("invalid_email");
  const capabilities = normalizeDdCapabilities(body.capabilities);
  if (!capabilities.includes("dd.view")) return bad("dd_view_required");
  const expires = parseExpiresAt(body.expiresAt);
  if (!expires.ok) return bad("invalid_expires_at");

  const db = createAdminClient();
  const { data: existingAccount, error: accountError } = await db
    .from("workspace_user_accounts")
    .select("id,status")
    .eq("email_normalized", email)
    .maybeSingle();
  if (accountError) throw new Error(accountError.message);

  let account = existingAccount as { id: string; status: string } | null;
  if (!account) {
    // アカウントは明示の指示（createAccount=true）があるときだけ作る。作っても通知メールは送らない。
    if (body.createAccount !== true) return bad("unknown_account", 404);
    const { data: created, error: createError } = await db
      .from("workspace_user_accounts")
      .insert({ email, status: "invited" })
      .select("id,status")
      .single();
    if (createError) throw new Error(createError.message);
    account = created as { id: string; status: string };
  }
  if (account.status === "suspended") return bad("account_suspended", 409);

  const requestedStatus = typeof body.status === "string" ? (body.status as DdGrantStatus) : null;
  if (requestedStatus && !GRANT_CREATE_STATUSES.has(requestedStatus)) return bad("invalid_status");
  const status: DdGrantStatus = requestedStatus ?? (account.status === "active" ? "active" : "invited");

  const { data, error } = await db
    .from("dd_package_grants")
    .insert({
      package_id: pkg.id,
      project_id: pkg.project_id,
      user_account_id: account.id,
      status,
      capabilities,
      organization_name: text(body.organizationName, 200),
      note: text(body.note, 1000),
      expires_at: expires.value,
      granted_by_member_id: actor,
      updated_by_member_id: actor,
    })
    .select("id")
    .single();
  if (error) {
    // 既存の付与（停止・失効を含む）は作成では復活させない。戻すのは update_grant の明示の変更だけ。
    if (error.code === "23505") return bad("grant_already_exists", 409);
    throw new Error(error.message);
  }
  await audit(pkg.project_id, { action: "create_grant", grant_id: String(data.id), status, download: capabilities.includes("dd.download") });
  return ok({ grantId: data.id });
}

async function updateGrant(body: Body, actor: string) {
  const grantId = text(body.grantId, 64);
  if (!grantId || !isUuid(grantId)) return bad("invalid_grant");
  const db = createAdminClient();
  const { data: grant, error: grantError } = await db
    .from("dd_package_grants")
    .select("id,project_id,status")
    .eq("id", grantId)
    .maybeSingle();
  if (grantError) throw new Error(grantError.message);
  if (!grant) return bad("grant_not_found", 404);

  const patch: Record<string, unknown> = { updated_by_member_id: actor };
  if (has(body, "status")) {
    if (typeof body.status !== "string" || !GRANT_STATUSES.has(body.status as DdGrantStatus)) return bad("invalid_status");
    patch.status = body.status;
  }
  if (has(body, "capabilities")) {
    const capabilities = normalizeDdCapabilities(body.capabilities);
    if (!capabilities.includes("dd.view")) return bad("dd_view_required");
    patch.capabilities = capabilities;
  }
  if (has(body, "expiresAt")) {
    const expires = parseExpiresAt(body.expiresAt);
    if (!expires.ok) return bad("invalid_expires_at");
    patch.expires_at = expires.value;
  }
  if (has(body, "organizationName")) patch.organization_name = text(body.organizationName, 200);
  if (has(body, "note")) patch.note = text(body.note, 1000);

  const { error } = await db.from("dd_package_grants").update(patch).eq("id", grant.id);
  if (error) throw new Error(error.message);
  await audit(String(grant.project_id), {
    action: "update_grant",
    grant_id: String(grant.id),
    status: typeof patch.status === "string" ? patch.status : null,
  });
  return ok();
}
