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
import { calculateAmdScore, calculatePrsScore, classifyPhase, normalizeAlpha, AXIS_LABEL_JP, PHASE_LABEL_JP, type AlphaWeights } from "@/lib/amd-score";
import { getLevelInfo, type XrlAxisKey } from "@/lib/xrl-level-definitions";

export const runtime = "nodejs";
export const maxDuration = 60;

interface IncomingAttachment {
  name: string;
  mediaType: string;             // "image/png" | "application/pdf" | "text/plain" 等
  size: number;
  data: string;                  // base64
}

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: IncomingAttachment[];
}

// Sonnet が直接受けられる media types
const ANTHROPIC_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const ANTHROPIC_DOC_TYPES = new Set(["application/pdf"]);

function attachmentToContentBlock(a: IncomingAttachment): Anthropic.Messages.ContentBlockParam | null {
  if (ANTHROPIC_IMAGE_TYPES.has(a.mediaType)) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: a.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: a.data,
      },
    };
  }
  if (ANTHROPIC_DOC_TYPES.has(a.mediaType)) {
    return {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: a.data,
      },
    } as unknown as Anthropic.Messages.ContentBlockParam;   // SDK 型に未対応な場合のフォールバック
  }
  // テキスト系は decode して text として渡す
  if (a.mediaType.startsWith("text/")) {
    try {
      // base64 → utf-8
      const binary = Buffer.from(a.data, "base64").toString("utf-8");
      // 巨大な貼り付けを防ぐため 200KB で truncate
      const trimmed = binary.length > 200_000 ? binary.slice(0, 200_000) + "\n... (truncated)" : binary;
      return { type: "text", text: `[添付ファイル: ${a.name}]\n${trimmed}` };
    } catch {
      return { type: "text", text: `[添付ファイル: ${a.name} — decode 失敗]` };
    }
  }
  return { type: "text", text: `[添付ファイル: ${a.name} (${a.mediaType}) — Sonnet 未対応形式]` };
}

