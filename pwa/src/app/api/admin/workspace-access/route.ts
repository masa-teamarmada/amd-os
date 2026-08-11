// Admin-only management surface for external workspace access.
//
// Invariants enforced here (see scripts/check_workspace_access_admin_contract.mjs):
//   1. every method starts with requireAdmin() and reads/writes through createAdminClient()
//      (the 7 workspace-access tables are default-deny; service_role is the server-side path).
//   2. POST takes an explicit `kind` — there is no generic "upsert whatever you send" path.
//   3. creation never silently reactivates a stopped record. A suspended account, or a
//      suspended/revoked membership, comes back only through an explicit PATCH.
//   4. granting an institution workspace membership never creates individual PJ access.
//      The two grants are independent rows and independent admin actions.
//   5. auth.users ids are never selected or returned. The admin UI identifies people by email.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { normalizeWorkspaceEmail } from "@/lib/workspace-email";
import { recordWorkspaceAuditEvent } from "@/lib/workspace-access-audit";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- allowlists (mirror the CHECK constraints in 212_workspace_access_foundation.sql) ---

const MUTATION_KINDS = new Set(["account", "institution_membership", "project_membership"]);
const ACCOUNT_STATUSES = new Set(["invited", "active", "suspended"]);
const MEMBERSHIP_STATUSES = new Set(["invited", "active", "suspended", "revoked"]);
/** A grant is only ever created in a not-yet-usable or usable state, never pre-stopped. */
const MEMBERSHIP_CREATE_STATUSES = new Set(["invited", "active"]);
const INSTITUTION_ROLES = new Set(["owner", "member", "readonly"]);
const PROJECT_ROLES = new Set(["manager", "contributor", "readonly"]);
/** Stopped states that must not be revived by a create call. */
const STOPPED_MEMBERSHIP_STATUSES = new Set(["suspended", "revoked"]);

// Safe column sets. auth_user_id is deliberately absent from every select below.
const ACCOUNT_FIELDS = "id,email,display_name,status,last_login_at,created_at,updated_at";
const INSTITUTION_WORKSPACE_FIELDS = "id,slug,name,status,is_publicly_listed";
const INSTITUTION_MEMBERSHIP_FIELDS = "id,workspace_id,user_account_id,role,status,created_at,updated_at";
const PROJECT_MEMBERSHIP_FIELDS = "id,project_id,user_account_id,role,status,created_at,updated_at";

type Body = Record<string, unknown>;
type Db = SupabaseClient;

const LIST_PAGE_SIZE = 1000;
const LIST_MAX_ROWS = 100_000;

type ListRowsResult =
  | { data: Record<string, unknown>[]; error: null }
  | { data: null; error: { message: string } };

async function listAllRows(
  db: Db,
  table: string,
  fields: string,
  orderColumn: string,
  ascending = true,
): Promise<ListRowsResult> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < LIST_MAX_ROWS; from += LIST_PAGE_SIZE) {
    const { data, error } = await db
      .from(table)
      .select(fields)
      .order(orderColumn, { ascending })
      .range(from, from + LIST_PAGE_SIZE - 1);
    if (error) return { data: null, error };
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < LIST_PAGE_SIZE) return { data: rows, error: null };
  }
  return { data: null, error: { message: `row_limit_exceeded:${table}:${LIST_MAX_ROWS}` } };
}

// --- small helpers -----------------------------------------------------------------

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function conflict(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 409 });
}

/** Server-side detail stays in the log; the client only sees a short stable code. */
function failed(error: string, cause: { message: string }) {
  console.error(`[admin/workspace-access] ${error}:`, cause.message);
  return NextResponse.json({ ok: false, error }, { status: 500 });
}

async function readBody(request: Request): Promise<Body | null> {
  try {
    const parsed = await request.json();
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Body;
  } catch {
    return null;
  }
}

