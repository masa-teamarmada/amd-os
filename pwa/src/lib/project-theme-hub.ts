import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { parseThemeHistory } from "@/lib/project-theme-history";

type Db = ReturnType<typeof createAdminClient>;
type PgError = { code?: string; message: string };

export class ThemeHubError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function isUniqueViolation(error: PgError | null | undefined): boolean {
  return Boolean(error && error.code === "23505");
}

function text(value: unknown, field: string, max = 1000): string {
  if (typeof value !== "string") throw new ThemeHubError(`${field}は文字列で入力してね`);
  const normalized = value.trim();
  if (!normalized) throw new ThemeHubError(`${field}を入力してね`);
  if (normalized.length > max) throw new ThemeHubError(`${field}が長すぎるよ`);
  return normalized;
}

function optionalText(value: unknown, field: string, max = 4000): string | null {
  if (value === null || value === undefined || value === "") return null;
  return text(value, field, max);
}

// Rejects calendar-impossible dates (e.g. 2026-02-30). `new Date(...)` silently normalizes those
// forward (2026-02-30 -> 2026-03-02) instead of producing NaN, so a plain isNaN check is not
// enough — the parsed date must round-trip back to the exact input string.
function optionalDate(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ThemeHubError(`${field}はYYYY-MM-DDの実在する日付で入力してね`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ThemeHubError(`${field}はYYYY-MM-DDの実在する日付で入力してね`);
  }
  return value;
}

function requiredDate(value: unknown, field: string): string {
  const date = optionalDate(value, field);
  if (!date) throw new ThemeHubError(`${field}を入力してね`);
  return date;
}

function requiredVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw new ThemeHubError("expected_versionが必要だよ");
  return value;
}

function requiredTimestamp(value: unknown, field: string): string {
  if (typeof value !== "string" || !value || Number.isNaN(new Date(value).getTime())) {
    throw new ThemeHubError(`${field}が必要だよ`);
  }
  return value;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalUuid(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !UUID_RE.test(value)) throw new ThemeHubError(`${field}の形式が不正だよ`);
  return value;
}

// client_token is the caller's idempotency key for a create-with-retry flow. It must NOT be
// generated server-side as a fallback: if a request times out after the server commits but
// before the response arrives, a retry that got a *fresh* server-generated token on the first
// attempt would generate ANOTHER fresh token on the retry too, defeating the whole point — the
// client must generate one token up front and resend the SAME one on every retry of the same
// logical action. A missing/invalid token is therefore a 400, not a silently-tolerated gap.
function requiredUuid(value: unknown, field = "client_token"): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) throw new ThemeHubError(`${field}(冪等キー)が必要だよ`);
  return value;
}

/** Only copies keys that are actually present on the wire payload — `fields.foo` on a plain
 * object literal is `undefined` both when the caller omitted `foo` AND when the caller explicitly
 * sent `foo: null`, so building `{ camelKey: fields.snake_key }` unconditionally makes every
 * omitted optional field indistinguishable from "clear this field", silently wiping it on save.
 * `wireKey in fields` is the only correct presence check. */
export function pickPresent<T extends Record<string, unknown>>(
  fields: Record<string, unknown>,
  mapping: Record<string, keyof T & string>,
): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const wireKey of Object.keys(mapping)) {
    if (wireKey in fields) result[mapping[wireKey]] = fields[wireKey];
  }
  return result as Partial<T>;
}

/** Every write below assumes the caller already ran the manager-capability + same-origin check
 * (getThemeHubWriteContext in the route layer). This module only re-verifies project/track/
 * entity scoping — it is the last line of defense before the DB's own FK/trigger/RLS layer, not
 * the first. */
export async function assertValidTrack(db: Db, projectId: string, trackKey: string): Promise<void> {
  const { data, error } = await db
    .from("project_management_tracks")
    .select("track_key")
    .eq("project_id", projectId)
    .eq("track_key", trackKey)
    .maybeSingle();
  if (error) throw new ThemeHubError(`テーマの確認に失敗したよ: ${error.message}`, 500);
  if (!data) throw new ThemeHubError("このテーマは見つからないよ", 404);
}