interface ApplyAction {
  kind: string;
  detail: string;
}


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
    prs_primary_score: number | null;
    prs_status: "ready" | "missing" | "no_row";
    prs_missing_axes: string[];
    legacy_amd_score: number | null;
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
      .select("id, evaluated_at, mu_a, mu_i, mu_g, trl, brl, grl, srl, hrl, frl, prs_potential, prs_r_net, alq_self_awareness, alq_relational_transparency, alq_balanced_processing, alq_internalized_moral, frl_grit, frl_resilience, frl_notes, mu_notes, xrl_notes, shallow_tech_mode, evaluator, notes")
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
              next_level_checklist: info.next?.checklist ?? null,
            },
          ];
        }),
      )
    : null;

  // AMD Score 計算 (最新 input × active alpha)
  const alpha = normalizeAlpha((alphaRow as { alpha?: unknown } | null)?.alpha);
  const latestInput = (amdInputs ?? []).at(-1) ?? null;
  let prsPrimaryScore: number | null = null;
  let prsStatus: "ready" | "missing" | "no_row" = "no_row";
  let prsMissingAxes: string[] = [];
  let legacyAmdScore: number | null = null;
  let phaseLabel: string | null = null;
  let bottleneckAxis: string | null = null;
  if (latestInput) {
    const li = latestInput as Record<string, number | boolean | null>;
    const legacyResult = calculateAmdScore({
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
    const prsResult = calculatePrsScore({
      P: (li.prs_potential as number | null) ?? null,
      mu_A: (li.mu_a as number | null) ?? 0,
      mu_I: (li.mu_i as number | null) ?? 0,
      mu_G: (li.mu_g as number | null) ?? 0,
      TRL: (li.shallow_tech_mode as boolean) ? null : (li.trl as number | null) ?? 0,
      BRL: (li.brl as number | null) ?? 0,
      GRL: (li.grl as number | null) ?? 0,
      SRL: (li.srl as number | null) ?? 0,
      HRL: (li.hrl as number | null) ?? 0,
      FRL: (li.frl as number | null) ?? 0,
      R_net: (li.prs_r_net as number | null) ?? null,
    });
    prsPrimaryScore = prsResult.score;
    prsStatus = prsResult.status;
    prsMissingAxes = prsResult.missingAxes;
    legacyAmdScore = legacyResult.score;
    phaseLabel = PHASE_LABEL_JP[classifyPhase(legacyResult.score)];
    bottleneckAxis = AXIS_LABEL_JP[legacyResult.bottleneck];
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
      prs_primary_score: prsPrimaryScore,
      prs_status: prsStatus,
      prs_missing_axes: prsMissingAxes,
      legacy_amd_score: legacyAmdScore,
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
      "AMD Score の legacy 7 軸入力と SPS primary 入力 (P / R_net) を amd_score_inputs に upsert する。\n\n" +
      "## 各軸の正式定義 (内閣府 SIP / NASA 9 段階) — レベリング時は必ずこの定義に沿う\n\n" +
      "**TRL** (Technology Readiness Level, NASA Mankins 1995, 内閣府 SIP 互換):\n" +
      "  1=基本原理確認 / 2=技術概念定式化 / 3=実験的概念検証\n" +
      "  4=ラボ環境試作 / 5=関連環境試作 / 6=実環境近似試作\n" +
      "  7=実環境デモ / 8=実機完成・認証 / 9=実運用実績\n" +
      "**BRL** (Business Readiness Level, 内閣府 SIP):\n" +
      "  1-3=仮説段階 (1: 課題仮説 / 2: 顧客仮説 / 3: 収益モデル draft)\n" +
      "  4-6=検証段階 (4: PoC / 5: 初期顧客 N 社 / 6: 継続契約・MRR)\n" +
      "  7-9=拡大段階 (7: 量産・複数地域展開 / 8: 黒字化 / 9: 業界 leader)\n" +
      "**GRL** (Governance Readiness Level): 規制適合性 + 標準化\n" +
      "  1-3=規制リスク特定段階 / 4-6=届出・認証取得段階 / 7-9=業界標準・国際標準化主導\n" +
      "**SRL** (Social Readiness Level, EU H2020 互換): 一般消費者・世論の受容性\n" +
      "  1-3=社会課題認知段階 / 4-6=一般メディア露出・世論形成 / 7-9=社会実装・受容定着\n" +
      "**HRL** (Human Resources Readiness Level): チーム補完性・スキル分布\n" +
      "  1-3=創業期 1-3 名 / 4-6=コア機能カバー (技術/事業/ガバナンス) / 7-9=複数階層・後継 plan あり\n" +
      "**FRL**: 6 因子の重み付け平均 = 0.6·ALQ_4 + 0.2·Grit + 0.2·Resilience\n" +
      "**σ_SU**: ((μ_A+1)(μ_I+1)(μ_G+1))^(1/3) - 1 (自動算出、入力不要)\n\n" +
      "## 必須運用\n" +
      "- 値だけでなく必ず根拠 notes も書く (mu_notes_a/i/g, xrl_notes_trl/brl/grl/srl/hrl, frl_notes)\n" +
      "- 値が現在の SIP 段階定義と整合してるか自問してから upsert\n" +
      "- 既存値より大きく動かす場合は理由を notes に明記",
    input_schema: {
      type: "object",
      properties: {
        evaluated_at: { type: "string", description: "評価日 YYYY-MM-DD (省略時は今日)" },
        mu_A: { type: "number", description: "学術 μ_A 0-9 (Triple Helix 学術観測量。論文急増/学会動向/科研費等)" },
        mu_I: { type: "number", description: "産業 μ_I 0-9 (Triple Helix 産業観測量。大手 R&D 投資/SU 動向/特許)" },
        mu_G: { type: "number", description: "政府 μ_G 0-9 (Triple Helix 政府観測量。SIP/NEDO 採択/補助金/規制動向)" },
        mu_notes_a: { type: "string", description: "μ_A の評価根拠 (例: Adv. Mater. 2024 で N 件論文急増、関連特許も成長中)" },
        mu_notes_i: { type: "string", description: "μ_I の評価根拠 (例: 大手 N 社が R&D 投資発表、SoC スピンアウト動向)" },
        mu_notes_g: { type: "string", description: "μ_G の評価根拠 (例: 内閣府 SIP 採択、補助金 X 億円規模)" },
        trl: { type: "number", description: "TRL 0-9 (NASA 9 段階: 1=基本原理 / 4=ラボ試作 / 6=実環境試作 / 7=実環境デモ / 9=運用実績)。Shallow Tech モード時は null" },
        brl: { type: "number", description: "BRL 0-9 (1-3=仮説 / 4-6=検証 / 7-9=拡大)" },
        grl: { type: "number", description: "GRL 0-9 (1-3=規制リスク特定 / 4-6=届出/認証 / 7-9=業界/国際標準化)" },
        srl: { type: "number", description: "SRL 0-9 (1-3=社会課題認知 / 4-6=メディア/世論 / 7-9=社会実装定着)" },
        hrl: { type: "number", description: "HRL 0-9 (1-3=創業期 1-3 名 / 4-6=コア機能カバー / 7-9=複数階層・後継 plan)" },
        xrl_notes_trl: { type: "string", description: "TRL の評価根拠 (NASA/SIP 9 段階定義のどの位置か、その判断材料)" },
        xrl_notes_brl: { type: "string", description: "BRL の評価根拠 (顧客検証・収益モデル状況、SIP 段階位置)" },
        xrl_notes_grl: { type: "string", description: "GRL の評価根拠 (規制適合・標準化状況、SIP 段階位置)" },
        xrl_notes_srl: { type: "string", description: "SRL の評価根拠 (一般受容・メディア露出、EU H2020 段階位置)" },
        xrl_notes_hrl: { type: "string", description: "HRL の評価根拠 (チーム補完性・スキル分布、SIP 段階位置)" },
        frl: { type: "number", description: "FRL 0-9 (6 因子平均で自動算出可: 0.6·ALQ_avg + 0.2·Grit + 0.2·Resilience)" },
        alq_self_awareness: { type: "number", description: "ALQ 自己認識 0-9 (Walumbwa 2008) — 自分の強み/弱み/価値観の理解" },
        alq_relational_transparency: { type: "number", description: "ALQ 関係透明性 0-9 — 本音と建前の一致、誠実性" },
        alq_balanced_processing: { type: "number", description: "ALQ 均衡的処理 0-9 — 反対意見も含む客観評価" },
        alq_internalized_moral: { type: "number", description: "ALQ 内在化された道徳観 0-9 — 倫理基準への一貫性" },
        frl_grit: { type: "number", description: "Grit (集中力) 0-9 — 脇目も振らず長期目標に邁進する passion + perseverance (Duckworth 2007)" },
        frl_resilience: { type: "number", description: "Resilience (タフさ) 0-9 — VC 拒絶等の失敗からの回復力 (Markman 2005)" },
        frl_notes: { type: "string", description: "FRL 自由備考 (CEO 像、外部評価、Founder Network 効果、過去 SU 経験など)" },
        prs_potential: { type: "number", description: "SPS primary の P (Potential) 0-9。未確定なら送らない" },
        prs_r_net: { type: "number", description: "SPS primary の R_net 0-9。粗利 - 運営コスト - 本命から奪うリソース毀損。" },
        shallow_tech_mode: { type: "boolean", description: "Shallow Tech モード (独自技術なし SU で TRL 軸を計算から除外)" },
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
  // === VC List 系 tool (PJ コックピット外でも使える。vc_name で VC を指定) ===
  {
    name: "upsert_vc",
    description:
      "VC を vcs に upsert (name 一意)。既に存在する VC の特性更新にも使う。" +
      "amd_rating は AMD 視点の相性 1-5 (空 OK)。",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "VC 名 (正式)" },
        name_en: { type: "string" },
        type: { type: "string", enum: ["independent", "cvc", "gov", "corporate", "overseas"] },
        thesis: { type: "string", description: "投資テーゼ" },
        stage_focus: { type: "array", items: { type: "string" }, description: "投資ステージの配列" },
        ticket_min_jpy: { type: "number" },
        ticket_max_jpy: { type: "number" },
        hq: { type: "string" },
        website: { type: "string" },
        notes: { type: "string" },
        amd_rating: { type: "number", description: "AMD 相性 1-5" },
        amd_rating_note: { type: "string", description: "評価理由" },
      },
      required: ["name"],
    },
  },
  {
    name: "upsert_vc_fund",
    description:
      "VC のファンド情報 (X 号目) を vc_funds に upsert (vc_name + fund_no 一意)。" +
      "fundraise / final close のニュースを聞いたら呼ぶ。size_jpy は円整数 (80億 = 8000000000)。",
    input_schema: {
      type: "object",
      properties: {
        vc_name: { type: "string", description: "対象 VC 名" },
        fund_no: { type: "number", description: "X 号目 (1, 2, 3, ...)" },
        name: { type: "string", description: "正式名称 (例: Abies II 投資事業有限責任組合)" },
        size_jpy: { type: "number", description: "確定サイズ (円)" },
        size_jpy_low: { type: "number", description: "募集中レンジ下限 (円)" },
        size_jpy_high: { type: "number", description: "募集中レンジ上限 (円)" },
        vintage_year: { type: "number" },
        status: {
          type: "string",
          enum: ["raising", "first_closed", "final_closed", "investing", "harvesting", "closed", "unknown"],
        },
        first_close_at: { type: "string", description: "1st クローズ日 YYYY-MM-DD" },
        final_close_at: { type: "string", description: "ファイナルクローズ日 YYYY-MM-DD" },
        target_close_at: { type: "string", description: "目標クローズ日 (募集中の時)" },
        source_url: { type: "string", description: "一次情報 URL" },
        notes: { type: "string" },
      },
      required: ["vc_name", "fund_no"],
    },
  },
  {
    name: "update_vc_dry_powder",
    description:
      "VC ファンドの ドライパウダー残額 (推定 or 担当直聞き or 公表値) を更新する。" +
      "source は必ず指定: estimated=推定 / heard_from_contact=担当から直接聞いた / public_disclosure=公表値。" +
      "heard_from_contact のときは contact_name を埋める。",
    input_schema: {
      type: "object",
      properties: {
        vc_name: { type: "string" },
        fund_no: { type: "number" },
        dry_powder_jpy_low: { type: "number" },
        dry_powder_jpy_high: { type: "number" },
        source: {
          type: "string",
          enum: ["estimated", "heard_from_contact", "public_disclosure"],
        },
        contact_name: { type: "string", description: "heard_from_contact のとき、誰から聞いたか (vc_contacts.name と一致)" },
        note: { type: "string" },
      },
      required: ["vc_name", "fund_no", "source"],
    },
  },
  {
    name: "add_vc_investment",
    description:
      "VC の出資イベントを vc_investments に追加。target_company は文字列。自社 PJ なら our_project_id (例: p03) を埋める。",
    input_schema: {
      type: "object",
      properties: {
        vc_name: { type: "string" },
        target_company: { type: "string" },
        target_company_en: { type: "string" },
        fund_no: { type: "number", description: "どの号ファンドから出したか (不明可)" },
        amount_jpy: { type: "number" },
        round: { type: "string", description: "seed / series_a など" },
        invested_at: { type: "string", description: "YYYY-MM-DD" },
        is_lead: { type: "boolean" },
        our_project_id: { type: "string", description: "自社 PJ の project_id (p03 等)。該当なしなら省略" },
        source_url: { type: "string" },
        notes: { type: "string" },
      },
      required: ["vc_name", "target_company"],
    },
  },
  {
    name: "add_vc_contact",
    description: "VC 担当者 (投資家としての関係) を vc_contacts に追加。GAP ファンド事業化推進機関で参画する場合は add_project_member を使う。",
    input_schema: {
      type: "object",
      properties: {
        vc_name: { type: "string" },
        name: { type: "string" },
        name_en: { type: "string" },
        role: { type: "string", description: "GP / Partner / Principal / Associate など" },
        email: { type: "string" },
        phone: { type: "string" },
        linkedin: { type: "string" },
        notes: { type: "string" },
      },
      required: ["vc_name", "name"],
    },
  },
  {
    name: "add_vc_news",
    description:
      "VC 関連ニュースを vc_news に追加 (verified=true / ingested_by='tsukuyomi')。" +
      "Atlas (世界マクロ) とは別系統。VC のファンドレイズ / 出資 / 人事 / テーゼ変化など。",
    input_schema: {
      type: "object",
      properties: {
        vc_name: { type: "string" },
        kind: {
          type: "string",
          enum: ["fundraise", "investment", "personnel", "fund_close", "thesis_change", "press", "other"],
        },
        title: { type: "string" },
        body: { type: "string" },
        occurred_on: { type: "string" },
        source_url: { type: "string" },
      },
      required: ["vc_name", "kind", "title"],
    },
  },
  {
    name: "link_project_vc",
    description:
      "PJ × VC のリレーション (検討〜投資ステータス) を project_vc_relations に upsert (project_id + vc_name 一意)。" +
      "status はピッチ → 検討 → DD → タームシート → 投資 / 見送り / 辞退 のいずれか。",
    input_schema: {
      type: "object",
      properties: {
        vc_name: { type: "string" },
        project_id: { type: "string", description: "対象 PJ (p03 等)。コックピット内なら自動補完" },
        status: {
          type: "string",
          enum: ["not_contacted", "pitching", "evaluating", "dd", "term_sheet", "invested", "passed", "declined"],
        },
        amd_owner_code_name: { type: "string", description: "AMD 側担当 (members.code_name)" },
        contact_name: { type: "string", description: "VC 担当 (vc_contacts.name)" },
        first_contact_at: { type: "string" },
        last_touch_at: { type: "string" },
        expected_amount_jpy: { type: "number" },
        notes: { type: "string" },
      },
      required: ["vc_name", "status"],
    },
  },
  // 公式 web_search tool (推論時にネット検索)。SDK の型に未対応なので as unknown
  { type: "web_search_20250305", name: "web_search", max_uses: 5 } as unknown as Anthropic.Messages.Tool,
];

async function resolveVcId(
  supabase: ReturnType<typeof createAdminClient>,
  vcName: string
): Promise<string | null> {
  const { data } = await supabase.from("vcs").select("id").eq("name", vcName).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function executeVcTool(
  supabase: ReturnType<typeof createAdminClient>,
  contextProjectId: string | null,
  name: string,
  input: Record<string, unknown>
): Promise<{ ok: boolean; summary: string } | null> {
  const vcName = typeof input.vc_name === "string" ? input.vc_name : null;

  if (name === "upsert_vc") {
    const vName = typeof input.name === "string" ? input.name : null;
    if (!vName) return { ok: false, summary: "name 必須" };
    const slug = (typeof input.name_en === "string" ? input.name_en : vName)
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || null;
    const payload: Record<string, unknown> = {
      name: vName,
      name_en: typeof input.name_en === "string" ? input.name_en : null,
      slug,
      type: typeof input.type === "string" ? input.type : null,
      thesis: typeof input.thesis === "string" ? input.thesis : null,
      stage_focus: Array.isArray(input.stage_focus) ? input.stage_focus : null,
      ticket_min_jpy: typeof input.ticket_min_jpy === "number" ? input.ticket_min_jpy : null,
      ticket_max_jpy: typeof input.ticket_max_jpy === "number" ? input.ticket_max_jpy : null,
      hq: typeof input.hq === "string" ? input.hq : null,
      website: typeof input.website === "string" ? input.website : null,
      notes: typeof input.notes === "string" ? input.notes : null,
      updated_at: new Date().toISOString(),
    };
    if (typeof input.amd_rating === "number") {
      payload.amd_rating = Math.max(1, Math.min(5, Math.round(input.amd_rating)));
      payload.amd_rating_note = typeof input.amd_rating_note === "string" ? input.amd_rating_note : null;
      payload.amd_rating_updated_at = new Date().toISOString();
    }
    const { error } = await supabase.from("vcs").upsert(payload, { onConflict: "name" });
    if (error) return { ok: false, summary: `vc upsert 失敗: ${error.message}` };
    return { ok: true, summary: `VC upsert (${vName})` };
  }

  if (name === "upsert_vc_fund") {
    if (!vcName) return { ok: false, summary: "vc_name 必須" };
    const fundNo = typeof input.fund_no === "number" ? input.fund_no : null;
    if (fundNo == null) return { ok: false, summary: "fund_no 必須" };
    const vcId = await resolveVcId(supabase, vcName);
    if (!vcId) return { ok: false, summary: `VC '${vcName}' が見つからない (まず upsert_vc から)` };
    const { error } = await supabase.from("vc_funds").upsert(
      {
        vc_id: vcId,
        fund_no: fundNo,
        name: typeof input.name === "string" ? input.name : null,
        size_jpy: typeof input.size_jpy === "number" ? input.size_jpy : null,
        size_jpy_low: typeof input.size_jpy_low === "number" ? input.size_jpy_low : null,
        size_jpy_high: typeof input.size_jpy_high === "number" ? input.size_jpy_high : null,
        vintage_year: typeof input.vintage_year === "number" ? input.vintage_year : null,
        status: typeof input.status === "string" ? input.status : "unknown",
        first_close_at: typeof input.first_close_at === "string" ? input.first_close_at : null,
        final_close_at: typeof input.final_close_at === "string" ? input.final_close_at : null,
        target_close_at: typeof input.target_close_at === "string" ? input.target_close_at : null,
        source_url: typeof input.source_url === "string" ? input.source_url : null,
        notes: typeof input.notes === "string" ? input.notes : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "vc_id,fund_no" }
    );
    if (error) return { ok: false, summary: `fund upsert 失敗: ${error.message}` };
    return { ok: true, summary: `${vcName} #${fundNo} ファンドを upsert` };
  }

  if (name === "update_vc_dry_powder") {
    if (!vcName) return { ok: false, summary: "vc_name 必須" };
    const fundNo = typeof input.fund_no === "number" ? input.fund_no : null;
    const source = typeof input.source === "string" ? input.source : null;
    if (fundNo == null || !source) return { ok: false, summary: "fund_no と source 必須" };
    const vcId = await resolveVcId(supabase, vcName);
    if (!vcId) return { ok: false, summary: `VC '${vcName}' が見つからない` };
    let heardFromId: string | null = null;
    if (source === "heard_from_contact" && typeof input.contact_name === "string") {
      const { data: c } = await supabase
        .from("vc_contacts")
        .select("id")
        .eq("vc_id", vcId)
        .eq("name", input.contact_name)
        .maybeSingle();
      heardFromId = (c as { id: string } | null)?.id ?? null;
    }
    const { error } = await supabase
      .from("vc_funds")
      .update({
        dry_powder_jpy_low: typeof input.dry_powder_jpy_low === "number" ? input.dry_powder_jpy_low : null,
        dry_powder_jpy_high: typeof input.dry_powder_jpy_high === "number" ? input.dry_powder_jpy_high : null,
        dry_powder_source: source,
        dry_powder_heard_from: heardFromId,
        dry_powder_note: typeof input.note === "string" ? input.note : null,
        dry_powder_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("vc_id", vcId)
      .eq("fund_no", fundNo);
    if (error) return { ok: false, summary: `DPE update 失敗: ${error.message}` };
    return { ok: true, summary: `${vcName} #${fundNo} DPE 更新 (${source})` };
  }

  if (name === "add_vc_investment") {
    if (!vcName) return { ok: false, summary: "vc_name 必須" };
    const target = typeof input.target_company === "string" ? input.target_company : null;
    if (!target) return { ok: false, summary: "target_company 必須" };
    const vcId = await resolveVcId(supabase, vcName);
    if (!vcId) return { ok: false, summary: `VC '${vcName}' が見つからない` };
    let fundId: string | null = null;
    if (typeof input.fund_no === "number") {
      const { data: f } = await supabase
        .from("vc_funds")
        .select("id")
        .eq("vc_id", vcId)
        .eq("fund_no", input.fund_no)
        .maybeSingle();
      fundId = (f as { id: string } | null)?.id ?? null;
    }
    const { error } = await supabase.from("vc_investments").insert({
      vc_id: vcId,
      target_company: target,
      target_company_en: typeof input.target_company_en === "string" ? input.target_company_en : null,
      fund_id: fundId,
      our_project_id: typeof input.our_project_id === "string" ? input.our_project_id : null,
      amount_jpy: typeof input.amount_jpy === "number" ? input.amount_jpy : null,
      round: typeof input.round === "string" ? input.round : null,
      invested_at: typeof input.invested_at === "string" ? input.invested_at : null,
      is_lead: !!input.is_lead,
      source_url: typeof input.source_url === "string" ? input.source_url : null,
      notes: typeof input.notes === "string" ? input.notes : null,
    });
    if (error) return { ok: false, summary: `investment insert 失敗: ${error.message}` };
    return { ok: true, summary: `${vcName} → ${target} 出資を記録` };
  }

  if (name === "add_vc_contact") {
    if (!vcName) return { ok: false, summary: "vc_name 必須" };
    const personName = typeof input.name === "string" ? input.name : null;
    if (!personName) return { ok: false, summary: "name 必須" };
    const vcId = await resolveVcId(supabase, vcName);
    if (!vcId) return { ok: false, summary: `VC '${vcName}' が見つからない` };
    const { error } = await supabase.from("vc_contacts").insert({
      vc_id: vcId,
      name: personName,
      name_en: typeof input.name_en === "string" ? input.name_en : null,
      role: typeof input.role === "string" ? input.role : null,
      email: typeof input.email === "string" ? input.email : null,
      phone: typeof input.phone === "string" ? input.phone : null,
      linkedin: typeof input.linkedin === "string" ? input.linkedin : null,
      notes: typeof input.notes === "string" ? input.notes : null,
    });
    if (error) return { ok: false, summary: `contact insert 失敗: ${error.message}` };
    return { ok: true, summary: `${vcName} 担当 ${personName} を追加` };
  }

  if (name === "add_vc_news") {
    if (!vcName) return { ok: false, summary: "vc_name 必須" };
    const title = typeof input.title === "string" ? input.title : null;
    const kind = typeof input.kind === "string" ? input.kind : null;
    if (!title || !kind) return { ok: false, summary: "title / kind 必須" };
    const vcId = await resolveVcId(supabase, vcName);
    if (!vcId) return { ok: false, summary: `VC '${vcName}' が見つからない` };
    const { error } = await supabase.from("vc_news").insert({
      vc_id: vcId,
      kind,
      title,
      body: typeof input.body === "string" ? input.body : null,
      occurred_on: typeof input.occurred_on === "string" ? input.occurred_on : null,
      source_url: typeof input.source_url === "string" ? input.source_url : null,
      ingested_by: "tsukuyomi",
      verified: true,
    });
    if (error) return { ok: false, summary: `vc_news insert 失敗: ${error.message}` };
    return { ok: true, summary: `${vcName} ニュース追加 (${kind})` };
  }

  if (name === "link_project_vc") {
    if (!vcName) return { ok: false, summary: "vc_name 必須" };
    const status = typeof input.status === "string" ? input.status : null;
    if (!status) return { ok: false, summary: "status 必須" };
    const projectId = typeof input.project_id === "string" ? input.project_id : contextProjectId;
    if (!projectId) return { ok: false, summary: "project_id 必須 (PJ コックピット外では明示指定)" };
    const vcId = await resolveVcId(supabase, vcName);
    if (!vcId) return { ok: false, summary: `VC '${vcName}' が見つからない` };

    let amdOwnerId: string | null = null;
    if (typeof input.amd_owner_code_name === "string") {
      const { data: m } = await supabase
        .from("members")
        .select("member_id")
        .eq("code_name", input.amd_owner_code_name)
        .maybeSingle();
      amdOwnerId = (m as { member_id: string } | null)?.member_id ?? null;
    }
    let contactId: string | null = null;
    if (typeof input.contact_name === "string") {
      const { data: c } = await supabase
        .from("vc_contacts")
        .select("id")
        .eq("vc_id", vcId)
        .eq("name", input.contact_name)
        .maybeSingle();
      contactId = (c as { id: string } | null)?.id ?? null;
    }

    const { error } = await supabase.from("project_vc_relations").upsert(
      {
        project_id: projectId,
        vc_id: vcId,
        status,
        amd_owner_member_id: amdOwnerId,
        vc_contact_id: contactId,
        first_contact_at: typeof input.first_contact_at === "string" ? input.first_contact_at : null,
        last_touch_at: typeof input.last_touch_at === "string" ? input.last_touch_at : null,
        expected_amount_jpy: typeof input.expected_amount_jpy === "number" ? input.expected_amount_jpy : null,
        notes: typeof input.notes === "string" ? input.notes : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,vc_id" }
    );
    if (error) return { ok: false, summary: `relation upsert 失敗: ${error.message}` };
    return { ok: true, summary: `${projectId} × ${vcName} → ${status}` };
  }

  return null; // VC tool ではない
}

interface VcChatContext {
  vc: Record<string, unknown>;
  funds: unknown[];
  investments: unknown[];
  contacts: unknown[];
  relations: unknown[];
  recent_news: unknown[];
}

async function loadVcContext(
  supabase: ReturnType<typeof createAdminClient>,
  vcId: string
): Promise<VcChatContext | null> {
  const [{ data: vc }, { data: funds }, { data: invs }, { data: contacts }, { data: rels }, { data: news }] = await Promise.all([
    supabase.from("vcs").select("*").eq("id", vcId).maybeSingle(),
    supabase.from("vc_funds").select("*").eq("vc_id", vcId).order("fund_no"),
    supabase.from("vc_investments").select("target_company, fund_id, our_project_id, amount_jpy, round, invested_at, is_lead, source_url").eq("vc_id", vcId).order("invested_at", { ascending: false }).limit(50),
    supabase.from("vc_contacts").select("name, role, email").eq("vc_id", vcId),
    supabase.from("project_vc_relations").select("project_id, status, last_touch_at, amd_owner_member_id, vc_contact_id").eq("vc_id", vcId),
    supabase.from("vc_news").select("kind, title, body, occurred_on, source_url, verified, ingested_by").eq("vc_id", vcId).order("occurred_on", { ascending: false, nullsFirst: false }).limit(20),
  ]);
  if (!vc) return null;
  return {
    vc: vc as Record<string, unknown>,
    funds: funds ?? [],
    investments: invs ?? [],
    contacts: contacts ?? [],
    relations: rels ?? [],
    recent_news: news ?? [],
  };
}

async function executeTool(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string | null,
  name: string,
  input: Record<string, unknown>
): Promise<{ ok: boolean; summary: string }> {
  // VC 系 tool は projectId 不要
  const vcRes = await executeVcTool(supabase, projectId, name, input);
  if (vcRes) return vcRes;

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
      .select("id, mu_a, mu_i, mu_g, trl, brl, grl, srl, hrl, frl, prs_potential, prs_r_net, alq_self_awareness, alq_relational_transparency, alq_balanced_processing, alq_internalized_moral, frl_grit, frl_resilience, frl_notes, mu_notes, xrl_notes, shallow_tech_mode, notes")
      .eq("project_id", projectId)
      .eq("evaluated_at", evaluated_at_iso)
      .maybeSingle();
    const existingRow = existing as Record<string, unknown> | null;
    // mu_notes / xrl_notes は JSONB なのでフィールド単位でマージ。
    const existingMuNotes = (existingRow?.mu_notes ?? {}) as Record<string, unknown>;
    const existingXrlNotes = (existingRow?.xrl_notes ?? {}) as Record<string, unknown>;
    const muNotes = {
      a: typeof input.mu_notes_a === "string" ? input.mu_notes_a : existingMuNotes.a ?? null,
      i: typeof input.mu_notes_i === "string" ? input.mu_notes_i : existingMuNotes.i ?? null,
      g: typeof input.mu_notes_g === "string" ? input.mu_notes_g : existingMuNotes.g ?? null,
    };
    const xrlNotes = {
      trl: typeof input.xrl_notes_trl === "string" ? input.xrl_notes_trl : existingXrlNotes.trl ?? null,
      brl: typeof input.xrl_notes_brl === "string" ? input.xrl_notes_brl : existingXrlNotes.brl ?? null,
      grl: typeof input.xrl_notes_grl === "string" ? input.xrl_notes_grl : existingXrlNotes.grl ?? null,
      srl: typeof input.xrl_notes_srl === "string" ? input.xrl_notes_srl : existingXrlNotes.srl ?? null,
      hrl: typeof input.xrl_notes_hrl === "string" ? input.xrl_notes_hrl : existingXrlNotes.hrl ?? null,
    };
    const merged: Record<string, unknown> = {
      project_id: projectId,
      evaluated_at: evaluated_at_iso,
      mu_a: typeof input.mu_A === "number" ? input.mu_A : existingRow?.mu_a ?? null,
      mu_i: typeof input.mu_I === "number" ? input.mu_I : existingRow?.mu_i ?? null,
      mu_g: typeof input.mu_G === "number" ? input.mu_G : existingRow?.mu_g ?? null,
      trl: typeof input.trl === "number" ? input.trl : existingRow?.trl ?? null,
      brl: typeof input.brl === "number" ? input.brl : existingRow?.brl ?? null,
      grl: typeof input.grl === "number" ? input.grl : existingRow?.grl ?? null,
      srl: typeof input.srl === "number" ? input.srl : existingRow?.srl ?? null,
      hrl: typeof input.hrl === "number" ? input.hrl : existingRow?.hrl ?? null,
      frl: typeof input.frl === "number" ? input.frl : existingRow?.frl ?? null,
      alq_self_awareness: typeof input.alq_self_awareness === "number" ? input.alq_self_awareness : existingRow?.alq_self_awareness ?? null,
      alq_relational_transparency: typeof input.alq_relational_transparency === "number" ? input.alq_relational_transparency : existingRow?.alq_relational_transparency ?? null,
      alq_balanced_processing: typeof input.alq_balanced_processing === "number" ? input.alq_balanced_processing : existingRow?.alq_balanced_processing ?? null,
      alq_internalized_moral: typeof input.alq_internalized_moral === "number" ? input.alq_internalized_moral : existingRow?.alq_internalized_moral ?? null,
      frl_grit: typeof input.frl_grit === "number" ? input.frl_grit : existingRow?.frl_grit ?? null,
      frl_resilience: typeof input.frl_resilience === "number" ? input.frl_resilience : existingRow?.frl_resilience ?? null,
      frl_notes: typeof input.frl_notes === "string" ? input.frl_notes : existingRow?.frl_notes ?? null,
      prs_potential: typeof input.prs_potential === "number" ? input.prs_potential : existingRow?.prs_potential ?? null,
      prs_r_net: typeof input.prs_r_net === "number" ? input.prs_r_net : existingRow?.prs_r_net ?? null,
      mu_notes: muNotes,
      xrl_notes: xrlNotes,
      shallow_tech_mode: typeof input.shallow_tech_mode === "boolean" ? input.shallow_tech_mode : existingRow?.shallow_tech_mode ?? false,
      notes: typeof input.notes === "string" ? input.notes : existingRow?.notes ?? null,
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

  // ログイン中ユーザーの code_name と role を取得 (つくよみ system prompt 用)
  // requireAuth が落ちても DEV_MODE 等で fallback できるようにエラー時は「ユーザー」「メンバー」
  let userName = "ユーザー";
  let userRole = "メンバー";
  try {
    const auth = await (await import("@/lib/supabase/server")).createClient();
    const { data: { user } } = await auth.auth.getUser();
    const email = user?.email?.toLowerCase();
    if (email) {
      const { data: member } = await supabase
        .from("members")
        .select("code_name, is_admin")
        .eq("email", email)
        .maybeSingle();
      if (member?.code_name) userName = member.code_name;
      if (member?.is_admin) userRole = "admin (CEO/COO 等)";
    }
  } catch {
    // 認証取得失敗は致命ではないので silent (fallback 値を使う)
  }

  let contextBlock = "";
  if (body.project_id) {
    const ctx = await loadProjectContext(supabase, body.project_id);
    if (ctx) {
      contextBlock = `\n# 画面に表示されている PJ コックピットの全 context (${body.project_id})\n${JSON.stringify(ctx, null, 2)}\n`;
    }
  }

  // /vcs/[uuid] / /vcs/[uuid]/edit の場合は VC context を載せる
  const vcMatch = (body.page_path ?? "").match(/^\/vcs\/([0-9a-f-]{36})/i);
  if (vcMatch) {
    const vcCtx = await loadVcContext(supabase, vcMatch[1]);
    if (vcCtx) {
      contextBlock += `\n# 画面に表示されている VC の全 context\n${JSON.stringify(vcCtx, null, 2)}\n`;
    }
  }

  // AGENTS.common.md ルール: プロンプトはコードに書かず DB 必須。hardcoded fallback は廃止 (2026-05-11)。
  // llm_prompts (prompt_key='tsukuyomi.system', is_active=TRUE) が必須。空なら 500 を返す。
  let promptBody: string | null = null;
  try {
    const { data: pRow } = await supabase
      .from("llm_prompts")
      .select("body")
      .eq("prompt_key", "tsukuyomi.system")
      .eq("is_active", true)
      .maybeSingle();
    if (pRow && (pRow as { body: string }).body && (pRow as { body: string }).body.trim().length > 0) {
      promptBody = (pRow as { body: string }).body
        .replace(/\$\{userName\}/g, userName)
        .replace(/\$\{userRole\}/g, userRole);
    }
  } catch (e) {
    console.error("[tsukuyomi/chat] llm_prompts fetch failed:", e);
  }
  if (!promptBody) {
    return NextResponse.json({
      error: "missing llm_prompts.tsukuyomi.system (is_active=TRUE) — /admin/prompts で body を入れて activate して",
    }, { status: 500 });
  }
  const fullSystem = promptBody + contextBlock;

  // 直近のユーザー発話を保存 (添付ファイル名は content 末尾に付記)
  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  if (lastUser) {
    const attachLine = lastUser.attachments && lastUser.attachments.length > 0
      ? "\n\n[添付: " + lastUser.attachments.map((a) => `${a.name} (${a.mediaType})`).join(", ") + "]"
      : "";
    await supabase.from("tsukuyomi_chat_logs").insert({
      project_id: body.project_id ?? null,
      session_id: body.session_id,
      page_path: body.page_path ?? null,
      role: "user",
      content: lastUser.content + attachLine,
    });
  }

  const anthropic = new Anthropic({ apiKey });
  // user メッセージで attachments があれば content を array (text + image/document blocks) に変換
  const conversation: Anthropic.Messages.MessageParam[] = body.messages.map((m) => {
    if (m.role === "user" && m.attachments && m.attachments.length > 0) {
      const blocks: Anthropic.Messages.ContentBlockParam[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const a of m.attachments) {
        const b = attachmentToContentBlock(a);
        if (b) blocks.push(b);
      }
      return { role: m.role, content: blocks };
    }
    return { role: m.role, content: m.content };
  });

  // tool ループ (最大 5 ラウンド)
  const applied: ApplyAction[] = [];
  let lastReply = "";
  // 累積 token usage (1 ターンの合計、tsukuyomi_usage_log に書き込み)
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;
  const usedModel = "claude-opus-4-7";

  for (let round = 0; round < 5; round += 1) {
    let r: Anthropic.Messages.Message;
    try {
      r = await anthropic.messages.create({
        // まさ要望 2026-05-11: Opus 4.7、max_tokens 制限を 2000 → 16000 に拡大。
        model: usedModel,
        max_tokens: 16000,
        system: fullSystem,
        messages: conversation,
        tools: TOOLS,
      });
    } catch (e) {
      console.error("[tsukuyomi/chat] anthropic error", e);
      return NextResponse.json({ error: "llm error", detail: String(e) }, { status: 500 });
    }

    // usage 集計 (各ラウンド毎)
    if (r.usage) {
      totalInputTokens += r.usage.input_tokens ?? 0;
      totalOutputTokens += r.usage.output_tokens ?? 0;
      // cache 系は SDK 型が optional なので安全に取り出す
      const u = r.usage as unknown as {
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
      totalCacheReadTokens += u.cache_read_input_tokens ?? 0;
      totalCacheWriteTokens += u.cache_creation_input_tokens ?? 0;
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

  // 累積 token usage を tsukuyomi_usage_log に書き込み (= weekly 累積コスト計算用)。
  // 価格 (2026-05 時点、Anthropic 公開): Opus input $15/MTok, output $75/MTok,
  //   cache_read $1.5/MTok, cache_write $18.75/MTok。USD→JPY は 150 を default。
  try {
    const USD_PER_INPUT_MTOK = 15;
    const USD_PER_OUTPUT_MTOK = 75;
    const USD_PER_CACHE_READ_MTOK = 1.5;
    const USD_PER_CACHE_WRITE_MTOK = 18.75;
    const JPY_PER_USD = 150;
    const costUsd =
      (totalInputTokens / 1_000_000) * USD_PER_INPUT_MTOK +
      (totalOutputTokens / 1_000_000) * USD_PER_OUTPUT_MTOK +
      (totalCacheReadTokens / 1_000_000) * USD_PER_CACHE_READ_MTOK +
      (totalCacheWriteTokens / 1_000_000) * USD_PER_CACHE_WRITE_MTOK;
    const costJpy = costUsd * JPY_PER_USD;
    await supabase.from("tsukuyomi_usage_log").insert({
      session_id: body.session_id ?? null,
      model: usedModel,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      cache_read_tokens: totalCacheReadTokens,
      cache_write_tokens: totalCacheWriteTokens,
      cost_usd: Math.round(costUsd * 10000) / 10000,
      cost_jpy: Math.round(costJpy * 100) / 100,
    });
  } catch (e) {
    console.warn("[tsukuyomi/chat] usage log insert failed:", e);
  }

  return NextResponse.json({
    reply: lastReply || "(返事を組み立てられませんでした)",
    applied: applied.length > 0 ? applied : undefined,
  });
}
