/**
 * つくよみマスコットチャット 1 ターン (Claude Sonnet)。
 *
 * POST { session_id, page_path, project_id?, messages: [{role, content}] }
 *   → { reply: string, applied?: [{kind, detail}] }
 *
 * 動作:
 *   - project_id があれば: project_ventures + xrl + events + members + partners + 既存 PL を context に含める
 *   - Sonnet が必要に応じて tool を呼ぶ:
 *       * update_short_long_description: short_description / long_description を更新
 *       * invalidate_narrative: narrative_invalidated_at を立てる (= 沿革を次の cron で再生成)
 *       * record_xrl_feedback: TRL/BRL/HRL の修正依頼を xrl_feedbacks に記録 (cron / 個別 API で再評価)
 *   - 全会話 + applied actions は tsukuyomi_chat_logs に保存
 *   - 修正系の発話があれば admin/tsukuyomi の「修正依頼履歴」相当として narrative_feedbacks にも複製保存
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateAmdScore, classifyPhase, normalizeAlpha, ALPHA_DEFAULT, AXIS_LABEL_JP, PHASE_LABEL_JP, type AlphaWeights } from "@/lib/amd-score";
import { getLevelInfo, type XrlAxisKey } from "@/lib/xrl-level-definitions";

export const runtime = "nodejs";
export const maxDuration = 60;

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface ApplyAction {
  kind: string;
  detail: string;
}

const SYSTEM = `あなたは「つくよみ」、AMD (株式会社チームアルマダ) のディープテックスタジオの専属マスコット LLM。
20 代女子っぽく、明るくキレのある書き手。書くときの声はドライでまっすぐ。

# 役割
ユーザーは AMD CEO のまさ。画面に表示されている PJ コックピットの情報をすべて把握した状態で会話する。
- 「○○ について教えて」 → 持っている情報から答える
- 「○○ を直して」「これ追加しといて」「この情報を入れて」 → 該当する tool を呼んで反映する
- 生データ (論文/メール/メモ/ニュース/会議メモ) を貼られたら、L2 情報を抽出して該当 tool で適切なセクションに追記する
- 不確かな場合は推測せず、わからないと正直に答える

# AMD Score (Before Zero Theory v3.2 — 7 軸 Cobb-Douglas) — 画面上のスコアグラフはこれ
PJ コックピット上部 + /venture-map/amd-score の経時グラフは AMD Score。
\`\`\`
Score = K · Π (X+1)^α    X = {σ_SU, TRL, BRL, GRL, SRL, HRL, FRL}
σ_SU  = ((μ_A+1)(μ_I+1)(μ_G+1))^(1/3) - 1
K     = 100,000 / 10^Σα   (全軸 9 で IPO 級 100,000 に校正)
\`\`\`
- 7 軸入力は \`amd_score_inputs\` テーブル (project_id, evaluated_at) に保存
- 弾性 α は \`amd_score_alpha\` で版管理 (base case: σ_SU=1.3 / TRL=1.0 / BRL=0.6 / GRL=0.3 / SRL=0.2 / HRL=1.1 / FRL=1.5)
- フェーズ閾値: <30 シーズ察知 / <300 顕在化 / <1500 立ち上げ準備 / <3500 設立準備 / <15000 設立 GO / <50000 スケール / <100000 卒業
- FRL は Walumbwa 2008 ALQ 4 次元 (自己認識/関係透明性/均衡的処理/道徳観) の平均で自動算出可

# 利用可能な tool

## 概要・沿革
- update_short_long_description(short?, long?): 事業概要 (short=1 行 / long=詳細) を書き直す
- invalidate_narrative(): 沿革を再生成すべきとマーク (次の 03:45 cron で再生成)

## XRL / AMD Score
- record_xrl_feedback(axis?, feedback): TRL/BRL/GRL/SRL/HRL の修正依頼を記録 (cron / 個別 API で再評価)
- add_xrl_observation(observed_at, trl?/brl?/grl?/srl?/hrl?, milestone_label?, source_note?): 新しい XRL 観測を project_xrl_log に追加
- update_amd_score_input(evaluated_at?, mu_A?/mu_I?/mu_G?/trl?/brl?/grl?/srl?/hrl?/frl?/alq_*?/frl_notes?, shallow_tech_mode?, notes?): AMD Score の 7 軸入力を upsert
- update_amd_score_alpha(alpha, notes?): 重み α を新版で保存 (前版を closeする)

## 沿革を駆動するイベント
- add_project_event(occurred_on, kind, label, meta?): project_events に追記。kind ∈ {hire, funding, deal, tech_progress, governance, note}。沿革生成 + AMD Score グラフのアノテーションになる

## メンバー / 事業会社 / 試算表
- add_project_member(full_name, role, member_kind, started_at?, ended_at?, note?): project_venture_members 追加。member_kind ∈ {amd_internal, su_internal, support_org}
- add_project_partner(partner_name, partner_type, partner_role?, sales_target_date?, notes?): project_partners 追加。partner_type ∈ {collab, customer}
- add_pl_monthly(ym, revenue_yen?, cogs_yen?, personnel_yen?, rd_yen?, marketing_yen?, other_opex_yen?, notes?): project_pl_monthly に upsert

## ネット検索
- web_search: ネットで検索して事実情報を取る (推測ではなく実データを得たいとき)

# 単位ルール
- SU を「社」「ventures」と書かない、「PJ」と書く

# 修正系の発話への対応
- まさが「直して」「書き直して」「追加して」「これ反映して」と言ったら必ず該当 tool を呼ぶ。確認質問で時間を使わない
- 修正したら、何をどう直したか 1-2 行で報告する
- 「ネットで調べて」と言われたら必ず web_search を使う。推測・捏造は禁止
- L2 情報 (論文/メール抜粋/会議メモなど) を貼られたら、該当する内容を分類して適切な tool を複数並行で呼ぶ:
  例: 「YYYY-MM-DD に Co-Founder の山田さんが正式参画 + 試作機が SIP 採択審査をパス」
       → add_project_member(...) + add_project_event(kind="hire", ...) + add_project_event(kind="governance", ...) + record_xrl_feedback(axis="GRL", ...)`;

interface ProjectContext {
  display_name: string;
  lane: string;
  founded_at: string | null;
  outcome_pattern: string;
  short_description: string | null;
  long_description: string | null;
  origin_org: string | null;
  origin_pi: string | null;
  amd_role: string | null;
  amd_support_started_at: string | null;
  amd_support_ended_at: string | null;
  events: unknown[];
  members: unknown[];
  partners: unknown[];
  xrl: unknown[];
  xrl_next_levels: Record<string, unknown> | null;
  pl_monthly: unknown[];
  narrative_text: string | null;
  amd_score: {
    latest_input: unknown | null;
    latest_score: number | null;
    phase_label: string | null;
    bottleneck_axis: string | null;
    alpha: AlphaWeights;
  };
}

async function loadProjectContext(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string
): Promise<ProjectContext | null> {
  const [
    { data: v },
    { data: events },
    { data: members },
    { data: partners },
    { data: xrl },
    { data: pl },
    { data: amdInputs },
    { data: alphaRow },
  ] = await Promise.all([
    supabase
      .from("project_ventures")
      .select("display_name, lane, founded_at, outcome_pattern, short_description, long_description, origin_org, origin_pi, amd_role, amd_support_started_at, amd_support_ended_at, narrative_text")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase.from("project_events").select("occurred_on, kind, label, meta").eq("project_id", projectId).order("occurred_on", { ascending: true }),
    supabase.from("project_venture_members").select("full_name, role, member_kind, started_at, ended_at, note").eq("project_id", projectId),
    supabase.from("project_partners").select("partner_name, partner_type, partner_role, sales_target_date, is_sold").eq("project_id", projectId),
    supabase.from("project_xrl_log").select("observed_at, trl, brl, grl, srl, hrl, bottleneck, milestone_label, source_note, source").eq("project_id", projectId).order("observed_at", { ascending: true }),
    supabase.from("project_pl_monthly").select("ym, revenue_yen, cogs_yen, personnel_yen, rd_yen, marketing_yen, other_opex_yen, notes").eq("project_id", projectId).order("ym", { ascending: true }),
    supabase.from("amd_score_inputs")
      .select("id, evaluated_at, mu_a, mu_i, mu_g, trl, brl, grl, srl, hrl, frl, alq_self_awareness, alq_relational_transparency, alq_balanced_processing, alq_internalized_moral, frl_notes, shallow_tech_mode, evaluator, notes")
      .eq("project_id", projectId).order("evaluated_at", { ascending: true }),
    supabase.from("amd_score_alpha").select("alpha").is("effective_to", null).order("effective_from", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!v) return null;

  // 最新 XRL 観測 → 各軸の次レベル進捗
  const latestXrl = (xrl ?? []).filter((r) => r.source !== "llm_proposal").pop() ?? (xrl ?? []).pop();
  const xrlNextLevels: Record<string, unknown> | null = latestXrl
    ? Object.fromEntries(
        (["trl", "brl", "grl", "srl", "hrl"] as XrlAxisKey[]).map((axis) => {
          const value = (latestXrl as unknown as Record<string, number | null>)[axis] ?? null;
          const info = getLevelInfo(axis, value);
          return [
            axis,
            {
              current_value: value,
              current_level_label: info.current?.label ?? null,
              next_level_label: info.next?.label ?? null,
              progress_pct: info.progressPct,
              exit_criteria: info.current?.exit_criteria ?? null,
            },
          ];
        }),
      )
    : null;

  // AMD Score 計算 (最新 input × active alpha)
  const alpha = normalizeAlpha((alphaRow as { alpha?: unknown } | null)?.alpha);
  const latestInput = (amdInputs ?? []).at(-1) ?? null;
  let latestScore: number | null = null;
  let phaseLabel: string | null = null;
  let bottleneckAxis: string | null = null;
  if (latestInput) {
    const li = latestInput as Record<string, number | boolean | null>;
    const result = calculateAmdScore({
      mu_A: (li.mu_a as number | null) ?? 0,
      mu_I: (li.mu_i as number | null) ?? 0,
      mu_G: (li.mu_g as number | null) ?? 0,
      TRL: (li.shallow_tech_mode as boolean) ? null : (li.trl as number | null) ?? 0,
      BRL: (li.brl as number | null) ?? 0,
      GRL: (li.grl as number | null) ?? 0,
      SRL: (li.srl as number | null) ?? 0,
      HRL: (li.hrl as number | null) ?? 0,
      FRL: (li.frl as number | null) ?? 0,
    }, alpha);
    latestScore = result.score;
    phaseLabel = PHASE_LABEL_JP[classifyPhase(result.score)];
    bottleneckAxis = AXIS_LABEL_JP[result.bottleneck];
  }

  return {
    display_name: v.display_name as string,
    lane: v.lane as string,
    founded_at: (v.founded_at as string | null) ?? null,
    outcome_pattern: v.outcome_pattern as string,
    short_description: (v.short_description as string | null) ?? null,
    long_description: (v.long_description as string | null) ?? null,
    origin_org: (v.origin_org as string | null) ?? null,
    origin_pi: (v.origin_pi as string | null) ?? null,
    amd_role: (v.amd_role as string | null) ?? null,
    amd_support_started_at: (v.amd_support_started_at as string | null) ?? null,
    amd_support_ended_at: (v.amd_support_ended_at as string | null) ?? null,
    events: events ?? [],
    members: members ?? [],
    partners: partners ?? [],
    xrl: xrl ?? [],
    xrl_next_levels: xrlNextLevels,
    pl_monthly: pl ?? [],
    narrative_text: (v.narrative_text as string | null) ?? null,
    amd_score: {
      latest_input: latestInput,
      latest_score: latestScore,
      phase_label: phaseLabel,
      bottleneck_axis: bottleneckAxis,
      alpha,
    },
  };
}

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "update_short_long_description",
    description: "PJ の事業概要 (short_description = 1 行サマリ / long_description = 詳細) を更新する。どちらか片方だけでも OK。",
    input_schema: {
      type: "object",
      properties: {
        short: { type: "string", description: "更新後の short_description (省略可)" },
        long: { type: "string", description: "更新後の long_description (省略可)" },
        reason: { type: "string", description: "なぜこう直したか、まさへの 1 行報告" },
      },
      required: ["reason"],
    },
  },
  {
    name: "invalidate_narrative",
    description: "沿革を「再生成すべき」とマークする (次の 03:45 cron で再生成)。情報が古いと感じたら呼ぶ。",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "なぜ再生成が必要か" },
      },
      required: ["reason"],
    },
  },
  {
    name: "record_xrl_feedback",
    description: "TRL/BRL/GRL/SRL/HRL の修正依頼を xrl_feedbacks に記録する。次の 03:15 cron で反映される。",
    input_schema: {
      type: "object",
      properties: {
        axis: { type: "string", enum: ["TRL", "BRL", "GRL", "SRL", "HRL"], description: "対象軸 (省略可)" },
        feedback: { type: "string", description: "修正内容" },
      },
      required: ["feedback"],
    },
  },
  {
    name: "add_xrl_observation",
    description: "新しい XRL 観測を project_xrl_log に追加する。L2 情報抽出から XRL 進捗が確認できたとき呼ぶ。",
    input_schema: {
      type: "object",
      properties: {
        observed_at: { type: "string", description: "観測日 YYYY-MM-DD" },
        trl: { type: "number", description: "TRL 0-9 (省略可)" },
        brl: { type: "number", description: "BRL 0-9 (省略可)" },
        grl: { type: "number", description: "GRL 0-9 (省略可)" },
        srl: { type: "number", description: "SRL 0-9 (省略可)" },
        hrl: { type: "number", description: "HRL 0-9 (省略可)" },
        bottleneck: { type: "string", enum: ["TRL", "BRL", "GRL", "SRL", "HRL"], description: "ボトルネック軸 (省略可)" },
        milestone_label: { type: "string", description: "この時点のマイルストーン名 (例: SIP 採択 / PoC 完了)" },
        source_note: { type: "string", description: "評価理由 (なぜこのレベルなのか)" },
      },
      required: ["observed_at"],
    },
  },
  {
    name: "update_amd_score_input",
    description:
      "AMD Score の 7 軸入力 (μ_A/I/G + 5 XRL + FRL/ALQ + frl_notes) を amd_score_inputs に upsert する。" +
      "evaluated_at を省略すると今日。既存行があれば部分上書き、なければ 0 で初期化して指定値を入れる。",
    input_schema: {
      type: "object",
      properties: {
        evaluated_at: { type: "string", description: "評価日 YYYY-MM-DD (省略時は今日)" },
        mu_A: { type: "number", description: "学術 μ_A 0-9" },
        mu_I: { type: "number", description: "産業 μ_I 0-9" },
        mu_G: { type: "number", description: "政府 μ_G 0-9" },
        trl: { type: "number", description: "TRL 0-9 (Shallow Tech モード時は null)" },
        brl: { type: "number", description: "BRL 0-9" },
        grl: { type: "number", description: "GRL 0-9" },
        srl: { type: "number", description: "SRL 0-9" },
        hrl: { type: "number", description: "HRL 0-9" },
        frl: { type: "number", description: "FRL 0-9 (ALQ 平均で自動算出可)" },
        alq_self_awareness: { type: "number", description: "ALQ 自己認識 0-9" },
        alq_relational_transparency: { type: "number", description: "ALQ 関係透明性 0-9" },
        alq_balanced_processing: { type: "number", description: "ALQ 均衡的処理 0-9" },
        alq_internalized_moral: { type: "number", description: "ALQ 内在化された道徳観 0-9" },
        frl_notes: { type: "string", description: "FRL 自由備考" },
        shallow_tech_mode: { type: "boolean", description: "Shallow Tech モード (TRL 軸を計算から除外)" },
        notes: { type: "string", description: "全体に対する備考" },
        reason: { type: "string", description: "なぜこう更新したか、まさへの 1 行報告" },
      },
      required: ["reason"],
    },
  },
  {
    name: "update_amd_score_alpha",
    description: "重み α を新版で保存。前版を effective_to=now で閉じる。Σα = 6.0 から外れると K が再校正される。",
    input_schema: {
      type: "object",
      properties: {
        alpha: {
          type: "object",
          description: "新しい α (各軸 0-2.0 程度)",
          properties: {
            sigma_SU: { type: "number" },
            TRL: { type: "number" },
            BRL: { type: "number" },
            GRL: { type: "number" },
            SRL: { type: "number" },
            HRL: { type: "number" },
            FRL: { type: "number" },
          },
          required: ["sigma_SU", "TRL", "BRL", "GRL", "SRL", "HRL", "FRL"],
        },
        notes: { type: "string", description: "なぜこう変えたか" },
      },
      required: ["alpha"],
    },
  },
  {
    name: "add_project_event",
    description: "PJ ごとのイベントを project_events に追加 (沿革と AMD スコアグラフのアノテーションになる)",
    input_schema: {
      type: "object",
      properties: {
        occurred_on: { type: "string", description: "発生日 YYYY-MM-DD" },
        kind: {
          type: "string",
          enum: ["hire", "funding", "deal", "tech_progress", "governance", "note"],
          description: "イベント種別",
        },
        label: { type: "string", description: "ラベル (1 行サマリ)" },
        meta: { type: "object", description: "追加メタデータ (任意)" },
      },
      required: ["occurred_on", "kind", "label"],
    },
  },
  {
    name: "add_project_member",
    description: "PJ メンバーを project_venture_members に追加。L2 情報から人が増えたと判明したとき呼ぶ。",
    input_schema: {
      type: "object",
      properties: {
        full_name: { type: "string", description: "フルネーム" },
        role: { type: "string", description: "役割 (例: CTO / 研究員 / 業務委託)" },
        member_kind: {
          type: "string",
          enum: ["amd_internal", "su_internal", "support_org"],
          description: "amd_internal=AMD 社員 / su_internal=SU 社員 / support_org=支援組織",
        },
        started_at: { type: "string", description: "参画日 YYYY-MM-DD" },
        ended_at: { type: "string", description: "離脱日 YYYY-MM-DD (省略可)" },
        note: { type: "string", description: "備考" },
      },
      required: ["full_name", "role", "member_kind"],
    },
  },
  {
    name: "add_project_partner",
    description: "事業会社 (協業先 / 顧客候補) を project_partners に追加",
    input_schema: {
      type: "object",
      properties: {
        partner_name: { type: "string" },
        partner_type: { type: "string", enum: ["collab", "customer"], description: "collab=協業 / customer=顧客候補" },
        partner_role: { type: "string", description: "collab 用: 何を担うか" },
        sales_target_date: { type: "string", description: "customer 用: 受注目標日 YYYY-MM-DD" },
        notes: { type: "string", description: "備考" },
      },
      required: ["partner_name", "partner_type"],
    },
  },
  {
    name: "add_pl_monthly",
    description: "月次試算表を project_pl_monthly に upsert。同じ ym があれば上書き。L2 情報から数字を抽出したとき呼ぶ。金額は円単位 (整数)",
    input_schema: {
      type: "object",
      properties: {
        ym: { type: "string", description: "対象月 YYYYMM (例: '202604')" },
        revenue_yen: { type: "number" },
        cogs_yen: { type: "number" },
        personnel_yen: { type: "number" },
        rd_yen: { type: "number" },
        marketing_yen: { type: "number" },
        other_opex_yen: { type: "number" },
        notes: { type: "string" },
      },
      required: ["ym"],
    },
  },
  // 公式 web_search tool (推論時にネット検索)。SDK の型に未対応なので as unknown
  { type: "web_search_20250305", name: "web_search", max_uses: 5 } as unknown as Anthropic.Messages.Tool,
];

async function executeTool(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string | null,
  name: string,
  input: Record<string, unknown>
): Promise<{ ok: boolean; summary: string }> {
  if (!projectId) return { ok: false, summary: "PJ コックピット外なので適用できない" };

  if (name === "update_short_long_description") {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof input.short === "string") update.short_description = input.short;
    if (typeof input.long === "string") update.long_description = input.long;
    update.narrative_invalidated_at = new Date().toISOString();
    const { error } = await supabase.from("project_ventures").update(update).eq("project_id", projectId);
    if (error) return { ok: false, summary: `update 失敗: ${error.message}` };
    return { ok: true, summary: typeof input.reason === "string" ? input.reason : "概要を更新" };
  }

  if (name === "invalidate_narrative") {
    const { error } = await supabase
      .from("project_ventures")
      .update({ narrative_invalidated_at: new Date().toISOString() })
      .eq("project_id", projectId);
    if (error) return { ok: false, summary: `invalidate 失敗: ${error.message}` };
    return { ok: true, summary: typeof input.reason === "string" ? input.reason : "沿革を invalidate" };
  }

  if (name === "record_xrl_feedback") {
    const fb = typeof input.feedback === "string" ? input.feedback : "";
    const axis = typeof input.axis === "string" ? input.axis : null;
    if (!fb) return { ok: false, summary: "feedback 文がない" };
    const { error } = await supabase.from("xrl_feedbacks").insert({
      project_id: projectId,
      xrl_log_id: null,
      axis,
      feedback: fb,
    });
    if (error) return { ok: false, summary: `xrl_feedback 失敗: ${error.message}` };
    await supabase
      .from("project_ventures")
      .update({ narrative_invalidated_at: new Date().toISOString() })
      .eq("project_id", projectId);
    return { ok: true, summary: `XRL 修正依頼を記録 (${axis ?? "all"})` };
  }

  if (name === "add_xrl_observation") {
    const observed_at = typeof input.observed_at === "string" ? input.observed_at : null;
    if (!observed_at) return { ok: false, summary: "observed_at が無い" };
    const payload: Record<string, unknown> = {
      project_id: projectId,
      observed_at,
      trl: typeof input.trl === "number" ? input.trl : null,
      brl: typeof input.brl === "number" ? input.brl : null,
      grl: typeof input.grl === "number" ? input.grl : null,
      srl: typeof input.srl === "number" ? input.srl : null,
      hrl: typeof input.hrl === "number" ? input.hrl : null,
      bottleneck: typeof input.bottleneck === "string" ? input.bottleneck : null,
      milestone_label: typeof input.milestone_label === "string" ? input.milestone_label : null,
      source_note: typeof input.source_note === "string" ? input.source_note : null,
      source: "tsukuyomi_chat",
    };
    const { error } = await supabase.from("project_xrl_log").insert(payload);
    if (error) return { ok: false, summary: `xrl_log 追加失敗: ${error.message}` };
    await supabase.from("project_ventures").update({ narrative_invalidated_at: new Date().toISOString() }).eq("project_id", projectId);
    return { ok: true, summary: `XRL 観測を追加 (${observed_at})` };
  }

  if (name === "update_amd_score_input") {
    const today = new Date().toISOString().slice(0, 10);
    const evaluated_at_iso = (typeof input.evaluated_at === "string" ? input.evaluated_at : today) + "T00:00:00.000Z";
    // 既存 row 取得 (部分上書き)
    const { data: existing } = await supabase
      .from("amd_score_inputs")
      .select("id, mu_a, mu_i, mu_g, trl, brl, grl, srl, hrl, frl, alq_self_awareness, alq_relational_transparency, alq_balanced_processing, alq_internalized_moral, frl_notes, shallow_tech_mode, notes")
      .eq("project_id", projectId)
      .eq("evaluated_at", evaluated_at_iso)
      .maybeSingle();
    const merged: Record<string, unknown> = {
      project_id: projectId,
      evaluated_at: evaluated_at_iso,
      mu_a: typeof input.mu_A === "number" ? input.mu_A : (existing as Record<string, unknown> | null)?.mu_a ?? null,
      mu_i: typeof input.mu_I === "number" ? input.mu_I : (existing as Record<string, unknown> | null)?.mu_i ?? null,
      mu_g: typeof input.mu_G === "number" ? input.mu_G : (existing as Record<string, unknown> | null)?.mu_g ?? null,
      trl: typeof input.trl === "number" ? input.trl : (existing as Record<string, unknown> | null)?.trl ?? null,
      brl: typeof input.brl === "number" ? input.brl : (existing as Record<string, unknown> | null)?.brl ?? null,
      grl: typeof input.grl === "number" ? input.grl : (existing as Record<string, unknown> | null)?.grl ?? null,
      srl: typeof input.srl === "number" ? input.srl : (existing as Record<string, unknown> | null)?.srl ?? null,
      hrl: typeof input.hrl === "number" ? input.hrl : (existing as Record<string, unknown> | null)?.hrl ?? null,
      frl: typeof input.frl === "number" ? input.frl : (existing as Record<string, unknown> | null)?.frl ?? null,
      alq_self_awareness: typeof input.alq_self_awareness === "number" ? input.alq_self_awareness : (existing as Record<string, unknown> | null)?.alq_self_awareness ?? null,
      alq_relational_transparency: typeof input.alq_relational_transparency === "number" ? input.alq_relational_transparency : (existing as Record<string, unknown> | null)?.alq_relational_transparency ?? null,
      alq_balanced_processing: typeof input.alq_balanced_processing === "number" ? input.alq_balanced_processing : (existing as Record<string, unknown> | null)?.alq_balanced_processing ?? null,
      alq_internalized_moral: typeof input.alq_internalized_moral === "number" ? input.alq_internalized_moral : (existing as Record<string, unknown> | null)?.alq_internalized_moral ?? null,
      frl_notes: typeof input.frl_notes === "string" ? input.frl_notes : (existing as Record<string, unknown> | null)?.frl_notes ?? null,
      shallow_tech_mode: typeof input.shallow_tech_mode === "boolean" ? input.shallow_tech_mode : (existing as Record<string, unknown> | null)?.shallow_tech_mode ?? false,
      notes: typeof input.notes === "string" ? input.notes : (existing as Record<string, unknown> | null)?.notes ?? null,
      evaluator: "tsukuyomi",
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("amd_score_inputs").upsert(merged, { onConflict: "project_id,evaluated_at" });
    if (error) return { ok: false, summary: `amd_score_input upsert 失敗: ${error.message}` };
    return { ok: true, summary: typeof input.reason === "string" ? input.reason : `AMD Score 入力を更新 (${evaluated_at_iso.slice(0, 10)})` };
  }

  if (name === "update_amd_score_alpha") {
    const a = (input.alpha ?? {}) as Record<string, unknown>;
    const required = ["sigma_SU", "TRL", "BRL", "GRL", "SRL", "HRL", "FRL"];
    for (const k of required) if (typeof a[k] !== "number") return { ok: false, summary: `alpha.${k} が数値でない` };
    const now = new Date().toISOString();
    const { error: closeErr } = await supabase
      .from("amd_score_alpha")
      .update({ effective_to: now })
      .is("effective_to", null);
    if (closeErr) return { ok: false, summary: `prev α close 失敗: ${closeErr.message}` };
    const { error } = await supabase.from("amd_score_alpha").insert({
      alpha: a,
      effective_from: now,
      effective_to: null,
      notes: typeof input.notes === "string" ? input.notes : "tsukuyomi chat",
    });
    if (error) return { ok: false, summary: `α 保存失敗: ${error.message}` };
    return { ok: true, summary: `α 重みを更新` };
  }

  if (name === "add_project_event") {
    const occurred_on = typeof input.occurred_on === "string" ? input.occurred_on : null;
    const kind = typeof input.kind === "string" ? input.kind : null;
    const label = typeof input.label === "string" ? input.label : null;
    if (!occurred_on || !kind || !label) return { ok: false, summary: "occurred_on/kind/label が必要" };
    const { error } = await supabase.from("project_events").insert({
      project_id: projectId,
      occurred_on,
      kind,
      label,
      meta: input.meta ?? {},
      source: "tsukuyomi_chat",
    });
    if (error) return { ok: false, summary: `event 追加失敗: ${error.message}` };
    await supabase.from("project_ventures").update({ narrative_invalidated_at: new Date().toISOString() }).eq("project_id", projectId);
    return { ok: true, summary: `イベント追加 (${kind} / ${occurred_on})` };
  }

  if (name === "add_project_member") {
    const full_name = typeof input.full_name === "string" ? input.full_name : null;
    const role = typeof input.role === "string" ? input.role : null;
    const member_kind = typeof input.member_kind === "string" ? input.member_kind : null;
    if (!full_name || !role || !member_kind) return { ok: false, summary: "full_name/role/member_kind が必要" };
    const { error } = await supabase.from("project_venture_members").insert({
      project_id: projectId,
      full_name,
      role,
      member_kind,
      started_at: typeof input.started_at === "string" ? input.started_at : null,
      ended_at: typeof input.ended_at === "string" ? input.ended_at : null,
      note: typeof input.note === "string" ? input.note : null,
    });
    if (error) return { ok: false, summary: `member 追加失敗: ${error.message}` };
    await supabase.from("project_ventures").update({ narrative_invalidated_at: new Date().toISOString() }).eq("project_id", projectId);
    return { ok: true, summary: `メンバー追加 (${full_name} / ${role})` };
  }

  if (name === "add_project_partner") {
    const partner_name = typeof input.partner_name === "string" ? input.partner_name : null;
    const partner_type = typeof input.partner_type === "string" ? input.partner_type : null;
    if (!partner_name || !partner_type) return { ok: false, summary: "partner_name/partner_type が必要" };
    const { error } = await supabase.from("project_partners").insert({
      project_id: projectId,
      partner_name,
      partner_type,
      partner_role: typeof input.partner_role === "string" ? input.partner_role : null,
      sales_target_date: typeof input.sales_target_date === "string" ? input.sales_target_date : null,
      notes: typeof input.notes === "string" ? input.notes : null,
      sales_actuals: {},
      is_sold: false,
    });
    if (error) return { ok: false, summary: `partner 追加失敗: ${error.message}` };
    await supabase.from("project_ventures").update({ narrative_invalidated_at: new Date().toISOString() }).eq("project_id", projectId);
    return { ok: true, summary: `事業会社追加 (${partner_name} / ${partner_type})` };
  }

  if (name === "add_pl_monthly") {
    const ym = typeof input.ym === "string" ? input.ym : null;
    if (!ym) return { ok: false, summary: "ym が必要" };
    const payload: Record<string, unknown> = {
      project_id: projectId,
      ym,
      revenue_yen: typeof input.revenue_yen === "number" ? Math.round(input.revenue_yen) : 0,
      cogs_yen: typeof input.cogs_yen === "number" ? Math.round(input.cogs_yen) : 0,
      personnel_yen: typeof input.personnel_yen === "number" ? Math.round(input.personnel_yen) : 0,
      rd_yen: typeof input.rd_yen === "number" ? Math.round(input.rd_yen) : 0,
      marketing_yen: typeof input.marketing_yen === "number" ? Math.round(input.marketing_yen) : 0,
      other_opex_yen: typeof input.other_opex_yen === "number" ? Math.round(input.other_opex_yen) : 0,
      notes: typeof input.notes === "string" ? input.notes : null,
    };
    const { error } = await supabase.from("project_pl_monthly").upsert(payload, { onConflict: "project_id,ym" });
    if (error) return { ok: false, summary: `PL 追加失敗: ${error.message}` };
    return { ok: true, summary: `月次試算表 ${ym} を upsert` };
  }

  return { ok: false, summary: `unknown tool: ${name}` };
}

export async function POST(req: Request) {
  let body: {
    session_id?: string;
    page_path?: string | null;
    project_id?: string | null;
    messages?: IncomingMessage[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  if (!body.session_id || !body.messages || body.messages.length === 0) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const supabase = createAdminClient();

  let contextBlock = "";
  if (body.project_id) {
    const ctx = await loadProjectContext(supabase, body.project_id);
    if (ctx) {
      contextBlock = `\n# 画面に表示されている PJ コックピットの全 context (${body.project_id})\n${JSON.stringify(ctx, null, 2)}\n`;
    }
  }

  const fullSystem = SYSTEM + contextBlock;

  // 直近のユーザー発話を保存
  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  if (lastUser) {
    await supabase.from("tsukuyomi_chat_logs").insert({
      project_id: body.project_id ?? null,
      session_id: body.session_id,
      page_path: body.page_path ?? null,
      role: "user",
      content: lastUser.content,
    });
  }

  const anthropic = new Anthropic({ apiKey });
  const conversation: Anthropic.Messages.MessageParam[] = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // tool ループ (最大 5 ラウンド)
  const applied: ApplyAction[] = [];
  let lastReply = "";
  for (let round = 0; round < 5; round += 1) {
    let r: Anthropic.Messages.Message;
    try {
      r = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2000,
        system: fullSystem,
        messages: conversation,
        tools: TOOLS,
      });
    } catch (e) {
      console.error("[tsukuyomi/chat] anthropic error", e);
      return NextResponse.json({ error: "llm error", detail: String(e) }, { status: 500 });
    }

    const toolUses = r.content.filter((c) => c.type === "tool_use") as Array<{
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }>;
    const textParts = r.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("\n");
    if (textParts) lastReply = textParts;

    if (toolUses.length === 0 || r.stop_reason === "end_turn") {
      break;
    }

    // tool 実行 + assistant ターンを履歴に追加 + tool_result を返す
    conversation.push({ role: "assistant", content: r.content });
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      // web_search は SDK が自動処理、ローカル実行不要
      if (tu.name === "web_search") continue;
      const exec = await executeTool(supabase, body.project_id ?? null, tu.name, tu.input);
      if (exec.ok) applied.push({ kind: tu.name, detail: exec.summary });
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: exec.summary,
        is_error: !exec.ok,
      });
    }
    if (toolResults.length === 0) break;
    conversation.push({ role: "user", content: toolResults });
  }

  // assistant 返事を保存
  if (lastReply) {
    await supabase.from("tsukuyomi_chat_logs").insert({
      project_id: body.project_id ?? null,
      session_id: body.session_id,
      page_path: body.page_path ?? null,
      role: "assistant",
      content: lastReply,
      applied_actions: applied.length > 0 ? applied : null,
    });
  }

  // 修正依頼系発話 (record_xrl_feedback / invalidate_narrative / 概要修正) は admin の修正依頼履歴にも残す
  if (applied.length > 0 && body.project_id && lastUser) {
    await supabase.from("narrative_feedbacks").insert({
      project_id: body.project_id,
      item_date: null,
      item_title: "(つくよみチャット)",
      feedback: lastUser.content,
      status: "applied",
      applied_at: new Date().toISOString(),
      applied_note: `tsukuyomi chat: ${applied.map((a) => a.kind).join(", ")}`,
    });
  }

  return NextResponse.json({
    reply: lastReply || "(返事を組み立てられませんでした)",
    applied: applied.length > 0 ? applied : undefined,
  });
}