/** Shared restore-or-create for a natural-key bridge row (project_theme_meetings /
 * project_theme_documents / the natural-key branch of project_theme_work_links). A plain
 * `upsert({ onConflict, ignoreDuplicates: true })` silently no-ops when the conflicting row is
 * soft-deleted — it neither restores it nor reports failure, so a caller who thinks they just
 * re-linked something sees success while the link stays invisible (deleted_at still set). This
 * looks up the row's actual state first and only skips work when it is already active; a
 * soft-deleted row is explicitly restored (the DB trigger re-validates the endpoint is still
 * active/same-project on that UPDATE), and a genuinely new row is inserted, with a concurrent-
 * insert race (23505) treated as an idempotent success rather than an error. */
async function restoreOrInsertLink(
  db: Db,
  table: string,
  match: Record<string, unknown>,
  insertRow: Record<string, unknown>,
): Promise<void> {
  const { data: existing, error: existingError } = await db
    .from(table)
    .select("id,deleted_at")
    .match(match)
    .maybeSingle();
  if (existingError) throw new ThemeHubError(`確認に失敗したよ: ${existingError.message}`, 500);

  if (existing) {
    if (existing.deleted_at == null) return; // already active — nothing to do
    const { error } = await db
      .from(table)
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", existing.id)
      .not("deleted_at", "is", null);
    if (error) throw new ThemeHubError(`紐付けを復元できなかったよ: ${error.message}`, 500);
    return;
  }

  const { error } = await db.from(table).insert(insertRow);
  if (error) {
    if (isUniqueViolation(error)) return; // a concurrent request created the same link first
    throw new ThemeHubError(`紐付けを作成できなかったよ: ${error.message}`, 500);
  }
}

// ---------------------------------------------------------------------------
// Profile (purpose / current state / next focus)
// ---------------------------------------------------------------------------

export async function upsertThemeProfile(
  db: Db,
  projectId: string,
  trackKey: string,
  memberId: string,
  fields: { purposeMd?: unknown; currentStateMd?: unknown; nextFocusNote?: unknown; historyRows?: unknown },
  expectedVersion: number | null,
) {
  const patch: Record<string, unknown> = { updated_by_member_id: memberId };
  if ("purposeMd" in fields) patch.purpose_md = optionalText(fields.purposeMd, "目的", 4000);
  if ("currentStateMd" in fields) patch.current_state_md = optionalText(fields.currentStateMd, "現状", 4000);
  if ("nextFocusNote" in fields) patch.next_focus_note = optionalText(fields.nextFocusNote, "次の焦点", 1000);
  if ("historyRows" in fields) {
    let rows;
    try { rows = parseThemeHistory(fields.historyRows); }
    catch (error) { throw new ThemeHubError(error instanceof Error ? error.message : "経緯の形式が不正だよ"); }
    // A source must already belong to this theme. Saving a summary never grants access or
    // silently changes membership; the existing MTG/document linking controls own that action.
    await Promise.all((["meeting", "document"] as const).map(async kind => {
      const ids = [...new Set(rows.flatMap(row => row.sources).filter(source => source.kind === kind).map(source => source.id))];
      if (!ids.length) return;
      const isMeeting = kind === "meeting";
      const idColumn = isMeeting ? "meeting_id" : "document_id";
      const { data, error } = await db.from(isMeeting ? "project_theme_meetings" : "project_theme_documents")
        .select(idColumn).eq("project_id", projectId).eq("track_key", trackKey)
        .in(idColumn, ids).is("deleted_at", null);
      if (error) throw new ThemeHubError("元記録の確認に失敗したよ", 500);
      const found = new Set((data ?? []).map(row => String((row as unknown as Record<string, unknown>)[idColumn])));
      if (ids.some(id => !found.has(id))) throw new ThemeHubError("元記録を先にこのテーマへひもづけてね", 400);
    }));
    patch.history_rows = rows;
  }

  const { data: existing, error: existingError } = await db
    .from("project_theme_profiles")
    .select("id,version")
    .eq("project_id", projectId)
    .eq("track_key", trackKey)
    .maybeSingle();
  if (existingError) throw new ThemeHubError(`テーマ内容の確認に失敗したよ: ${existingError.message}`, 500);

  if (!existing) {
    // First-ever save for this theme: nothing to conflict with yet, expected_version is
    // meaningless (and the caller cannot have read a version that doesn't exist).
    const { error } = await db.from("project_theme_profiles").insert({
      project_id: projectId,
      track_key: trackKey,
      created_by_member_id: memberId,
      ...patch,
    });
    if (error) throw new ThemeHubError(`テーマ内容を保存できなかったよ: ${error.message}`, 500);
    return;
  }

  // An existing row is being edited — expected_version is mandatory from here on. Silently
  // allowing a missing version to skip the check would let a stale client overwrite someone
  // else's more recent edit with no warning.
  const version = requiredVersion(expectedVersion);
  const { data, error } = await db
    .from("project_theme_profiles")
    .update(patch)
    .eq("id", existing.id)
    .eq("version", version)
    .select("id")
    .maybeSingle();
  if (error) throw new ThemeHubError(`テーマ内容を保存できなかったよ: ${error.message}`, 500);
  if (!data) throw new ThemeHubError("他の人がこのテーマ内容を先に更新したよ。最新の内容を読み込み直すね", 409);
}

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------