function text(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function pick(value: unknown, allowed: Set<string>): string | null {
  return typeof value === "string" && allowed.has(value) ? value : null;
}

function hasField(body: Body, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

type AccountRow = { id: string; email: string; status: string };
type ResolvedAccount =
  | { ok: true; account: AccountRow }
  | { ok: false; error: string; server: { message: string } | null };

/**
 * Resolves the target account from an explicit id or an email address. An unknown
 * email is an error — a membership grant never implicitly creates an account.
 */
async function resolveAccount(db: Db, body: Body): Promise<ResolvedAccount> {
  const accountId = text(body.accountId, 64);
  const query = db.from("workspace_user_accounts").select("id,email,status");

  if (!accountId) {
    const email = normalizeWorkspaceEmail(body.email);
    if (!email) return { ok: false, error: "invalid_email", server: null };
    const { data, error } = await query.eq("email_normalized", email).maybeSingle();
    if (error) return { ok: false, error: "account_lookup_failed", server: error };
    if (!data) return { ok: false, error: "unknown_account", server: null };
    return { ok: true, account: data as AccountRow };
  }

  const { data, error } = await query.eq("id", accountId).maybeSingle();
  if (error) return { ok: false, error: "account_lookup_failed", server: error };
  if (!data) return { ok: false, error: "unknown_account", server: null };
  return { ok: true, account: data as AccountRow };
}

// --- GET ---------------------------------------------------------------------------

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const db = createAdminClient();

  const [accounts, workspaces, institutionMemberships, projects, projectMemberships] = await Promise.all([
    listAllRows(db, "workspace_user_accounts", ACCOUNT_FIELDS, "created_at", false),
    listAllRows(db, "institution_workspaces", INSTITUTION_WORKSPACE_FIELDS, "name"),
    listAllRows(db, "institution_workspace_memberships", INSTITUTION_MEMBERSHIP_FIELDS, "created_at", false),
    listAllRows(db, "projects", "project_id,project_name,status", "project_id"),
    listAllRows(db, "project_access_memberships", PROJECT_MEMBERSHIP_FIELDS, "created_at", false),
  ]);

  const firstError =
    accounts.error ?? workspaces.error ?? institutionMemberships.error ?? projects.error ?? projectMemberships.error;
  if (firstError) return failed("load_failed", firstError);

  return NextResponse.json({
    ok: true,
    accounts: accounts.data ?? [],
    institutionWorkspaces: workspaces.data ?? [],
    institutionMemberships: institutionMemberships.data ?? [],
    projects: projects.data ?? [],
    projectMemberships: projectMemberships.data ?? [],
  });
}

// --- POST (create / invite) ----------------------------------------------------------

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await readBody(request);
  if (!body) return bad("invalid_json");

  const kind = pick(body.kind, MUTATION_KINDS);
  if (!kind) return bad("invalid_kind");

  const db = createAdminClient();
  if (kind === "account") return createAccount(db, body);
  if (kind === "institution_membership") return createInstitutionMembership(db, body);
  return createProjectMembership(db, body);
}

async function createAccount(db: Db, body: Body) {
  const email = normalizeWorkspaceEmail(body.email);
  if (!email) return bad("invalid_email");
  const displayName = text(body.displayName, 120);

  const { data: existing, error: lookupError } = await db
    .from("workspace_user_accounts")
    .select("id,status")
    .eq("email_normalized", email)
    .maybeSingle();
  if (lookupError) return failed("account_lookup_failed", lookupError);

  if (existing) {
    // A stopped account is never revived by re-inviting the same address. Reactivation
    // has to be a deliberate PATCH so it shows up as its own audited decision.
    if (existing.status === "suspended") return conflict("account_suspended");

    // Existing invited/active account: refresh the display name only. status is untouched.
    if (displayName) {
      const { error } = await db
        .from("workspace_user_accounts")
        .update({ display_name: displayName })
        .eq("id", existing.id);
      if (error) return failed("account_update_failed", error);
    }

    await recordWorkspaceAuditEvent(db, {
      eventType: "admin_account_upsert",
      userAccountId: existing.id,
      email,
      detail: { action: "update", created: false, status: existing.status },
    });
    return NextResponse.json({ ok: true, created: false, accountId: existing.id });
  }

  // New accounts always start as 'invited'. /auth/callback flips them to 'active' on the
  // first successful email login — an admin never hands out an already-active account.
  const { data: inserted, error: insertError } = await db
    .from("workspace_user_accounts")
    .insert({ email, display_name: displayName, status: "invited" })
    .select("id")
    .single();
  if (insertError) return failed("account_create_failed", insertError);

  await recordWorkspaceAuditEvent(db, {
    eventType: "admin_account_upsert",
    userAccountId: inserted.id,
    email,
    detail: { action: "create", created: true, status: "invited" },
  });
  return NextResponse.json({ ok: true, created: true, accountId: inserted.id });
}

