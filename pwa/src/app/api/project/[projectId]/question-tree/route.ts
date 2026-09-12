import { NextRequest, NextResponse } from "next/server";

import { canAccessWorkspaceProject, getCurrentMemberAccess } from "@/lib/project-workspace";
import {
  getGoalTreeAssignmentView,
  getGoalTreePointsView,
  getQuestionTreeBundle,
} from "@/lib/question-tree";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ゴールツリーの読み書き。正本は pwa/spec/3-21-question-tree-current-spec.md と
 * pwa/spec/3-22-goal-tree-plan.md（到達点・MS・ptの型）。
 * clientからDBへ直接書かず、必ずここを通す。
 */

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;
/**
 * 読み取りは短く持たせる。編集する面なので参照系の既定（60秒）より短いが、
 * タブを行き来するたびの往復は消える（spec 5-10 の層2）。書き込みの戻り値で
 * クライアント側のキャッシュを置き換えるので、自分の変更が古く見えることはない。
 */
const READ_CACHE = {
  "Cache-Control": "private, max-age=15, stale-while-revalidate=120",
} as const;

type Resource =
  | "question"
  | "action"
  | "finding"
  | "question_action"
  | "question_finding"
  | "dependency"
  | "action_owner"
  | "question_milestone";

const TABLE: Record<Resource, string> = {
  question: "project_questions",
  action: "project_actions",
  finding: "project_findings",
  question_action: "project_question_actions",
  question_finding: "project_question_findings",
  dependency: "project_action_dependencies",
  action_owner: "project_action_owners",
  question_milestone: "project_question_milestones",
};

/** 画面から更新してよい列。導出値と監査列はここに含めない。 */
const EDITABLE: Record<Resource, string[]> = {
  question: [
    "parent_id", "contribution", "children_logic", "title", "background", "question_kind", "status",
    "answer", "answered_on", "answered_by", "drop_reason", "confidence",
    "owner_label", "due_date", "origin_question_id", "sort_order",
  ],
  action: [
    "parent_id", "title", "detail", "action_kind", "status", "owner_label",
    "planned_start", "planned_end", "actual_end", "date_certainty", "progress_pct",
    "blocker", "done_criteria", "done_evidence", "target", "actual", "unit",
    "origin_question_id", "sort_order",
    // 見積ptはアサインのときにPMが付ける。確定ptは検収（Phase 2）で入る。
    // accept_state は担当の付け外しに連動するので画面から直接は書かない。
    "estimated_pt", "accepted_pt",
    // タスクタブの緊急フラグ（OSスイートの やること と同じ）
    "urgent",
  ],
  finding: [
    "summary", "finding_kind", "observed_on", "source_label", "source_url",
    "confidence", "from_action_id", "sort_order",
  ],
  question_action: ["question_id", "action_id"],
  question_finding: ["question_id", "finding_id"],
  dependency: ["predecessor_action_id", "successor_action_id"],
  action_owner: ["action_id", "member_id"],
  question_milestone: ["question_id", "milestone_id"],
};

const REQUIRED_ON_CREATE: Record<Resource, string[]> = {
  question: ["title"],
  action: ["title"],
  finding: ["summary"],
  question_action: ["question_id", "action_id"],
  question_finding: ["question_id", "finding_id"],
  dependency: ["predecessor_action_id", "successor_action_id"],
  action_owner: ["action_id", "member_id"],
  question_milestone: ["question_id", "milestone_id"],
};

/** リンクは実体を持たないので論理削除しない。 */
const SOFT_DELETABLE: Resource[] = ["question", "action", "finding"];

/** pt は小数1桁。負は入れない（3-22 §6 原則6）。 */
const PT_FIELDS = new Set(["estimated_pt", "accepted_pt"]);

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
      // 丸めない。手動の並べ替えは前後の中点を書くので、整数へ潰すと隣と同値になる。
      out[key] = parsed;
      continue;
    }
    if (key === "urgent") {
      out[key] = value === true || value === "true";
      continue;
    }
    if (PT_FIELDS.has(key)) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error("ptは0以上の数で入れてね");
      if (parsed > 9999) throw new Error("ptが大きすぎるよ");
      out[key] = Math.round(parsed * 10) / 10;
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
  /**
   * contribution（required / alternative）は 2026-09-12 に画面から外した。
   * 「どれか1つでよいか」は親の children_logic が持ち、行そのものの種類は
   * question_kind（論点 / 仮説 / 決めること）が持つ（まさ確定 2026-09-12）。
   * 列とCHECK制約は履歴として残っているので、親があるときは required を補う。
   */
  const parentId = fields.parent_id ?? existing?.parent_id ?? null;
  const contribution = fields.contribution ?? existing?.contribution ?? null;
  if (parentId && !contribution) fields.contribution = "required";
  if (!parentId && contribution) fields.contribution = null;
}