/** Existing meeting -> theme link. Restore-or-insert against the natural (project_id, track_key,
 * meeting_id) key — no client_token needed, there is no second table whose creation could be
 * duplicated (the meeting already exists). */
export async function linkExistingMeeting(db: Db, projectId: string, trackKey: string, meetingId: unknown, memberId: string) {
  // 1024, not 80 (root review, UI completion phase, point 8): meeting_id is a text natural key
  // (gas/074_MeetingSummaryRepo.js composes it from source/thread/date tokens, not a short uuid),
  // and a fresh p19 aggregate shows real existing ids up to 190 characters. 80 silently rejected
  // linking most of the project's actual meeting history.
  const id = text(meetingId, "meeting_id", 1024);
  const { data: meeting, error: meetingError } = await db
    .from("project_meeting_summaries")
    .select("meeting_id")
    .eq("project_id", projectId)
    .eq("meeting_id", id)
    .maybeSingle();
  if (meetingError) throw new ThemeHubError(`会議の確認に失敗したよ: ${meetingError.message}`, 500);
  if (!meeting) throw new ThemeHubError("この会議はこのPJで見つからないよ", 404);

  await restoreOrInsertLink(
    db,
    "project_theme_meetings",
    { project_id: projectId, track_key: trackKey, meeting_id: id },
    { project_id: projectId, track_key: trackKey, meeting_id: id, created_by_member_id: memberId },
  );
}

/** New meeting + link, atomic via the theme_hub_create_meeting_and_link 8-arg RPC (migration
 * 20260901090000 — a distinct overload from the already-applied 7-arg 20260831120000 version, NOT
 * a default-extended replacement of it, so 7-arg callers stay unambiguous). client_token (caller-
 * supplied, required) makes a client retry-after-timeout idempotent: a second call with the same
 * token returns the already-created meeting_id instead of creating a duplicate. There is no
 * fallback to the old 7-arg RPC — that would silently drop the preparation text while reporting
 * success, which is worse than a clear error telling the caller the migration is not applied yet. */
export async function createMeetingAndLink(
  db: Db,
  projectId: string,
  trackKey: string,
  memberId: string,
  fields: { title: unknown; meetingDate: unknown; prepDraftMd?: unknown; summaryShort?: unknown; clientToken: unknown },
): Promise<string> {
  const title = text(fields.title, "title", 180);
  const meetingDate = requiredDate(fields.meetingDate, "meeting_date");
  const prepDraftMd = optionalText(fields.prepDraftMd, "準備", 8000);
  const summaryShort = optionalText(fields.summaryShort, "概要", 4000) ?? "";
  const clientToken = requiredUuid(fields.clientToken);

  const { data, error } = await db.rpc("theme_hub_create_meeting_and_link", {
    p_project_id: projectId,
    p_track_key: trackKey,
    p_title: title,
    p_meeting_date: meetingDate,
    p_summary_short: summaryShort,
    p_client_token: clientToken,
    p_created_by_member_id: memberId,
    p_prep_draft_md: prepDraftMd,
  });
  if (error) throw new ThemeHubError(`会議を作成できなかったよ: ${error.message}`, 500);
  return String(data);
}

