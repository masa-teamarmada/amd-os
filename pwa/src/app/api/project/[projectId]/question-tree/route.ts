import { NextRequest, NextResponse } from "next/server";

import { canAccessWorkspaceProject, getCurrentMemberAccess } from "@/lib/project-workspace";
import { getQuestionTreeBundle } from "@/lib/question-tree";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 問いの木の読み書き。正本は pwa/spec/3-21-question-tree-current-spec.md。
 * clientからDBへ直接書かず、必ずここを通す。
 */

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

type Resource = "question" | "action" | "finding" | "question_action" | "question_finding" | "dependency";

const TABLE: Record<Resource, string> = {
  question: "project_questions",
  action: "project_actions",
  finding: "project_findings",
  question_action: "project_question_actions",
  question_finding: "project_question_findings",
  dependency: "project_action_dependencies",
};

/** 画面から更新してよい列。導出値と監査列はここに含めない。 */
const EDITABLE: Record<Resource, string[]> = {
  question: [
    "parent_id", "contribution", "title", "background", "question_kind", "status",
    "answer", "answered_on", "answered_by", "drop_reason", "confidence",
    "owner_label", "due_date", "origin_question_id", "sort_order",
  ],
  action: [
    "parent_id", "title", "detail", "action_kind", "status", "owner_label",
    "planned_start", "planned_end", "actual_end", "date_certainty", "progress_pct",
    "blocker", "done_criteria", "done_evidence", "target", "actual", "unit",
    "origin_question_id", "sort_order",
  ],
  finding: [
    "summary", "finding_kind", "observed_on", "source_label", "source_url",
    "confidence", "from_action_id", "sort_order",
  ],
  question_action: ["question_id", "action_id"],
  question_finding: ["question_id", "finding_id"],
  dependency: ["predecessor_action_id", "successor_action_id"],
};

const REQUIRED_ON_CREATE: Record<Resource, string[]> = {
  question: ["title"],
  action: ["title"],
  finding: ["summary"],
  question_action: ["question_id", "action_id"],
  question_finding: ["question_id", "finding_id"],
  dependency: ["predecessor_action_id", "successor_action_id"],
};

/** リンクは実体を持たないので論理削除しない。 */
const SOFT_DELETABLE: Resource[] = ["question", "action", "finding"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asResource(value: unknown): Resource {
  if (typeof value === "string" && value in TABLE) return value as Resource;
  throw new Error("扱えない種類だよ");
}

function todayJst(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

async function getWorkspaceContext(projectId: string) {
  const access = await getCurrentMemberAccess();
  if (!access) return { response: NextResponse.json({ error: "ログインが必要だよ" }, { status: 401 }) };
  if (!canAccessWorkspaceProject(access, projectId)) {
    return { response: NextResponse.json({ error: "このPJの共有情報には入れないよ" }, { status: 404 }) };
  }
  return { access };
}

async function getManagerContext(projectId: string) {
  const context = await getWorkspaceContext(projectId);
  if ("response" in context) return context;
  if (context.access.scope !== "portfolio" && !context.access.isAdmin) {
    return { response: NextResponse.json({ error: "共有情報の更新権限がないよ" }, { status: 403 }) };
  }
  return context;
}

/**
 * 画面から届いた値を、その列に入れてよい形へ揃える。
 * 空文字は NULL にする（「未入力」と「空文字」を別物にしない）。
 */
function sanitize(resource: Resource, input: Record<string, unknown>): Record<string, unknown> {
  const allowed = EDITABLE[resource];
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.includes(key)) continue;
    if (value === null || value === "") {
      out[key] = null;
      continue;
    }
    if (key === "progress_pct") {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) throw new Error("進捗は0〜100だよ");
      out[key] = Math.round(parsed);
      continue;
    }
    if (key === "sort_order") {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new Error("並び順が数字じゃないよ");
      out[key] = Math.round(parsed);
      continue;
    }
    if (typeof value !== "string") throw new Error(`${key} の形が違うよ`);
    const trimmed = value.trim();
    out[key] = trimmed === "" ? null : trimmed;
  }
  return out;
}

/**
 * 閉じるときの決まりを、DBのCHECKに任せず先に説明つきで弾く。
 * 「答え1行で閉じられる」代わりに、答えなしでは閉じられない。
 */
function assertQuestionRules(fields: Record<string, unknown>, existing?: Record<string, unknown>) {
  const status = (fields.status ?? existing?.status) as string | undefined;
  if (status === "answered") {
    const answer = (fields.answer ?? existing?.answer) as string | null | undefined;
    if (!answer || String(answer).trim() === "") {
      throw new Error("答えを1行書かないと閉じられないよ");
    }
  }
  if (status === "dropped") {
    const reason = (fields.drop_reason ?? existing?.drop_reason) as string | null | undefined;
    if (!reason || String(reason).trim() === "") {
      throw new Error("追わないと決めた理由を書いてね");
    }
  }
  const parentId = fields.parent_id ?? existing?.parent_id ?? null;
  const contribution = fields.contribution ?? existing?.contribution ?? null;
  if (parentId && !contribution) {
    throw new Error("親のある問いには「必須」か「代替」を選んでね");
  }
  if (!parentId && contribution) {
    throw new Error("根の問いに「必須／代替」は付かないよ");
  }
}