/**
 * 到達点の置き場所。到達点はツリーのいちばん上だけ（DBのCHECKでも同じ）。
 *
 * MSの置き場所は縛らない（まさ確定 2026-09-12「それぞれの項目ごとに論点、仮説、TODOと
 * 選べるところにMSを追加して、自分でMSかどうか決められるようにして」）。
 * 以前は「MSは到達点の直下だけ」をこことDBのtriggerで縛っていたが、
 * MSの下にMSを置けず、ある行をMSにするかどうかを人が決められなかった。
 */
function assertGoalTreePlacement(
  fields: Record<string, unknown>,
  existing?: Record<string, unknown>,
) {
  const kind = (fields.question_kind ?? existing?.question_kind ?? "open") as string;
  const parentId = (fields.parent_id ?? existing?.parent_id ?? null) as string | null;

  if (kind === "goal" && parentId) {
    throw new Error("到達点はツリーのいちばん上にしか置けないよ");
  }
}

function assertActionRules(fields: Record<string, unknown>, existing?: Record<string, unknown>) {
  const status = (fields.status ?? existing?.status) as string | undefined;
  if (status === "done") {
    const actualEnd = (fields.actual_end ?? existing?.actual_end) as string | null | undefined;
    if (!actualEnd) throw new Error("完了にするには完了日が要るよ");
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const context = await getWorkspaceContext(projectId);
  if ("response" in context) return context.response;
  try {
    const canManage = context.access.scope === "portfolio" || context.access.isAdmin;

    // 割り振りセッション（3-22 §4）がまとめて読むための面。
    // 未アサインのTODOを、到達点からの道・MS・前後関係つきで返す。
    if (request.nextUrl.searchParams.get("view") === "unassigned") {
      if (!canManage) {
        return NextResponse.json({ error: "共有情報の更新権限がないよ" }, { status: 403 });
      }
      const view = await getGoalTreeAssignmentView(projectId);
      return NextResponse.json(view, { headers: READ_CACHE });
    }

    // ptを並べて比べる面（MS・月次タブ）。ツリーとガントには出さない数字なので、
    // ここも権限のある人だけに返す。
    if (request.nextUrl.searchParams.get("view") === "points") {
      if (!canManage) {
        return NextResponse.json({ error: "共有情報の更新権限がないよ" }, { status: 403 });
      }
      const view = await getGoalTreePointsView(projectId);
      return NextResponse.json(view, { headers: READ_CACHE });
    }

    const bundle = await getQuestionTreeBundle(projectId, canManage);
    return NextResponse.json(bundle, { headers: READ_CACHE });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ゴールツリーを取得できなかったよ" },
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

    // 掴んで動かす操作。兄弟の間へ落とせば並びが変わり、別の問いの上へ落とせば
    // その子になる。並び替えと親の付け替えを1回のDB関数でまとめて確定する。
    if (body.resource === "question_move") {
      const fields = isRecord(body.fields) ? body.fields : {};
      const movedId = typeof fields.id === "string" ? fields.id : "";
      if (!movedId) throw new Error("動かす問いが分からないよ");
      const rawParent = fields.parent_id;
      const newParentId =
        rawParent === null || rawParent === undefined || rawParent === "" ? null : String(rawParent);
      const orderedIds = Array.isArray(fields.ordered_ids)
        ? fields.ordered_ids.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [];
      if (orderedIds.length === 0) throw new Error("並び順が空だよ");

      const db = createAdminClient();
      const { error } = await db.rpc("reorder_project_questions", {
        p_project_id: projectId,
        p_moved_id: movedId,
        p_new_parent_id: newParentId,
        p_ordered_ids: orderedIds,
        p_changed_by: context.access.memberId ?? "",
      });
      if (error) throw new Error(error.message);

      const bundle = await getQuestionTreeBundle(projectId, true);
      return NextResponse.json({ bundle }, { headers: NO_STORE });
    }

    // つくよみが拾ったものを人が確定する。承認で初めてツリーへ線が入り、
    // 却下は論理削除にして、同じものを次の巡回で拾い直させない（spec 3-21）。
    /**
     * 提案をまとめて確定する。まさ確定 2026-09-12 で、まさが手で入れていない233件を
     * 提案へ戻した。1件ずつ押させると233回になるので、選んだぶんを1回で通す。
     * 承認したときは、提案が持っている「元いた場所」へそのまま戻す。
     */
    if (body.resource === "proposal_bulk") {
      const ids = Array.isArray(body.ids)
        ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [];
      const accept = body.decision !== "reject";
      if (ids.length === 0) throw new Error("選ばれていないよ");
      if (ids.length > 500) throw new Error("1回に確定できるのは500件までだよ");

      const db = createAdminClient();
      const { data: rows, error: readError } = await db
        .from("project_actions")
        .select("id,proposed_question_id")
        .eq("project_id", projectId)
        .eq("review_state", "proposed")
        .is("deleted_at", null)
        .in("id", ids);
      if (readError) throw new Error(readError.message);
      const targets = (rows ?? []) as { id: string; proposed_question_id: string | null }[];

      if (accept) {
        const { error } = await db
          .from("project_actions")
          .update({
            review_state: "accepted",
            last_verified_at: todayJst(),
            updated_by: context.access.memberId ?? null,
          })
          .eq("project_id", projectId)
          .in("id", targets.map((row) => row.id));
        if (error) throw new Error(error.message);

        // 元いた場所へ戻す。線が既にあれば足さない。
        const links = targets
          .filter((row) => row.proposed_question_id)
          .map((row) => ({
            project_id: projectId,
            question_id: row.proposed_question_id as string,
            action_id: row.id,
          }));
        if (links.length > 0) {
          const { error: linkError } = await db
            .from("project_question_actions")
            .upsert(links, { onConflict: "question_id,action_id", ignoreDuplicates: true });
          if (linkError && !linkError.message.includes("duplicate")) throw new Error(linkError.message);
        }
      } else {
        const { error } = await db
          .from("project_actions")
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by: context.access.memberId ?? null,
          })
          .eq("project_id", projectId)
          .in("id", targets.map((row) => row.id));
        if (error) throw new Error(error.message);
      }

      const bundle = await getQuestionTreeBundle(projectId, true);
      return NextResponse.json({ applied: targets.length, bundle }, { headers: NO_STORE });
    }

    if (body.resource === "proposal_accept" || body.resource === "proposal_reject") {
      const fields = isRecord(body.fields) ? body.fields : {};
      const kind = fields.kind;
      const id = typeof fields.id === "string" ? fields.id : "";
      if (kind !== "question" && kind !== "action" && kind !== "finding") throw new Error("扱えない種類だよ");
      if (!id) throw new Error("どれを確定するのか分からないよ");

      const table = kind === "question" ? "project_questions" : kind === "action" ? "project_actions" : "project_findings";
      const db = createAdminClient();
      const { data: row, error: readError } = await db
        .from(table)
        .select("*")
        .eq("id", id)
        .eq("project_id", projectId)
        .eq("review_state", "proposed")
        .is("deleted_at", null)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!row) throw new Error("未確認の項目を見つけられなかったよ");

      const record = row as Record<string, unknown>;
      if (body.resource === "proposal_reject") {
        const { error } = await db
          .from(table)
          .update({ deleted_at: new Date().toISOString(), deleted_by: context.access.memberId ?? null })
          .eq("id", id)
          .eq("project_id", projectId);
        if (error) throw new Error(error.message);
      } else if (kind === "question") {
        const parentId = (record.proposed_parent_id as string | null) ?? null;
        const patch: Record<string, unknown> = {
          review_state: "accepted",
          parent_id: parentId,
          contribution: parentId ? (record.proposed_contribution as string | null) ?? "required" : null,
          last_verified_at: todayJst(),
          updated_by: context.access.memberId ?? null,
        };
        const { error } = await db.from(table).update(patch).eq("id", id).eq("project_id", projectId);
        if (error) throw new Error(error.message);
      } else {
        const questionId = (record.proposed_question_id as string | null) ?? null;
        const { error } = await db
          .from(table)
          .update({
            review_state: "accepted",
            last_verified_at: todayJst(),
            updated_by: context.access.memberId ?? null,
          })
          .eq("id", id)
          .eq("project_id", projectId);
        if (error) throw new Error(error.message);
        if (questionId) {
          const linkTable = kind === "action" ? "project_question_actions" : "project_question_findings";
          const linkRow =
            kind === "action"
              ? { project_id: projectId, question_id: questionId, action_id: id }
              : { project_id: projectId, question_id: questionId, finding_id: id };
          const { error: linkError } = await db.from(linkTable).insert(linkRow);
          // すでに同じ線があるだけなら通す。線が無いまま「承認済み」にしない。
          if (linkError && !linkError.message.includes("duplicate")) throw new Error(linkError.message);
        }
      }

      const bundle = await getQuestionTreeBundle(projectId, true);
      return NextResponse.json({ bundle }, { headers: NO_STORE });
    }

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
    if (resource === "question") assertGoalTreePlacement(fields);
    const insert: Record<string, unknown> = { ...fields, project_id: projectId };
    if (SOFT_DELETABLE.includes(resource)) {
      insert.last_verified_at = todayJst();
      insert.created_by = context.access.memberId ?? null;
      insert.updated_by = context.access.memberId ?? null;
      /**
       * まさ確定 2026-09-12「タスクとかゴールツリーは、おれが自分で入れないといけない。
       * えいみに入れてもらう場合には、おれが承認してから追加にしないとだめだ」。
       *
       * 画面で人が押した書き込みだけが、そのままツリーへ入る。えいみがスクリプトから
       * 入れたものは提案として置き、まさが承認するまでツリーに出ない。
       */
      const fromScreen = request.headers.get("x-amd-os-actor") === "screen";
      insert.origin_kind = insert.origin_kind ?? (fromScreen ? "manual" : "automation");
      insert.review_state = fromScreen ? "accepted" : "proposed";
      if (!fromScreen && !insert.proposal_reason) {
        insert.proposal_reason = "えいみが入れた。まさの承認を待っている";
      }
    }
    if (resource === "action_owner" || resource === "question_milestone") {
      insert.created_by = context.access.memberId ?? null;
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

    /**
     * 割り振りのまとめ書き込み（3-22 §4）。担当・期限・見積ptは、まさかPMが
     * セッションでえいみと決め、えいみがここへ渡す。1件ずつ何十回も投げると
     * 途中で落ちたときに半端に入るので、DB関数で1トランザクションにする。
     *
     * items: [{ action_id, planned_start?, planned_end?, estimated_pt?, member_ids? }]
     * キーが無い項目は触らない。member_ids を渡したときだけ担当を入れ替える。
     */
    // タスクの並べ替え。中点が潰れて全体を振り直すときだけ通る。
    // 1件ずつ投げると並びが途中で見えるので、1トランザクションで確定する。
    if (body.resource === "action_reorder") {
      const ids = Array.isArray(body.ordered_ids)
        ? body.ordered_ids.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [];
      if (ids.length === 0) throw new Error("並び順が空だよ");
      const db = createAdminClient();
      const { error } = await db.rpc("reorder_project_actions", {
        p_project_id: projectId,
        p_ordered_ids: ids,
        p_changed_by: context.access.memberId ?? null,
      });
      if (error) throw new Error(error.message);
      const bundle = await getQuestionTreeBundle(projectId, true);
      return NextResponse.json({ bundle }, { headers: NO_STORE });
    }

    if (body.resource === "action_bulk") {
      const items = Array.isArray(body.items) ? body.items : null;
      if (!items) throw new Error("items を配列で渡してね");
      if (items.length === 0) throw new Error("items が空だよ");
      if (items.length > 200) throw new Error(`1回に渡せるのは200件までだよ（いまは${items.length}件）`);
      for (const item of items) {
        if (!isRecord(item) || typeof item.action_id !== "string" || !item.action_id) {
          throw new Error("どの項目にも action_id が要るよ");
        }
      }

      const db = createAdminClient();
      const { data, error } = await db.rpc("apply_goal_tree_assignments", {
        p_project_id: projectId,
        p_items: items,
        p_changed_by: context.access.memberId ?? null,
      });
      if (error) throw new Error(error.message);

      const bundle = await getQuestionTreeBundle(projectId, true);
      return NextResponse.json({ applied: data ?? null, bundle }, { headers: NO_STORE });
    }

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
    if (resource === "question") {
      assertGoalTreePlacement(fields, existing as Record<string, unknown>);
    }

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
        // 到達点を消すと直下のMSは根へ上がるが、MSは到達点の直下にしか置けない。
        // 種類を論点へ戻してから上げる（消さずに残す、を優先する）。
        const { error: demoteError } = await db
          .from("project_questions")
          .update({ question_kind: "open" })
          .eq("parent_id", id)
          .eq("project_id", projectId)
          .eq("question_kind", "milestone")
          .is("deleted_at", null);
        if (demoteError) throw new Error(demoteError.message);

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