/** Editing an existing meeting is a plain allowlisted UPDATE — title/meeting_date(+derived ym)/
 * prep_draft_md/summary_short only. narrative_md/source_hash/decided/progress/next_actions/risks
 * are never in this allowlist, so they are structurally impossible to erase from this path (and
 * pms_preserve_rich_narrative on the DB side still guards narrative_md regardless).
 *
 * project_meeting_summaries has no `version` column (unlike the theme-hub's own tables) — its
 * optimistic-concurrency token is `updated_at`. expectedUpdatedAt must be the exact value most
 * recently read for this row; the UPDATE's own `.eq("updated_at", expectedUpdatedAt)` is the real
 * atomic guard (a DB-side timestamptz comparison, not a fragile app-level string compare) — the
 * `before` SELECT only exists to tell a genuine 404 (never existed) apart from a 409 (existed but
 * changed under us). */
export async function updateMeeting(
  db: Db,
  projectId: string,
  meetingId: string,
  fields: { title?: unknown; meetingDate?: unknown; prepDraftMd?: unknown; summaryShort?: unknown },
  expectedUpdatedAt: unknown,
) {
  const updatedAtToken = requiredTimestamp(expectedUpdatedAt, "expected_updated_at");
  const patch: Record<string, unknown> = {};
  if ("title" in fields) patch.title = text(fields.title, "title", 180);
  if ("meetingDate" in fields) {
    const meetingDate = requiredDate(fields.meetingDate, "meeting_date");
    patch.meeting_date = meetingDate;
    // Matches the GAS ingestion convention exactly (gas/074_MeetingSummaryRepo.js ymKey):
    // YYYYMM, no separator — NOT to_char(..., 'YYYY-MM'). Getting this wrong silently breaks
    // idx_pms_project_ym / monthly-report grouping for any hub-edited meeting.
    patch.ym = `${meetingDate.slice(0, 4)}${meetingDate.slice(5, 7)}`;
  }
  if ("prepDraftMd" in fields) patch.prep_draft_md = optionalText(fields.prepDraftMd, "準備", 8000);
  if ("summaryShort" in fields) patch.summary_short = optionalText(fields.summaryShort, "概要", 4000) ?? "";
  if (Object.keys(patch).length === 0) throw new ThemeHubError("更新できる項目がないよ");

  const { data: before, error: beforeError } = await db
    .from("project_meeting_summaries")
    .select("meeting_id")
    .eq("project_id", projectId)
    .eq("meeting_id", meetingId)
    .maybeSingle();
  if (beforeError) throw new ThemeHubError(`会議の確認に失敗したよ: ${beforeError.message}`, 500);
  if (!before) throw new ThemeHubError("この会議はこのPJで見つからないよ", 404);

  const { data, error } = await db
    .from("project_meeting_summaries")
    .update(patch)
    .eq("project_id", projectId)
    .eq("meeting_id", meetingId)
    .eq("updated_at", updatedAtToken)
    .select("meeting_id")
    .maybeSingle();
  if (error) throw new ThemeHubError(`会議を更新できなかったよ: ${error.message}`, 500);
  if (!data) throw new ThemeHubError("他の人がこの会議を先に更新したよ。最新の内容を読み込み直すね", 409);
}

export async function unlinkMeeting(db: Db, projectId: string, trackKey: string, meetingId: string, memberId: string, expectedVersion: unknown) {
  const version = requiredVersion(expectedVersion);
  const { data, error } = await db
    .from("project_theme_meetings")
    .update({ deleted_at: new Date().toISOString(), deleted_by: memberId })
    .eq("project_id", projectId)
    .eq("track_key", trackKey)
    .eq("meeting_id", meetingId)
    .eq("version", version)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new ThemeHubError(`会議のテーマ紐付けを解除できなかったよ: ${error.message}`, 500);
  if (!data) throw new ThemeHubError("他の人がこの紐付けを先に更新したか、見つからないよ。最新の内容を読み込み直すね", 409);
}

