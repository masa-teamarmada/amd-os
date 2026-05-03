/**
 * シグナル → 既存ストーリーへの紐付け or 新規ストーリー作成 を判定する共通ヘルパー。
 * Server-side のみ（service_role の Supabase + Anthropic を呼ぶ）。
 *
 * 使用箇所:
 *  - /api/cron/atlas-collect (毎朝の自動収集)
 *  - /api/atlas/backfill (期間遡及投入)
 *  - /api/atlas/seed (一括投入)
 *  - /api/atlas/match-stories (既存シグナルのバッチ処理)
 */

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface StoryMatchInput {
  title: string;
  content: string;
  domain: string | null;
  tags: string[];
}

interface ExistingStory {
  id: string;
  title: string;
  summary: string | null;
  tags: string[] | null;
  primary_domain: string | null;
}

/** 過去のユーザー統合履歴（学習プロンプト用） */
async function fetchRecentMergeExamples(
  db: SupabaseClient,
  limit = 12
): Promise<Array<{ from: string; to: string; reason: string | null }>> {
  const { data, error } = await db
    .from("atlas_story_merges")
    .select("merged_from_title, merged_to_title, reason")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []).map((r) => ({
    from: r.merged_from_title as string,
    to: r.merged_to_title as string,
    reason: (r.reason as string | null) || null,
  }));
}

