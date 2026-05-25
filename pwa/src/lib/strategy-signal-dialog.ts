/**
 * strategy-signal-dialog.ts — まさ #34 対話型修正依頼 (2026-05-25 #71 確定) の共通 helper
 *
 * 経営ハイライト (= L2 ⑨ project_strategy_signal) の修正依頼を対話形式で扱う。
 * 旧 reextractStrategySignalImmediate (= 一方通行 update) を置換。
 *
 * 設計の正本: pwa/design/feedback_dialog.md (案 A = dialog 永続化なし)
 *
 * 公開関数:
 *  - fetchSignalContext: project_strategy_signal を 1 件 fetch + 過去 feedback fetch
 *  - generateProposal:    Anthropic Sonnet で改訂案を生成 (= conversation を context にする)
 *  - applyProposal:       まさ承認時に signal update + l2_feedbacks INSERT + applied_count++
 *
 * dialog ID は client 側で UUID 発行。server は state 持たない (= telemetry / log のみ)。
 */
import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type DialogMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; proposed: ProposedSignal; reasoning: string; applied_feedback_summary: string };

export type ProposedSignal = {
  title: string;
  summary: string;
  impact_level: string;
  signal_type: string;
  polarity: string | null;
  score_impact_summary: string | null;
};

export type SignalContext = {
  signal_id: string;
  project_id: string;
  ym: string;
  scope_key: string;
  current: ProposedSignal;
  past_feedbacks: Array<{ feedback_id: string; feedback_text: string; created_at: string; applied_count: number }>;
};

const SIGNAL_TYPE_VALUES = [
  "management_decision",
  "business_progress",
  "strategic_pivot",
  "commercial_progress",
  "partnership",
  "funding",
  "ip_regulatory",
  "tech_progress",
  "risk",
  "next_move",
] as const;
const IMPACT_LEVEL_VALUES = ["low", "medium", "high", "critical"] as const;
const POLARITY_VALUES = ["breakthrough", "forward", "pivot", "risk"] as const;

/**
 * scope_key から ym + hash prefix を抽出して該当 signal を逆引き。
 * 旧 reextractStrategySignalImmediate と同じパース仕様。
 */
export async function fetchSignalContext(args: {
  targetId: string;  // project_id
  scopeKey: string;
}): Promise<{ ok: true; context: SignalContext } | { ok: false; message: string }> {
  const supabase = createAdminClient();
  const m = args.scopeKey.match(/^(20\d{4}):strategy:([0-9a-fA-F]+)/);
  if (!m) return { ok: false, message: `scope_key format unexpected: ${args.scopeKey}` };
  const ym = m[1];
  const hashPrefix = m[2];

  // select("*") にしておく (= migration 090 で polarity / score_impact_summary 列が追加される前後で
  //  helper を壊さないため。supabase-data.ts も同じ理由で select("*"))
  const { data: signals, error: sigErr } = await supabase
    .from("project_strategy_signals")
    .select("*")
    .eq("project_id", args.targetId)
    .eq("ym", ym)
    .order("signal_date", { ascending: false })
    .limit(50);
  if (sigErr) return { ok: false, message: `signal fetch error: ${sigErr.message}` };
  const target = (signals ?? []).find(
    (s) => (s.source_hash || "").startsWith(hashPrefix) || (s.signal_id || "").startsWith(hashPrefix)
  ) as Record<string, unknown> | undefined;
  if (!target) return { ok: false, message: `signal not found for scope_key ${args.scopeKey}` };

  const { data: pastFeedbacks } = await supabase
    .from("l2_feedbacks")
    .select("feedback_id, feedback_text, created_at, applied_count")
    .eq("l2_kind", "project_strategy_signal")
    .eq("target_id", args.targetId)
    .eq("scope_key", args.scopeKey)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  return {
    ok: true,
    context: {
      signal_id: String(target.signal_id),
      project_id: String(target.project_id),
      ym: String(target.ym),
      scope_key: args.scopeKey,
      current: {
        title: String(target.title || ""),
        summary: String(target.summary || ""),
        impact_level: String(target.impact_level || "medium"),
        signal_type: String(target.signal_type || ""),
        // migration 090 適用前は列が無く undefined → null として扱う
        polarity: (target.polarity ?? null) as string | null,
        score_impact_summary: (target.score_impact_summary ?? null) as string | null,
      },
      past_feedbacks: (pastFeedbacks ?? []).map((f) => ({
        feedback_id: String(f.feedback_id),
        feedback_text: String(f.feedback_text || ""),
        created_at: String(f.created_at || ""),
        applied_count: Number(f.applied_count ?? 0),
      })),
    },
  };
}

/**
 * Anthropic Sonnet で改訂案を生成。
 * conversation = これまでの user / assistant 発言全部 (= refine では追加される)。
 * 最後の user 発言が「今回の修正依頼 or 追加コメント or やり直し hint」。
 */
export async function generateProposal(args: {
  context: SignalContext;
  conversation: DialogMessage[];
}): Promise<
  | { ok: true; proposed: ProposedSignal; reasoning: string; applied_feedback_summary: string }
  | { ok: false; message: string }
> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, message: "ANTHROPIC_API_KEY missing in env" };
  if (!args.conversation.length) return { ok: false, message: "conversation empty" };

  const client = new Anthropic({ apiKey });
  const systemPrompt = `あなたは AMD OS の経営ハイライト (= L2 ⑨ project_strategy_signal) を、まさからの修正依頼に基づいて **対話的に** 改訂するつくよみ (LLM)。

入力:
- 現在の signal (= title / summary / impact_level / signal_type / polarity / score_impact_summary)
- 過去に投げられた修正依頼 (= 時系列、まさが過去に伝えた意図)
- このセッションでの会話履歴 (= user 発言と過去の proposal を含む)
- 最新の user 発言 (= 今回反映してほしい修正依頼 or 追加 hint or 「やり直し」)

ルール:
- まさの修正依頼の意図 (= 内容の誤り / 分類の誤り / 重要度の誤り / 用語の誤り) を必ず反映
- 推測で書かない、修正依頼に書かれた事実だけを反映
- title は 1 行 (= 30-50 文字目安)、summary は 80-200 文字
- signal_type: ${SIGNAL_TYPE_VALUES.join(" / ")}
- impact_level: ${IMPACT_LEVEL_VALUES.join(" / ")}
- polarity (= null OK): ${POLARITY_VALUES.join(" / ")}
- score_impact_summary は「📊 影響: TRL 4→5、X 軸 +40pt」のような 1 行 (null OK)
- reasoning は「まさの修正依頼を受けて、〜〜のように改訂しました。これでいいですか?」の対話的トーン (= 1-2 文)
- applied_feedback_summary は「反映した修正依頼の 1 文要約」
- **JSON 以外の文字一切出力禁止** (= markdown コードブロック含め)

出力 JSON:
{
  "proposed": {
    "title": "...",
    "summary": "...",
    "impact_level": "...",
    "signal_type": "...",
    "polarity": "..." or null,
    "score_impact_summary": "..." or null
  },
  "reasoning": "...",
  "applied_feedback_summary": "..."
}`;

  const fbLines = args.context.past_feedbacks.length
    ? args.context.past_feedbacks
        .map((f, i) => `${i + 1}. (${f.created_at.slice(0, 10)}, applied=${f.applied_count}) ${f.feedback_text}`)
        .join("\n")
    : "(なし)";

  const convLines = args.conversation
    .map((m) => {
      if (m.role === "user") return `[user] ${m.content}`;
      return `[つくよみ提案] title=${m.proposed.title} / summary=${m.proposed.summary} / reasoning=${m.reasoning}`;
    })
    .join("\n\n");

  const userPrompt = `=== 既存 signal ===
title: ${args.context.current.title}
summary: ${args.context.current.summary}
signal_type: ${args.context.current.signal_type}
impact_level: ${args.context.current.impact_level}
polarity: ${args.context.current.polarity ?? "(未設定)"}
score_impact_summary: ${args.context.current.score_impact_summary ?? "(未設定)"}

=== 過去の修正依頼 (= 時系列、DB 永続化済み) ===
${fbLines}

=== このセッションの会話履歴 ===
${convLines}

最新の user 発言を踏まえて、修正依頼を反映した新しい signal の改訂案 (proposed) と reasoning と applied_feedback_summary を JSON で返してください。`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: false, message: `LLM output not JSON: ${text.slice(0, 200)}` };
    const parsed = JSON.parse(jsonMatch[0]) as {
      proposed?: Partial<ProposedSignal>;
      reasoning?: string;
      applied_feedback_summary?: string;
    };
    const p = parsed.proposed || {};
    if (!p.title || !p.summary) return { ok: false, message: "LLM output missing title/summary" };
    return {
      ok: true,
      proposed: {
        title: String(p.title),
        summary: String(p.summary),
        impact_level: IMPACT_LEVEL_VALUES.includes(p.impact_level as (typeof IMPACT_LEVEL_VALUES)[number])
          ? String(p.impact_level)
          : args.context.current.impact_level,
        signal_type: SIGNAL_TYPE_VALUES.includes(p.signal_type as (typeof SIGNAL_TYPE_VALUES)[number])
          ? String(p.signal_type)
          : args.context.current.signal_type,
        polarity:
          p.polarity == null
            ? null
            : POLARITY_VALUES.includes(p.polarity as (typeof POLARITY_VALUES)[number])
              ? String(p.polarity)
              : args.context.current.polarity,
        score_impact_summary: p.score_impact_summary == null ? null : String(p.score_impact_summary),
      },
      reasoning: String(parsed.reasoning || "").trim(),
      applied_feedback_summary: String(parsed.applied_feedback_summary || "").trim(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return { ok: false, message: `LLM call error: ${msg}` };
  }
}

/**
 * まさ承認時の確定処理:
 * 1) signal を proposed で update
 * 2) l2_feedbacks に INSERT (= feedback_text には conversation 全体を markdown で残す)
 * 3) 同 scope_key の active 過去 feedbacks の applied_count++ + last_applied_at = now
 */