// ---------------------------------------------------------------------------
// Documents (existing workspace_documents rows only — never created here)
// ---------------------------------------------------------------------------

export async function linkExistingDocument(db: Db, projectId: string, trackKey: string, documentId: unknown, memberId: string) {
  const id = optionalUuid(documentId, "document_id");
  if (!id) throw new ThemeHubError("document_idを入力してね");
  const { data: doc, error: docError } = await db
    .from("workspace_documents")
    .select("document_id,upload_status")
    .eq("project_id", projectId)
    .eq("document_id", id)
    .maybeSingle();
  if (docError) throw new ThemeHubError(`書類の確認に失敗したよ: ${docError.message}`, 500);
  if (!doc) throw new ThemeHubError("この書類はこのPJで見つからないよ", 404);
  if (doc.upload_status !== "active") throw new ThemeHubError("この書類は現在利用できない状態だよ", 409);

  await restoreOrInsertLink(
    db,
    "project_theme_documents",
    { project_id: projectId, track_key: trackKey, document_id: id },
    { project_id: projectId, track_key: trackKey, document_id: id, created_by_member_id: memberId },
  );
}

export async function unlinkDocument(db: Db, projectId: string, trackKey: string, documentId: string, memberId: string, expectedVersion: unknown) {
  const version = requiredVersion(expectedVersion);
  const { data, error } = await db
    .from("project_theme_documents")
    .update({ deleted_at: new Date().toISOString(), deleted_by: memberId })
    .eq("project_id", projectId)
    .eq("track_key", trackKey)
    .eq("document_id", documentId)
    .eq("version", version)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new ThemeHubError(`書類のテーマ紐付けを解除できなかったよ: ${error.message}`, 500);
  if (!data) throw new ThemeHubError("他の人がこの紐付けを先に更新したか、見つからないよ。最新の内容を読み込み直すね", 409);
}

// ---------------------------------------------------------------------------
// Deliverables (planned documents — may exist without a file)
// ---------------------------------------------------------------------------

const DELIVERABLE_STATUSES = ["planned", "in_progress", "submitted", "linked", "cancelled"];

export async function createDeliverable(
  db: Db,
  projectId: string,
  trackKey: string,
  memberId: string,
  fields: { title: unknown; descriptionMd?: unknown; ownerMemberId?: unknown; dueOn?: unknown; clientToken: unknown },
): Promise<string> {
  const title = text(fields.title, "title", 180);
  const descriptionMd = optionalText(fields.descriptionMd, "説明", 4000);
  const ownerMemberId = fields.ownerMemberId ? text(fields.ownerMemberId, "owner_member_id", 80) : null;
  const dueOn = optionalDate(fields.dueOn, "due_on");
  const clientToken = requiredUuid(fields.clientToken);

  // Plain INSERT + 23505 recovery — NOT upsert(onConflict). The idempotency index
  // (project_id, track_key, client_token) is PARTIAL (WHERE client_token IS NOT NULL);
  // PostgREST's upsert cannot supply a partial index's predicate for conflict-target inference
  // and fails with 42P10 ("there is no unique or exclusion constraint matching the ON CONFLICT
  // specification") against a partial index. A plain insert that lets Postgres itself pick the
  // matching index, followed by an exact re-read on unique_violation, has no such restriction.
  const { data, error } = await db
    .from("project_theme_deliverables")
    .insert({
      project_id: projectId,
      track_key: trackKey,
      title,
      description_md: descriptionMd,
      owner_member_id: ownerMemberId,
      due_on: dueOn,
      status: "planned",
      client_token: clientToken,
      created_by_member_id: memberId,
      updated_by_member_id: memberId,
    })
    .select("id")
    .single();
  if (!error) return String((data as { id: string }).id);
  if (!isUniqueViolation(error)) throw new ThemeHubError(`予定成果物を作成できなかったよ: ${error.message}`, 500);

  // root review (release checkpoint, point 7): a retry of the SAME client_token whose row was
  // deliberately soft-deleted by someone else since the original create must not be reported as
  // "created" again — read deleted_at back and fail loudly instead of silently pointing the
  // caller at an archived row it can no longer see.
  const { data: current, error: currentError } = await db
    .from("project_theme_deliverables")
    .select("id,deleted_at")
    .eq("project_id", projectId).eq("track_key", trackKey).eq("client_token", clientToken)
    .maybeSingle();
  if (currentError || !current) throw new ThemeHubError("予定成果物を作成できなかったよ", 500);
  if (current.deleted_at != null) throw new ThemeHubError("この予定成果物は削除済みだよ。新しい内容として作り直してね", 409);
  return String(current.id);
}

