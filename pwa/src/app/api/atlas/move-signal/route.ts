import { NextResponse, type NextRequest } from "next/server";
import { getBackgroundAnthropic } from "@/lib/anthropic-client";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/supabase/api-auth";

/**
 * 1つのシグナルを別ストーリーに移植 / 切り離し / 新ストーリー化する。
 *
 * action:
 *   - "detach": ストーリーから外す（story_id = null）
 *   - "moveToExisting": 別の既存ストーリーに付け替え（targetStoryId 必須）
 *   - "createNew": 新ストーリーを作って付け替え（タイトルは LLM 提案 or ユーザー指定）
 *
 * 副次処理:
 *   - 元ストーリーの signal_count を再計算、0 になったら delete
 *   - 移植先ストーリーの signal_count / tags / last_updated_at を更新
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: {
    signalId?: string;
    action?: "detach" | "moveToExisting" | "createNew";
    targetStoryId?: string;
    newStoryTitle?: string;
    newStorySummary?: string;
    useLlmProposal?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { signalId, action } = body;
  if (!signalId || !action) {
    return NextResponse.json({ error: "signalId and action required" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "supabase env missing" }, { status: 500 });
  }
  const db = createClient(url, key);

  // シグナル取得
  const { data: signal, error: sigErr } = await db
    .from("atlas_signals")
    .select("*")
    .eq("id", signalId)
    .single();
  if (sigErr || !signal) {
    return NextResponse.json(
      { error: `signal not found: ${sigErr?.message}` },
      { status: 404 }
    );
  }
  const fromStoryId: string | null = signal.story_id;

  let newStoryId: string | null = null;

  if (action === "detach") {
    const { error } = await db
      .from("atlas_signals")
      .update({ story_id: null })
      .eq("id", signalId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (action === "moveToExisting") {
    if (!body.targetStoryId) {
      return NextResponse.json(
        { error: "targetStoryId required for moveToExisting" },
        { status: 400 }
      );
    }
    const { error } = await db
      .from("atlas_signals")
      .update({ story_id: body.targetStoryId })
      .eq("id", signalId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    newStoryId = body.targetStoryId;
  } else if (action === "createNew") {
    let title = body.newStoryTitle?.trim() || "";
    let summary = body.newStorySummary?.trim() || "";

    // LLM 提案モード: signal の内容から新ストーリー骨子を提案させる
    if (body.useLlmProposal || !title) {
      try {
        const anthropic = getBackgroundAnthropic("atlas/move-signal");
        const r = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          messages: [
            {
              role: "user",
              content: `次のシグナルを単独で1つの新規ストーリーとして立てたい。
タイトルは「ホルムズ海峡危機」「中国希土類輸出規制」のような実体ベースの名詞句にすること。

シグナル:
タイトル: ${signal.title}
内容: ${signal.content}
分野: ${signal.domain || "—"}

JSON のみで返答（前置き不要）:
{"title": "60字以内の実体ベースの名詞句", "summary": "100-200字でストーリーの輪郭"}`,
            },
          ],
        });
        const block = r.content[0];
        const text = block?.type === "text" ? block.text : "";
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]) as {
            title?: string;
            summary?: string;
          };
          if (!title && parsed.title) title = parsed.title;
          if (!summary && parsed.summary) summary = parsed.summary;
        }
      } catch (e) {
        console.warn("createNew LLM proposal err:", e);
      }
    }

    if (!title) title = signal.title.slice(0, 60);

    const tags = Array.isArray(signal.suggested_tags)
      ? (signal.suggested_tags as string[])
      : [];

    const { data: newStory, error: createErr } = await db
      .from("atlas_stories")
      .insert({
        title,
        summary: summary || null,
        importance: signal.importance,
        tags,
        primary_domain: signal.domain || null,
        started_at: signal.submitted_at,
        last_updated_at: new Date().toISOString(),
        signal_count: 1,
      })
      .select("id")
      .single();
    if (createErr || !newStory) {
      return NextResponse.json(
        { error: `create new story failed: ${createErr?.message}` },
        { status: 500 }
      );
    }
    newStoryId = newStory.id as string;

    const { error: updErr } = await db
      .from("atlas_signals")
      .update({ story_id: newStoryId })
      .eq("id", signalId);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  } else {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  // 元ストーリーの signal_count を再計算、空なら削除
  if (fromStoryId) {
    const { count } = await db
      .from("atlas_signals")
      .select("id", { count: "exact", head: true })
      .eq("story_id", fromStoryId);
    if ((count ?? 0) === 0) {
      await db.from("atlas_stories").delete().eq("id", fromStoryId);
    } else {
      await db
        .from("atlas_stories")
        .update({
          signal_count: count ?? 0,
          last_updated_at: new Date().toISOString(),
        })
        .eq("id", fromStoryId);
    }
  }

  // 移植先ストーリーの signal_count / last_updated_at 更新
  if (newStoryId && action === "moveToExisting") {
    const { count: tCount } = await db
      .from("atlas_signals")
      .select("id", { count: "exact", head: true })
      .eq("story_id", newStoryId);
    await db
      .from("atlas_stories")
      .update({
        signal_count: tCount ?? 1,
        last_updated_at: new Date().toISOString(),
      })
      .eq("id", newStoryId);
  }

  return NextResponse.json({ ok: true, newStoryId });
}