export async function applyProposal(args: {
  context: SignalContext;
  conversation: DialogMessage[];
  proposed: ProposedSignal;
  appliedFeedbackSummary: string;
  createdBy: string;
}): Promise<{ ok: true; signal_id: string; feedback_id: string } | { ok: false; message: string }> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    title: args.proposed.title,
    summary: args.proposed.summary,
    impact_level: args.proposed.impact_level,
    signal_type: args.proposed.signal_type,
    updated_at: nowIso,
  };
  // polarity / score_impact_summary は migration 090 適用後に DB に存在。
  // 適用前は payload に含めると PostgreSQL が「no such column」で reject するので、
  // 1 度試して失敗したら fallback で core fields だけで再 update する。
  if (args.proposed.polarity !== undefined) updatePayload.polarity = args.proposed.polarity;
  if (args.proposed.score_impact_summary !== undefined) updatePayload.score_impact_summary = args.proposed.score_impact_summary;
  let { error: updErr } = await supabase
    .from("project_strategy_signals")
    .update(updatePayload)
    .eq("signal_id", args.context.signal_id);
  if (updErr && /polarity|score_impact_summary/.test(updErr.message)) {
    // migration 090 未適用環境: 拡張列を payload から外して再試行
    delete updatePayload.polarity;
    delete updatePayload.score_impact_summary;
    const retry = await supabase
      .from("project_strategy_signals")
      .update(updatePayload)
      .eq("signal_id", args.context.signal_id);
    updErr = retry.error;
  }
  if (updErr) return { ok: false, message: `signal update error: ${updErr.message}` };

  // Next.js server component の signals cache を invalidate (= confirm 後の表示即時反映)
  // CockpitView は SSR で `getProjectCockpitData` 経由 signals fetch、router.refresh() だけだと
  // 一部 cache が残るため revalidatePath で確実に再 fetch させる (= 2026-05-25 #71 対話型 UI fix)
  try {
    revalidatePath(`/project/${args.context.project_id}/cockpit`, "page");
    revalidatePath(`/hud/project/${args.context.project_id}/cockpit`, "page");
  } catch (_e) {
    // revalidatePath は server context 必須、API route 内では基本通る。失敗時は silent
  }

  // conversation を markdown で 1 文字列化 (= feedback_text に永続化)
  const convoMd = args.conversation
    .map((m) => {
      if (m.role === "user") return `**[まさ]**\n${m.content}`;
      return `**[つくよみ提案]**\n- title: ${m.proposed.title}\n- summary: ${m.proposed.summary}\n- impact: ${m.proposed.impact_level} / type: ${m.proposed.signal_type} / polarity: ${m.proposed.polarity ?? "-"}\n- reasoning: ${m.reasoning}`;
    })
    .join("\n\n");
  const feedbackText = [
    `# 対話型修正依頼 (= 確定)`,
    `applied_feedback_summary: ${args.appliedFeedbackSummary || "-"}`,
    ``,
    `## 確定 proposed`,
    `- title: ${args.proposed.title}`,
    `- summary: ${args.proposed.summary}`,
    `- impact: ${args.proposed.impact_level} / type: ${args.proposed.signal_type} / polarity: ${args.proposed.polarity ?? "-"}`,
    `- score_impact_summary: ${args.proposed.score_impact_summary ?? "-"}`,
    ``,
    `## 対話履歴`,
    convoMd,
  ].join("\n");

  const { data: inserted, error: insErr } = await supabase
    .from("l2_feedbacks")
    .insert({
      l2_kind: "project_strategy_signal",
      target_id: args.context.project_id,
      scope_key: args.context.scope_key,
      feedback_text: feedbackText,
      status: "active",
      created_by: args.createdBy,
      applied_count: 1,
      last_applied_at: nowIso,
    })
    .select("feedback_id")
    .single();
  if (insErr || !inserted) return { ok: false, message: `feedback insert error: ${insErr?.message ?? "no row"}` };

  // 過去 feedbacks の applied_count++ + last_applied_at
  if (args.context.past_feedbacks.length) {
    await Promise.all(
      args.context.past_feedbacks.map((f) =>
        supabase
          .from("l2_feedbacks")
          .update({ applied_count: f.applied_count + 1, last_applied_at: nowIso })
          .eq("feedback_id", f.feedback_id)
      )
    );
  }

  return { ok: true, signal_id: args.context.signal_id, feedback_id: inserted.feedback_id };
}

/** admin 認証チェック (= 各 dialog route で共通) */
export async function requireAdmin(): Promise<
  { ok: true; email: string; code_name: string } | { ok: false; status: number; message: string }
> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, message: "unauthorized" };
  const email = user.email?.toLowerCase() ?? "";
  if (!email) return { ok: false, status: 401, message: "unauthorized" };
  const { data: member } = await supabase
    .from("members")
    .select("code_name, is_admin")
    .eq("email", email)
    .maybeSingle();
  if (!member?.is_admin) return { ok: false, status: 403, message: "forbidden" };
  return { ok: true, email, code_name: String(member.code_name || "") };
}