function assertActionRules(fields: Record<string, unknown>, existing?: Record<string, unknown>) {
  const status = (fields.status ?? existing?.status) as string | undefined;
  if (status === "done") {
    const actualEnd = (fields.actual_end ?? existing?.actual_end) as string | null | undefined;
    if (!actualEnd) throw new Error("完了にするには完了日が要るよ");
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const context = await getWorkspaceContext(projectId);
  if ("response" in context) return context.response;
  try {
    const canManage = context.access.scope === "portfolio" || context.access.isAdmin;
    const bundle = await getQuestionTreeBundle(projectId, canManage);
    return NextResponse.json(bundle, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "問いの木を取得できなかったよ" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const context = await getManagerContext(projectId);
  if ("response" in context) return context.response;
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) throw new Error("追加内容が不正だよ");
    const resource = asResource(body.resource);
    const rawFields = body.fields ?? body.payload;
    if (!isRecord(rawFields)) throw new Error("入力が空だよ");

    const fields = sanitize(resource, rawFields);
    for (const key of REQUIRED_ON_CREATE[resource]) {
      if (!fields[key]) throw new Error(`${key === "title" ? "見出し" : key === "summary" ? "分かったこと" : key} が空だよ`);
    }
    if (resource === "question") assertQuestionRules(fields);
    if (resource === "action") assertActionRules(fields);

    const db = createAdminClient();
    const insert: Record<string, unknown> = { ...fields, project_id: projectId };
    if (SOFT_DELETABLE.includes(resource)) {
      insert.last_verified_at = todayJst();
      insert.origin_kind = insert.origin_kind ?? "manual";
      insert.created_by = context.access.memberId ?? null;
      insert.updated_by = context.access.memberId ?? null;
    }

    const { data, error } = await db.from(TABLE[resource]).insert(insert).select("id").single();
    if (error) throw new Error(error.message);

    const bundle = await getQuestionTreeBundle(projectId, true);
    return NextResponse.json({ id: data?.id ?? null, bundle }, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "追加できなかったよ" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const context = await getManagerContext(projectId);
  if ("response" in context) return context.response;
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) throw new Error("更新内容が不正だよ");
    const resource = asResource(body.resource);
    if (!SOFT_DELETABLE.includes(resource)) throw new Error("つなぎは付け外しで直してね");
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) throw new Error("どれを直すのか分からないよ");
    const rawFields = body.fields ?? body.payload;
    if (!isRecord(rawFields)) throw new Error("変更が空だよ");

    const fields = sanitize(resource, rawFields);
    if (Object.keys(fields).length === 0) throw new Error("変更が空だよ");

    const db = createAdminClient();
    const { data: existing, error: readError } = await db
      .from(TABLE[resource])
      .select("*")
      .eq("id", id)
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!existing) throw new Error("元の項目を見つけられなかったよ");

    if (resource === "question") assertQuestionRules(fields, existing as Record<string, unknown>);
    if (resource === "action") assertActionRules(fields, existing as Record<string, unknown>);

    // 答えを書いた時点で、日付と書いた人を自動で残す。人に二度入力させない。
    if (resource === "question" && fields.status === "answered") {
      fields.answered_on = fields.answered_on ?? todayJst();
      fields.answered_by = fields.answered_by ?? context.access.displayName ?? context.access.memberId ?? null;
    }
    if (resource === "action" && fields.status === "done" && !fields.actual_end) {
      fields.actual_end = todayJst();
    }

    const patch: Record<string, unknown> = {
      ...fields,
      last_verified_at: todayJst(),
      updated_by: context.access.memberId ?? null,
      version: Number((existing as Record<string, unknown>).version ?? 1) + 1,
    };

    const { error } = await db.from(TABLE[resource]).update(patch).eq("id", id).eq("project_id", projectId);
    if (error) throw new Error(error.message);

    const bundle = await getQuestionTreeBundle(projectId, true);
    return NextResponse.json({ bundle }, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新できなかったよ" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const context = await getManagerContext(projectId);
  if ("response" in context) return context.response;
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) throw new Error("削除内容が不正だよ");
    const resource = asResource(body.resource);
    const db = createAdminClient();

    if (!SOFT_DELETABLE.includes(resource)) {
      // つなぎは実体を持たないので、行ごと外す。
      const fields = sanitize(resource, isRecord(body.fields) ? body.fields : {});
      let query = db.from(TABLE[resource]).delete().eq("project_id", projectId);
      for (const key of EDITABLE[resource]) {
        const value = fields[key];
        if (!value) throw new Error("外す相手が分からないよ");
        query = query.eq(key, value as string);
      }
      const { error } = await query;
      if (error) throw new Error(error.message);
    } else {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) throw new Error("どれを消すのか分からないよ");
      const { error } = await db
        .from(TABLE[resource])
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: context.access.memberId ?? null,
        })
        .eq("id", id)
        .eq("project_id", projectId);
      if (error) throw new Error(error.message);

      // 親を消しても子は残す。ただし親から見た役割は意味を失うので、
      // 子を根へ上げて印を外す。子ごと道連れにしない。
      if (resource === "question") {
        const { error: orphanError } = await db
          .from("project_questions")
          .update({ parent_id: null, contribution: null })
          .eq("parent_id", id)
          .eq("project_id", projectId)
          .is("deleted_at", null);
        if (orphanError) throw new Error(orphanError.message);
      }
      if (resource === "action") {
        const { error: orphanError } = await db
          .from("project_actions")
          .update({ parent_id: null })
          .eq("parent_id", id)
          .eq("project_id", projectId)
          .is("deleted_at", null);
        if (orphanError) throw new Error(orphanError.message);
      }
    }

    const bundle = await getQuestionTreeBundle(projectId, true);
    return NextResponse.json({ bundle }, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "消せなかったよ" },
      { status: 400 },
    );
  }
}