/** 候補となる既存ストーリー（ongoing & 直近Nヶ月）を取得 */
async function fetchCandidateStories(
  db: SupabaseClient,
  domain: string | null,
  monthsBack = 4
): Promise<ExistingStory[]> {
  const since = new Date(
    Date.now() - monthsBack * 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  let q = db
    .from("atlas_stories")
    .select("id, title, summary, tags, primary_domain")
    .eq("status", "ongoing")
    .gte("last_updated_at", since)
    .order("last_updated_at", { ascending: false })
    .limit(60);
  // ドメイン絞り込み（同分野のみマッチ候補にする）
  if (domain) {
    const head = domain.charAt(0);
    q = q.or(`primary_domain.is.null,primary_domain.like.${head}%`);
  }
  const { data, error } = await q;
  if (error) {
    console.error("fetchCandidateStories:", error.message);
    return [];
  }
  return (data || []) as ExistingStory[];
}

/**
 * 新規シグナルがあったときに、既存ストーリーへ紐付けるか新規作成するかを LLM 判定して
 * story_id を返す。失敗時は null（呼び元はそれでも signal を投入する）。
 */
export async function matchOrCreateStory(
  signal: StoryMatchInput,
  db: SupabaseClient,
  anthropic: Anthropic
): Promise<string | null> {
  const [candidates, mergeExamples] = await Promise.all([
    fetchCandidateStories(db, signal.domain),
    fetchRecentMergeExamples(db),
  ]);

  const list = candidates
    .map(
      (s, i) =>
        `${i + 1}. id=${s.id}\n   title: ${s.title}\n   summary: ${s.summary || ""}\n   tags: ${(s.tags || []).join(", ")}\n   domain: ${s.primary_domain || ""}`
    )
    .join("\n\n");

  const mergeHints =
    mergeExamples.length > 0
      ? mergeExamples
          .map(
            (m, i) =>
              `${i + 1}. 「${m.from}」⇄「${m.to}」 ${m.reason ? `(理由: ${m.reason})` : ""}`
          )
          .join("\n")
      : "(なし)";

  const prompt = `あなたは AMD Atlas のシグナル整理エディタ。
新しいシグナルが既存ストーリー（同じ事象の進行 / 関連した事象の連続体）に属するか判定してください。

判定基準:
- 「同じ実体の継続/進行」(例: ホルムズ封鎖→海運迂回→再開通) は同じストーリー
- 「同じ業界の独立イベント」は別ストーリー
- 「似てるが論点が違う」は別ストーリー（例: 中国のリチウム規制 vs 中国のガリウム規制 — どちらも輸出規制だが論点別なので別）
- 期間が空いていても、同じ実体の続報なら同じストーリー

== 過去にユーザーが「同じストーリー」と判断した統合事例（学習用） ==
これらのペアは別々に出てきたが、後でユーザーが手動で統合した。同様のパターンを見つけたら積極的に既存ストーリーに紐付けること。
${mergeHints}

== 新規シグナル ==
タイトル: ${signal.title}
内容: ${signal.content}
分野: ${signal.domain || "—"}
タグ: ${signal.tags.join(", ")}

== 既存ストーリー候補 (ongoing & 直近4ヶ月) ==
${list || "(候補なし)"}

JSON のみ返答。コードフェンス・前置き不要:
- 既存に属する: {"matched": true, "story_id": "uuid", "reason": "短い理由"}
- 新規作成: {"matched": false, "new_story": {"title": "60字以内・実体ベースの見出し", "summary": "100-200字でストーリーの輪郭", "importance": "high|medium|low", "tags": ["..."], "primary_domain": "C.素材・原料"}}

新規ストーリーの title は「ホルムズ海峡危機」「リチウム供給逼迫」「中国希土類輸出規制」のように、実体・主題を表す名詞句で。記事タイトルを流用しない。`;

  let parsed: Record<string, unknown>;
  try {
    const r = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const block = r.content[0];
    const text = block?.type === "text" ? block.text : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    parsed = JSON.parse(m[0]);
  } catch (e) {
    console.error("matchOrCreateStory LLM err:", e);
    return null;
  }

  const matched = (parsed.matched as boolean) === true;

  if (matched && typeof parsed.story_id === "string") {
    // LLM が UUID を歪めて返すことがあるので候補リストの ID と照合 + 厳格な UUID 形式チェック
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const sid = parsed.story_id.trim();
    const validId = uuidRe.test(sid) && candidates.some((c) => c.id === sid) ? sid : null;
    if (validId) {
      await db
        .from("atlas_stories")
        .update({ last_updated_at: new Date().toISOString() })
        .eq("id", validId);
      return validId;
    }
    console.warn("matchOrCreateStory: invalid story_id from LLM", parsed.story_id);
    // 不正IDなら新規ストーリーを作る方向にフォールバック
  }

  const newStory = parsed.new_story as
    | {
        title?: string;
        summary?: string;
        importance?: string;
        tags?: unknown[];
        primary_domain?: string;
      }
    | undefined;
  if (newStory && newStory.title) {
    const tags = Array.isArray(newStory.tags)
      ? newStory.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 16)
      : [];
    const importance =
      newStory.importance === "high" ||
      newStory.importance === "medium" ||
      newStory.importance === "low"
        ? newStory.importance
        : "medium";

    const { data, error } = await db
      .from("atlas_stories")
      .insert({
        title: newStory.title.slice(0, 200),
        summary: newStory.summary || null,
        importance,
        tags,
        primary_domain: newStory.primary_domain || signal.domain || null,
        started_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        signal_count: 0, // signal 投入後に増える(後で手当て)
      })
      .select("id")
      .single();
    if (error) {
      console.error("insert atlas_stories err:", error.message);
      return null;
    }
    return (data?.id as string) || null;
  }
  return null;
}

/**
 * signal 投入時に呼ぶラッパー: signal_count をインクリメントしつつ story_id を返す。
 * 投入元 (cron-collect / backfill / seed) は insert する row に story_id を付与する。
 */
export async function attachStory(
  signal: StoryMatchInput,
  db: SupabaseClient,
  anthropic: Anthropic
): Promise<string | null> {
  const storyId = await matchOrCreateStory(signal, db, anthropic);
  if (!storyId) return null;
  // signal_count を進める（雑な race 条件は許容、Phase 1 では integrity 優先しない）
  const { data: current } = await db
    .from("atlas_stories")
    .select("signal_count")
    .eq("id", storyId)
    .single();
  const next = ((current?.signal_count as number) || 0) + 1;
  await db
    .from("atlas_stories")
    .update({ signal_count: next })
    .eq("id", storyId);
  return storyId;
}
