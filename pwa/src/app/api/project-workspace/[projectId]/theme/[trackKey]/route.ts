import { NextRequest, NextResponse } from "next/server";
import { canAccessWorkspaceProject, getCurrentMemberAccess } from "@/lib/project-workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOriginWorkspaceMutation } from "@/lib/workspace-mutation-origin";
import { THEME_HUB_MEETING_WRITE_ENABLED, THEME_HUB_MEETING_WRITE_BLOCKED_MESSAGE } from "@/lib/theme-hub-rollout";
import {
  ThemeHubError,
  assertValidTrack,
  createDeliverable,
  createMeetingAndLink,
  createWorkLink,
  deleteDeliverable,
  deleteWorkLink,
  linkExistingDocument,
  linkExistingMeeting,
  pickPresent,
  unlinkDocument,
  unlinkMeeting,
  updateDeliverable,
  updateMeeting,
  upsertThemeProfile,
} from "@/lib/project-theme-hub";

// テーマ作業ハブ(ios/supabase/migrations/20260831120000_project_theme_hub.sql)の書き込み経路。
// 既存の /api/project-workspace/[projectId]/management/route.ts と同じ認可パターンを踏襲する:
// authenticated + 対象PJアクセス権 + 既存の管理権限(portfolio/admin)をservice-role書き込みの
// 前にすべて確認する。
// 会議(project_meeting_summaries)はこのルートで新規作成もする(POST resource "meeting" ->
// theme_hub_create_meeting_and_link RPC。project-theme-hub.ts参照) — 既存MTGへのリンクだけを
// 扱うのではない、正本の会議記録そのものをここで作る唯一の書き込み口。書類
// (workspace_documents)は既存行への紐付け/解除のみで、ここでは新規作成しない。運用マイルス
// トーン/タスク/課題/議論/決定/アクションアイテムの作成・編集は既存の /management ルートを
// track引数付きでそのまま使う(このルートでは扱わない)。

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getThemeHubWriteContext(request: NextRequest, projectId: string) {
  if (!isSameOriginWorkspaceMutation(request)) {
    return { response: NextResponse.json({ error: "不正なリクエスト元だよ" }, { status: 403 }) };
  }
  const access = await getCurrentMemberAccess();
  if (!access) return { response: NextResponse.json({ error: "ログインが必要だよ" }, { status: 401 }) };
  if (!canAccessWorkspaceProject(access, projectId)) {
    return { response: NextResponse.json({ error: "このPJの共有情報には入れないよ" }, { status: 404 }) };
  }
  // workspace_account (外部) はここに到達しない — getCurrentMemberAccess は internal member
  // だけを解決する(project-workspace.ts参照)。念のため明示のscope/isAdminチェックも重ねる。
  if (access.scope !== "portfolio" && !access.isAdmin) {
    return { response: NextResponse.json({ error: "テーマ内容の更新権限がないよ" }, { status: 403 }) };
  }
  return { access };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string; trackKey: string }> }) {
  const { projectId, trackKey } = await params;
  const context = await getThemeHubWriteContext(request, projectId);
  if ("response" in context) return context.response;
  const memberId = context.access.memberId;
  const db = createAdminClient();
  try {
    await assertValidTrack(db, projectId, trackKey);
    const body: unknown = await request.json();
    if (!isRecord(body)) throw new ThemeHubError("入力内容が不正だよ");
    const fields = isRecord(body.fields) ? body.fields : {};

    switch (body.resource) {
      case "meeting_link": {
        await linkExistingMeeting(db, projectId, trackKey, fields.meeting_id, memberId);
        return NextResponse.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
      }
      case "meeting": {
        // Safe partial release (root, "MTG read permissions are not changed without approval"):
        // this gate is intentionally independent of anything the UI sends — a client bypass can
        // never reach the RPC. See src/lib/theme-hub-rollout.ts for why.
        if (!THEME_HUB_MEETING_WRITE_ENABLED) {
          throw new ThemeHubError(THEME_HUB_MEETING_WRITE_BLOCKED_MESSAGE, 403);
        }
        const meetingId = await createMeetingAndLink(db, projectId, trackKey, memberId, {
          title: fields.title,
          meetingDate: fields.meeting_date,
          prepDraftMd: fields.prep_draft_md,
          summaryShort: fields.summary_short,
          clientToken: fields.client_token,
        });
        return NextResponse.json({ ok: true, meetingId }, { status: 201, headers: { "Cache-Control": "no-store" } });
      }
      case "document_link": {
        await linkExistingDocument(db, projectId, trackKey, fields.document_id, memberId);
        return NextResponse.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
      }
      case "deliverable": {
        const id = await createDeliverable(db, projectId, trackKey, memberId, {
          title: fields.title,
          descriptionMd: fields.description_md,
          ownerMemberId: fields.owner_member_id,
          dueOn: fields.due_on,
          clientToken: fields.client_token,
        });
        return NextResponse.json({ ok: true, id }, { status: 201, headers: { "Cache-Control": "no-store" } });
      }
      case "work_link": {
        const id = await createWorkLink(db, projectId, trackKey, memberId, {
          fromKind: fields.from_kind,
          fromId: fields.from_id,
          toKind: fields.to_kind,
          toId: fields.to_id,
          relation: fields.relation,
          clientToken: fields.client_token,
        });
        return NextResponse.json({ ok: true, id }, { status: 201, headers: { "Cache-Control": "no-store" } });
      }
      default:
        throw new ThemeHubError("対象の種類が不正だよ");
    }
  } catch (error) {
    if (error instanceof ThemeHubError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存できなかったよ" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string; trackKey: string }> }) {
  const { projectId, trackKey } = await params;
  const context = await getThemeHubWriteContext(request, projectId);
  if ("response" in context) return context.response;
  const memberId = context.access.memberId;
  const db = createAdminClient();
  try {
    await assertValidTrack(db, projectId, trackKey);
    const body: unknown = await request.json();
    if (!isRecord(body)) throw new ThemeHubError("入力内容が不正だよ");
    const fields = isRecord(body.fields) ? body.fields : {};
    const deleting = body.delete === true;

    switch (body.resource) {
      case "profile": {
        // pickPresent — only forward keys the caller actually sent. Building
        // `{ purposeMd: fields.purpose_md, ... }` unconditionally would put `purposeMd: undefined`
        // on the object for every field the caller omitted, and upsertThemeProfile's own
        // `"purposeMd" in fields` presence check would then see it as "present, please clear it".
        await upsertThemeProfile(
          db, projectId, trackKey, memberId,
          pickPresent(fields, { purpose_md: "purposeMd", current_state_md: "currentStateMd", next_focus_note: "nextFocusNote", history_rows: "historyRows" }),
          typeof body.expected_version === "number" ? body.expected_version : null,
        );
        return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
      }
      case "meeting": {
        const meetingId = typeof body.id === "string" ? body.id : "";
        if (!meetingId) throw new ThemeHubError("idが不正だよ");
        if (deleting) {
          // Theme-unlink stays allowed — it removes this theme's association, it does not write
          // new content into project_meeting_summaries.
          await unlinkMeeting(db, projectId, trackKey, meetingId, memberId, body.expected_version);
        } else {
          if (!THEME_HUB_MEETING_WRITE_ENABLED) {
            throw new ThemeHubError(THEME_HUB_MEETING_WRITE_BLOCKED_MESSAGE, 403);
          }
          await updateMeeting(
            db, projectId, meetingId,
            pickPresent(fields, { title: "title", meeting_date: "meetingDate", prep_draft_md: "prepDraftMd", summary_short: "summaryShort" }),
            body.expected_updated_at,
          );
        }
        return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
      }
      case "document": {
        const documentId = typeof body.id === "string" ? body.id : "";
        if (!documentId) throw new ThemeHubError("idが不正だよ");
        if (!deleting) throw new ThemeHubError("書類はリンクの作成/解除のみ対応しているよ");
        await unlinkDocument(db, projectId, trackKey, documentId, memberId, body.expected_version);
        return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
      }
      case "deliverable": {
        const id = typeof body.id === "string" ? body.id : "";
        if (!id) throw new ThemeHubError("idが不正だよ");
        if (deleting) {
          await deleteDeliverable(db, projectId, trackKey, id, memberId, body.expected_version);
        } else {
          await updateDeliverable(
            db, projectId, trackKey, id, memberId,
            pickPresent(fields, {
              title: "title", description_md: "descriptionMd", owner_member_id: "ownerMemberId",
              due_on: "dueOn", status: "status", linked_document_id: "linkedDocumentId",
            }),
            body.expected_version,
          );
        }
        return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
      }
      case "work_link": {
        const id = typeof body.id === "string" ? body.id : "";
        if (!id) throw new ThemeHubError("idが不正だよ");
        if (!deleting) throw new ThemeHubError("関連は作成/解除のみ対応しているよ");
        await deleteWorkLink(db, projectId, trackKey, id, memberId, body.expected_version);
        return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
      }
      default:
        throw new ThemeHubError("対象の種類が不正だよ");
    }
  } catch (error) {
    if (error instanceof ThemeHubError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存できなかったよ" }, { status: 500 });
  }
}