export async function updateDeliverable(
  db: Db,
  projectId: string,
  trackKey: string,
  id: string,
  memberId: string,
  fields: {
    title?: unknown; descriptionMd?: unknown; ownerMemberId?: unknown; dueOn?: unknown;
    status?: unknown; linkedDocumentId?: unknown;
  },
  expectedVersion: unknown,
) {
  const version = requiredVersion(expectedVersion);
  const patch: Record<string, unknown> = { updated_by_member_id: memberId };
  if ("title" in fields) patch.title = text(fields.title, "title", 180);
  if ("descriptionMd" in fields) patch.description_md = optionalText(fields.descriptionMd, "説明", 4000);
  if ("ownerMemberId" in fields) patch.owner_member_id = fields.ownerMemberId ? text(fields.ownerMemberId, "owner_member_id", 80) : null;
  if ("dueOn" in fields) patch.due_on = optionalDate(fields.dueOn, "due_on");
  if ("status" in fields) {
    if (typeof fields.status !== "string" || !DELIVERABLE_STATUSES.includes(fields.status)) throw new ThemeHubError("statusが不正だよ");
    patch.status = fields.status;
  }
  if ("linkedDocumentId" in fields) patch.linked_document_id = optionalUuid(fields.linkedDocumentId, "linked_document_id");
  if (Object.keys(patch).length === 1) throw new ThemeHubError("更新できる項目がないよ"); // only updated_by_member_id

  // root review (release checkpoint, point 7): deleted_at IS NULL — updating an already
  // soft-deleted row (e.g. two tabs, one deletes then the other edits) must not silently write
  // to and resurrect a row another user deliberately removed.
  const { data, error } = await db
    .from("project_theme_deliverables")
    .update(patch)
    .eq("project_id", projectId)
    .eq("track_key", trackKey)
    .eq("id", id)
    .eq("version", version)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new ThemeHubError(`予定成果物を更新できなかったよ: ${error.message}`, 500);
  if (!data) throw new ThemeHubError("他の人がこの予定成果物を先に更新したよ。最新の内容を読み込み直すね", 409);
}

export async function deleteDeliverable(db: Db, projectId: string, trackKey: string, id: string, memberId: string, expectedVersion: unknown) {
  const version = requiredVersion(expectedVersion);
  const { data, error } = await db
    .from("project_theme_deliverables")
    .update({ deleted_at: new Date().toISOString(), deleted_by: memberId })
    .eq("project_id", projectId)
    .eq("track_key", trackKey)
    .eq("id", id)
    .eq("version", version)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new ThemeHubError(`予定成果物を削除できなかったよ: ${error.message}`, 500);
  if (!data) throw new ThemeHubError("他の人がこの予定成果物を先に更新したよ。最新の内容を読み込み直すね", 409);
}

// ---------------------------------------------------------------------------
// Work chain links (meeting/document <-> issue/task/milestone/decision/deliverable)
// ---------------------------------------------------------------------------

const LINK_KINDS = ["meeting", "document", "issue", "task", "milestone", "decision", "deliverable"] as const;
type LinkKind = (typeof LINK_KINDS)[number];
const LINK_RELATIONS = ["relates_to", "discussed_in", "produced", "resolved_by"];