async function createInstitutionMembership(db: Db, body: Body) {
  const workspaceId = text(body.workspaceId, 64);
  if (!workspaceId) return bad("workspace_required");

  const hasRole = hasField(body, "role");
  const role = hasRole ? pick(body.role, INSTITUTION_ROLES) : "member";
  if (!role) return bad("invalid_role");
  const hasStatus = hasField(body, "status");
  const status = hasStatus ? pick(body.status, MEMBERSHIP_CREATE_STATUSES) : "invited";
  if (!status) return bad("invalid_status");

  const resolved = await resolveAccount(db, body);
  if (!resolved.ok) {
    return resolved.server ? failed(resolved.error, resolved.server) : bad(resolved.error);
  }
  const account = resolved.account;

  const { data: workspace, error: workspaceError } = await db
    .from("institution_workspaces")
    .select("id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (workspaceError) return failed("workspace_lookup_failed", workspaceError);
  if (!workspace) return bad("unknown_workspace");

  const { data: existing, error: existingError } = await db
    .from("institution_workspace_memberships")
    .select("id,status")
    .eq("workspace_id", workspaceId)
    .eq("user_account_id", account.id)
    .maybeSingle();
  if (existingError) return failed("membership_lookup_failed", existingError);
  if (existing) {
    // Re-granting must not quietly undo a stop. The admin has to PATCH the existing row.
    return conflict(
      STOPPED_MEMBERSHIP_STATUSES.has(existing.status) ? "membership_stopped" : "membership_exists",
    );
  }

  // This grant covers the research-institution workspace only. Individual PJ access is a
  // separate, explicitly created row — nothing here creates it on the admin's behalf.
  const { data: inserted, error: insertError } = await db
    .from("institution_workspace_memberships")
    .insert({ workspace_id: workspaceId, user_account_id: account.id, role, status })
    .select("id")
    .single();
  if (insertError) return failed("membership_create_failed", insertError);

  await recordWorkspaceAuditEvent(db, {
    eventType: "admin_institution_membership_mutation",
    userAccountId: account.id,
    workspaceId,
    detail: { action: "create", role, status },
  });
  return NextResponse.json({ ok: true, created: true, membershipId: inserted.id });
}

async function createProjectMembership(db: Db, body: Body) {
  const projectId = text(body.projectId, 32);
  if (!projectId) return bad("project_required");

  const hasRole = hasField(body, "role");
  const role = hasRole ? pick(body.role, PROJECT_ROLES) : "contributor";
  if (!role) return bad("invalid_role");
  const hasStatus = hasField(body, "status");
  const status = hasStatus ? pick(body.status, MEMBERSHIP_CREATE_STATUSES) : "invited";
  if (!status) return bad("invalid_status");

  const resolved = await resolveAccount(db, body);
  if (!resolved.ok) {
    return resolved.server ? failed(resolved.error, resolved.server) : bad(resolved.error);
  }
  const account = resolved.account;

  const { data: project, error: projectError } = await db
    .from("projects")
    .select("project_id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (projectError) return failed("project_lookup_failed", projectError);
  if (!project) return bad("unknown_project");

  const { data: existing, error: existingError } = await db
    .from("project_access_memberships")
    .select("id,status")
    .eq("project_id", projectId)
    .eq("user_account_id", account.id)
    .maybeSingle();
  if (existingError) return failed("membership_lookup_failed", existingError);
  if (existing) {
    return conflict(
      STOPPED_MEMBERSHIP_STATUSES.has(existing.status) ? "membership_stopped" : "membership_exists",
    );
  }

  const { data: inserted, error: insertError } = await db
    .from("project_access_memberships")
    .insert({ project_id: projectId, user_account_id: account.id, role, status })
    .select("id")
    .single();
  if (insertError) return failed("membership_create_failed", insertError);

  await recordWorkspaceAuditEvent(db, {
    eventType: "admin_project_membership_mutation",
    userAccountId: account.id,
    projectId,
    detail: { action: "create", role, status },
  });
  return NextResponse.json({ ok: true, created: true, membershipId: inserted.id });
}

// --- PATCH (explicit status / role change) --------------------------------------------

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await readBody(request);
  if (!body) return bad("invalid_json");

  const kind = pick(body.kind, MUTATION_KINDS);
  if (!kind) return bad("invalid_kind");

  const db = createAdminClient();
  if (kind === "account") return patchAccount(db, body);
  if (kind === "institution_membership") return patchInstitutionMembership(db, body);
  return patchProjectMembership(db, body);
}

async function patchAccount(db: Db, body: Body) {
  const accountId = text(body.accountId, 64);
  if (!accountId) return bad("account_required");
  const status = pick(body.status, ACCOUNT_STATUSES);
  if (!status) return bad("invalid_status");

  const { data: updated, error } = await db
    .from("workspace_user_accounts")
    .update({ status })
    .eq("id", accountId)
    .select("id,email")
    .maybeSingle();
  if (error) return failed("account_update_failed", error);
  if (!updated) return bad("unknown_account", 404);

  await recordWorkspaceAuditEvent(db, {
    eventType: "admin_account_upsert",
    userAccountId: updated.id,
    email: updated.email,
    detail: { action: "status_change", status },
  });
  return NextResponse.json({ ok: true, accountId: updated.id, status });
}

async function patchInstitutionMembership(db: Db, body: Body) {
  const membershipId = text(body.membershipId, 64);
  if (!membershipId) return bad("membership_required");

  const hasStatus = hasField(body, "status");
  const status = hasStatus ? pick(body.status, MEMBERSHIP_STATUSES) : null;
  if (hasStatus && !status) return bad("invalid_status");
  const hasRole = hasField(body, "role");
  const role = hasRole ? pick(body.role, INSTITUTION_ROLES) : null;
  if (hasRole && !role) return bad("invalid_role");
  if (!status && !role) return bad("nothing_to_change");

  const patch: Record<string, string> = {};
  if (status) patch.status = status;
  if (role) patch.role = role;

  const { data: updated, error } = await db
    .from("institution_workspace_memberships")
    .update(patch)
    .eq("id", membershipId)
    .select("id,user_account_id,workspace_id,role,status")
    .maybeSingle();
  if (error) return failed("membership_update_failed", error);
  if (!updated) return bad("unknown_membership", 404);

  await recordWorkspaceAuditEvent(db, {
    eventType: "admin_institution_membership_mutation",
    userAccountId: updated.user_account_id,
    workspaceId: updated.workspace_id,
    detail: { action: "status_change", role: updated.role, status: updated.status },
  });
  return NextResponse.json({ ok: true, membershipId: updated.id, role: updated.role, status: updated.status });
}

async function patchProjectMembership(db: Db, body: Body) {
  const membershipId = text(body.membershipId, 64);
  if (!membershipId) return bad("membership_required");

  const hasStatus = hasField(body, "status");
  const status = hasStatus ? pick(body.status, MEMBERSHIP_STATUSES) : null;
  if (hasStatus && !status) return bad("invalid_status");
  const hasRole = hasField(body, "role");
  const role = hasRole ? pick(body.role, PROJECT_ROLES) : null;
  if (hasRole && !role) return bad("invalid_role");
  if (!status && !role) return bad("nothing_to_change");

  const patch: Record<string, string> = {};
  if (status) patch.status = status;
  if (role) patch.role = role;

  const { data: updated, error } = await db
    .from("project_access_memberships")
    .update(patch)
    .eq("id", membershipId)
    .select("id,user_account_id,project_id,role,status")
    .maybeSingle();
  if (error) return failed("membership_update_failed", error);
  if (!updated) return bad("unknown_membership", 404);

  await recordWorkspaceAuditEvent(db, {
    eventType: "admin_project_membership_mutation",
    userAccountId: updated.user_account_id,
    projectId: updated.project_id,
    detail: { action: "status_change", role: updated.role, status: updated.status },
  });
  return NextResponse.json({ ok: true, membershipId: updated.id, role: updated.role, status: updated.status });
}