// These pairs already have a canonical FK/bridge relationship maintained by the existing
// management route (issue<->milestone via project_management_milestone_issue_links, decision->
// issue via decisions.issue_id, task->milestone via tasks.milestone_id — see phase1.md §2).
// Duplicating them into project_theme_work_links would create a second, driftable source of
// truth for the same fact. Reject and point the caller at the real writer instead.
const CANONICAL_FK_PAIRS = new Set([
  "issue:milestone", "milestone:issue",
  "decision:issue", "issue:decision",
  "task:milestone", "milestone:task",
]);

async function resolveLinkEndpointProject(db: Db, kind: LinkKind, id: string): Promise<string | null> {
  switch (kind) {
    case "meeting": {
      const { data } = await db.from("project_meeting_summaries").select("project_id").eq("meeting_id", id).maybeSingle();
      return data ? String(data.project_id) : null;
    }
    case "document": {
      const { data } = await db.from("workspace_documents").select("project_id").eq("document_id", id).eq("upload_status", "active").maybeSingle();
      return data?.project_id ? String(data.project_id) : null;
    }
    case "issue": {
      const { data } = await db.from("project_management_issues").select("project_id").eq("id", id).is("deleted_at", null).maybeSingle();
      return data ? String(data.project_id) : null;
    }
    case "task": {
      const { data } = await db.from("project_management_tasks").select("project_id").eq("id", id).is("deleted_at", null).maybeSingle();
      return data ? String(data.project_id) : null;
    }
    case "milestone": {
      const { data } = await db.from("project_management_milestones").select("project_id").eq("id", id).is("deleted_at", null).maybeSingle();
      return data ? String(data.project_id) : null;
    }
    case "decision": {
      const { data } = await db.from("project_management_decisions").select("project_id").eq("id", id).is("deleted_at", null).maybeSingle();
      return data ? String(data.project_id) : null;
    }
    case "deliverable": {
      const { data } = await db.from("project_theme_deliverables").select("project_id").eq("id", id).is("deleted_at", null).maybeSingle();
      return data ? String(data.project_id) : null;
    }
    default:
      return null;
  }
}

/** Links are canonical facts about their two endpoints, not per-theme records — the same
 * (from,to,relation) triple must not exist twice just because two different themes both wanted to
 * reference it (project_theme_work_links' natural UNIQUE deliberately excludes track_key). The
 * read side (project-workspace.ts) renders a link under every theme either endpoint actually
 * belongs to, not only the track_key the row happened to be created under — track_key here is
 * provenance (which theme's action created it), not a scoping/visibility key. */
export async function createWorkLink(
  db: Db,
  projectId: string,
  trackKey: string,
  memberId: string,
  fields: { fromKind: unknown; fromId: unknown; toKind: unknown; toId: unknown; relation?: unknown; clientToken: unknown },
): Promise<string> {
  const fromKind = text(fields.fromKind, "from_kind", 40) as LinkKind;
  const toKind = text(fields.toKind, "to_kind", 40) as LinkKind;
  if (!LINK_KINDS.includes(fromKind) || !LINK_KINDS.includes(toKind)) throw new ThemeHubError("関連の種類が不正だよ");
  if (CANONICAL_FK_PAIRS.has(`${fromKind}:${toKind}`)) {
    throw new ThemeHubError("この組み合わせは既存の管理画面(課題・タスク・マイルストーン)の接続を使ってね");
  }
  // 1024, not 80 (root review, UI completion phase, point 8): "meeting" is a LinkKind and its id
  // is the same free-text natural key as linkExistingMeeting's meetingId above (up to 190 chars
  // in real p19 data today), not a uuid. The other kinds are all uuid-backed and comfortably fit
  // under 1024 too, so one shared generous cap covers every LinkKind without branching per-kind.
  const fromId = text(fields.fromId, "from_id", 1024);
  const toId = text(fields.toId, "to_id", 1024);
  if (fromKind === toKind && fromId === toId) throw new ThemeHubError("同じ項目同士は接続できないよ");
  const relation = fields.relation ? text(fields.relation, "relation", 40) : "relates_to";
  if (!LINK_RELATIONS.includes(relation)) throw new ThemeHubError("relationが不正だよ");
  const clientToken = requiredUuid(fields.clientToken);

  // Defense in depth ahead of the DB trigger (project_theme_work_links_guard): same checks, a
  // readable 404/409 here instead of a raw constraint-violation message from the DB.
  const [fromProject, toProject] = await Promise.all([
    resolveLinkEndpointProject(db, fromKind, fromId),
    resolveLinkEndpointProject(db, toKind, toId),
  ]);
  if (!fromProject) throw new ThemeHubError(`${fromKind}が見つからないか非アクティブだよ`, 404);
  if (!toProject) throw new ThemeHubError(`${toKind}が見つからないか非アクティブだよ`, 404);
  if (fromProject !== projectId || toProject !== projectId) throw new ThemeHubError("関連先はこのPJの範囲内にしてね", 403);

  // client_token dedupe first (pure retry of the same request). root review (release checkpoint,
  // point 7): a retry of the same token whose row was deliberately soft-deleted since must not
  // be reported as a success pointing at a row the caller can no longer see — fail loudly instead
  // of silently restoring something someone else removed (the natural-key path below explicitly
  // decides restore-vs-active on its own terms; this by-token path is a pure retry, not that).
  const { data: byToken, error: byTokenError } = await db
    .from("project_theme_work_links")
    .select("id,deleted_at")
    .eq("project_id", projectId).eq("track_key", trackKey).eq("client_token", clientToken)
    .maybeSingle();
  if (byTokenError) throw new ThemeHubError(`関連の確認に失敗したよ: ${byTokenError.message}`, 500);
  if (byToken?.deleted_at != null) throw new ThemeHubError("この関連は削除済みだよ。もう一度作り直してね", 409);
  if (byToken) return String(byToken.id);

  const { data, error } = await db
    .from("project_theme_work_links")
    .insert({
      project_id: projectId, track_key: trackKey, from_kind: fromKind, from_id: fromId,
      to_kind: toKind, to_id: toId, relation, client_token: clientToken, created_by_member_id: memberId,
    })
    .select("id")
    .single();
  if (!error) return String((data as { id: string }).id);
  if (!isUniqueViolation(error)) throw new ThemeHubError(`関連を作成できなかったよ: ${error.message}`, 500);

  // 23505 with no client_token match above means the natural (from,to,relation) key already
  // exists — created earlier under this theme or a different one. Either the row is soft-deleted
  // (restore it) or active (already canonical; just hand back its id — success either way).
  const { data: existing, error: existingError } = await db
    .from("project_theme_work_links")
    .select("id,deleted_at")
    .eq("project_id", projectId).eq("from_kind", fromKind).eq("from_id", fromId)
    .eq("to_kind", toKind).eq("to_id", toId).eq("relation", relation)
    .maybeSingle();
  if (existingError || !existing) throw new ThemeHubError("関連を作成できなかったよ", 500);
  if (existing.deleted_at != null) {
    const { error: restoreError } = await db
      .from("project_theme_work_links")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", existing.id)
      .not("deleted_at", "is", null);
    if (restoreError) throw new ThemeHubError(`関連を復元できなかったよ: ${restoreError.message}`, 500);
  }
  return String(existing.id);
}

// track_key is intentionally NOT part of the WHERE clause here: a work_link is a canonical fact
// about its two endpoints (see createWorkLink's doc comment), rendered under every theme either
// endpoint belongs to — not only the track_key it happened to be created under. A user unlinking
// it from a DIFFERENT theme's view than the one that created it must still be able to (the row's
// own id + project_id already uniquely identifies it; trackKey stays as a param for route/URL
// shape consistency with the other resources, not as a filter).
export async function deleteWorkLink(db: Db, projectId: string, _trackKey: string, id: string, memberId: string, expectedVersion: unknown) {
  const version = requiredVersion(expectedVersion);
  const { data, error } = await db
    .from("project_theme_work_links")
    .update({ deleted_at: new Date().toISOString(), deleted_by: memberId })
    .eq("project_id", projectId)
    .eq("id", id)
    .eq("version", version)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new ThemeHubError(`関連を削除できなかったよ: ${error.message}`, 500);
  if (!data) throw new ThemeHubError("他の人がこの関連を先に更新したよ。最新の内容を読み込み直すね", 409);
}
