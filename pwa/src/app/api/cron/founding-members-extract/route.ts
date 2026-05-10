/**
 * Founding Members Extract cron — PJ 創業メンバーを LLM で抽出。
 *
 * 入力 (PJ ごと):
 *   - monthly_reports.draft_content (直近 6 ヶ月)
 *   - project_meeting_summaries (直近 3 ヶ月)
 *   - project_knowledge (直近 6 ヶ月)
 *   - project_ventures.origin_org / origin_pi / display_name (既知の創業者・出身組織)
 *   - 既存 project_founding_members (重複防止)
 *
 * 出力: 人物リスト (Anthropic Sonnet 4.5 で JSON 抽出)
 *   [{ person_name, affiliation, role, category, responsibility, contribution, evidence }]
 *
 * 既存 (project_id, person_name) UNIQUE で upsert。新規追加 / 変更があれば
 * l2_notifications に kind='founding_members' で投入 (Phase 1-E)。
 *
 * Bearer ${CRON_SECRET} 認証。
 *   - GET /api/cron/founding-members-extract: 全 PJ をループ (weekly cron)
 *   - GET /api/cron/founding-members-extract?project_id=p21: 単一 PJ
 *   - GET /api/cron/founding-members-extract?force=true: source_hash 無視で再抽出
 */

import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;
export const runtime = "nodejs";

const ROLE_VALUES = [
  "ceo_candidate",
  "co_founder",
  "tech_lead",
  "business_advisor",
  "investor",
  "amd_support",
  "researcher",
  "partner",
  "unknown",
] as const;

const CATEGORY_VALUES = [
  "amd",
  "university",
  "vc",
  "partner_company",
  "government",
  "individual",
  "unknown",
] as const;

interface LlmPerson {
  person_name: string;
  affiliation: string | null;
  role: string;
  role_label_jp: string | null;
  category: string;
  responsibility: string | null;
  contribution: string | null;
  evidence: string | null;
  status?: "active" | "left" | "tentative";
}

interface ExtractedDoc {
  type: "monthly_report" | "meeting_summary" | "project_knowledge";
  id: string;
  ymOrDate: string;
  text: string;
}

const PROMPT_REV = "v1_2026-05-10";

function normalizeRole(s: string): string {
  const lower = (s ?? "").toLowerCase().trim();
  return (ROLE_VALUES as readonly string[]).includes(lower) ? lower : "unknown";
}
function normalizeCategory(s: string): string {
  const lower = (s ?? "").toLowerCase().trim();
  return (CATEGORY_VALUES as readonly string[]).includes(lower) ? lower : "unknown";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DBClient = any;

async function extractForProject(
  db: DBClient,
  anthropic: Anthropic,
  project: { project_id: string; display_name: string; origin_org: string | null; origin_pi: string | null }
): Promise<{ projectId: string; saved: number; skipped: number; total: number; error?: string }> {
  const projectId = project.project_id;

  // 1. 既存メンバー fetch
  const { data: existing } = await db
    .from("project_founding_members")
    .select("id, person_name, role, category, source_documents")
    .eq("project_id", projectId);
  const existingByName = new Map<string, { id: string; person_name: string; role: string | null; category: string }>();
  for (const e of (existing ?? []) as { id: string; person_name: string; role: string; category: string; source_documents: unknown }[]) {
    existingByName.set(e.person_name, e);
  }

  // 2. ソースドキュメント fetch
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [reportsRes, meetingsRes, knowledgeRes] = await Promise.all([
    db
      .from("monthly_reports")
      .select("id, ym, draft_content, status")
      .eq("project_id", projectId)
      .neq("status", "invalid")
      .gte("generated_at", sixMonthsAgo)
      .order("generated_at", { ascending: false })
      .limit(6),
    db
      .from("project_meeting_summaries")
      .select("meeting_id, meeting_date, title, summary_short, decided, progress, next_actions, risks")
      .eq("project_id", projectId)
      .gte("meeting_date", threeMonthsAgo)
      .order("meeting_date", { ascending: false })
      .limit(20),
    db
      .from("project_knowledge")
      .select("id, ym, kind, text")
      .eq("project_id", projectId)
      .gte("created_at", sixMonthsAgo)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const docs: ExtractedDoc[] = [];
  for (const r of (reportsRes.data ?? []) as { id: string; ym: string; draft_content: string }[]) {
    if (r.draft_content) docs.push({ type: "monthly_report", id: r.id, ymOrDate: r.ym, text: r.draft_content });
  }
  for (const m of (meetingsRes.data ?? []) as { meeting_id: string; meeting_date: string; title: string; summary_short: string; decided: unknown; progress: unknown; next_actions: unknown; risks: unknown }[]) {
    const parts = [
      `# ${m.title} (${m.meeting_date})`,
      m.summary_short ? `要約: ${m.summary_short}` : "",
      `決定: ${JSON.stringify(m.decided)}`,
      `進捗: ${JSON.stringify(m.progress)}`,
      `次アクション: ${JSON.stringify(m.next_actions)}`,
      `リスク: ${JSON.stringify(m.risks)}`,
    ].filter(Boolean);
    docs.push({ type: "meeting_summary", id: m.meeting_id, ymOrDate: m.meeting_date, text: parts.join("\n") });
  }
  for (const k of (knowledgeRes.data ?? []) as { id: string; ym: string; kind: string; text: string }[]) {
    if (k.text) docs.push({ type: "project_knowledge", id: k.id, ymOrDate: k.ym, text: `[${k.kind}] ${k.text}` });
  }

  if (docs.length === 0) {
    return { projectId, saved: 0, skipped: 0, total: 0, error: "no source documents" };
  }

  // 3. LLM プロンプト組み立て
  const docsBlock = docs
    .slice(0, 60)
    .map((d, i) => `--- doc[${i}] type=${d.type} id=${d.id} date=${d.ymOrDate} ---\n${d.text.slice(0, 4000)}`)
    .join("\n\n");
  const existingNames = Array.from(existingByName.keys()).join(", ") || "(なし)";

  const prompt = `あなたは Deep-Tech ベンチャースタジオ AMD のアナリストです。
PJ「${project.display_name}」(project_id=${projectId}) の **創業メンバー** (社内外問わず、創業に関わる全員) を抽出してください。

# 創業メンバーの定義 (まさ判断 2026-05-10)
- AMD 内のメンバー (CEO 候補、co-founder、サポート担当 等)
- 大学・研究機関の PI / 共同研究者 (例: SX なら愛媛大学の杉浦先生・中島先生・石原先生)
- VC / ファンドのパートナー (例: PSI 推進機関のダイキアクシスベンチャーパートナーズ堀淵氏、パートナーズファンド種市氏・黒田氏)
- 産業パートナー / 出資検討先の担当者
- 政府・行政の担当者 (採択担当、伴走者)
- その他、PJ の意思決定や実務に深く関わる人物

= 「PJ を成立させるチーム全体」。AMD の社員に限定しない。

# 既知の文脈
- origin_org: ${project.origin_org ?? "(不明)"}
- origin_pi: ${project.origin_pi ?? "(不明)"}
- 既知メンバー (このリストに無い人物が見つかったら新規追加): ${existingNames}

# ソースドキュメント (${docs.length} 件)
${docsBlock.slice(0, 60000)}

# 抽出ルール
1. 文中で **明示的に名前が挙がっている人物のみ** を抽出 (推測で勝手に追加しない)
2. 同一人物の別表記 (山田氏 / Yamada / やまだ) は **代表的な 1 つ** に統一して person_name に
3. 既知メンバーと同一人物なら同じ person_name で返す (= 既存と突合できる形に)
4. 役割・所属が文中に書かれていなければ role='unknown' / category='unknown'
5. 「あの人」「彼」のような曖昧な代名詞だけの言及は **除外**
6. AMD 内の周辺スタッフ (経理、総務など PJ に直接関与しない) は除外

# 役割 (role) の値
- ceo_candidate: CEO/代表 候補
- co_founder: 共同創業者
- tech_lead: 技術リード (CTO 候補 / リード研究者)
- business_advisor: 事業アドバイザ
- investor: 投資家 / VC パートナー
- amd_support: AMD のサポート担当 (PL/PM/closer 等)
- researcher: 研究者 (PI 以外、技術メンバー)
- partner: 産業パートナー / 顧客候補
- unknown: 不明

# カテゴリ (category) の値
- amd: AMD のメンバー
- university: 大学・研究機関
- vc: VC / ファンド
- partner_company: 産業パートナー会社
- government: 政府・行政
- individual: 個人 (フリーランス等)
- unknown: 不明

# 出力フォーマット (JSON、preamble・コードフェンス禁止)
{
  "members": [
    {
      "person_name": "string",
      "affiliation": "string or null",
      "role": "上記 role enum のいずれか",
      "role_label_jp": "string or null (日本語ラベル例: 'CEO 候補', '技術アドバイザ')",
      "category": "上記 category enum のいずれか",
      "responsibility": "string or null (担当・責任範囲)",
      "contribution": "string or null (どう貢献するか / 過去貢献)",
      "evidence": "string (どのドキュメントのどこに書いてあったかの抜粋、80 字以内)",
      "status": "active|left|tentative (デフォルト active)"
    }
  ],
  "rationale": "PJ ごとの抽出概要 (1-2 文)"
}`;

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });
  const text = resp.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; text: string }).text)
    .join("\n")
    .trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { projectId, saved: 0, skipped: 0, total: 0, error: "LLM no JSON" };
  }
  let parsed: { members?: LlmPerson[]; rationale?: string };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return { projectId, saved: 0, skipped: 0, total: 0, error: `JSON parse: ${String(e)}` };
  }
  const members = (parsed.members ?? []).filter((m) => m.person_name && m.person_name.length >= 1 && m.person_name.length <= 80);

  // 4. upsert + diff 検出
  const today = new Date().toISOString().slice(0, 10);
  const sourceDocs = docs.slice(0, 60).map((d) => ({ type: d.type, id: d.id, ymOrDate: d.ymOrDate }));

  let saved = 0;
  let skipped = 0;
  const newOrChanged: string[] = [];

  for (const m of members) {
    const role = normalizeRole(m.role);
    const category = normalizeCategory(m.category);
    const existingRow = existingByName.get(m.person_name);

    const payload: Record<string, unknown> = {
      project_id: projectId,
      person_name: m.person_name,
      affiliation: m.affiliation ?? null,
      role,
      role_label_jp: m.role_label_jp ?? null,
      category,
      responsibility: m.responsibility ?? null,
      contribution: m.contribution ?? null,
      notes: m.evidence ?? null,
      status: m.status ?? "active",
      extracted_by: "llm",
      source_documents: sourceDocs,
      last_observed_at: today,
      updated_at: new Date().toISOString(),
    };
    if (!existingRow) {
      payload.first_observed_at = today;
      payload.created_at = new Date().toISOString();
      newOrChanged.push(`+ ${m.person_name} (${category}/${role})`);
    } else if (existingRow.role !== role || existingRow.category !== category) {
      newOrChanged.push(`~ ${m.person_name} (${category}/${role})`);
    } else {
      // 変化なし → last_observed_at だけ更新
    }

    const { error } = await db.from("project_founding_members").upsert(payload, {
      onConflict: "project_id,person_name",
      ignoreDuplicates: false,
    });
    if (error) {
      console.error("[founding-members-extract] upsert error", error);
      skipped++;
    } else {
      saved++;
    }
  }

  // 5. 通知 (新規 or 役割変更があれば)
  if (newOrChanged.length > 0) {
    const summary = newOrChanged.slice(0, 8).join(" / ");
    // l2_notifications: l2_kind / target_id / scope_key UNIQUE で upsert
    await db.from("l2_notifications").upsert(
      {
        l2_kind: "founding_members",
        target_id: projectId,
        scope_key: today,
        title: `📋 ${project.display_name} 創業メンバー更新 (${newOrChanged.length} 件)`,
        summary,
        saved_count: newOrChanged.length,
        total_count: members.length,
        importance: 1,
      },
      { onConflict: "l2_kind,target_id,scope_key" }
    );
  }

  return { projectId, saved, skipped, total: members.length };
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthroKey = process.env.ANTHROPIC_API_KEY;
  if (!url || !key || !anthroKey) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }
  const db = createClient(url, key);
  const anthropic = new Anthropic({ apiKey: anthroKey });

  // 対象 PJ を決定
  const targetPid = req.nextUrl.searchParams.get("project_id");
  const ventureQuery = db
    .from("project_ventures")
    .select("project_id, display_name, origin_org, origin_pi")
    .eq("is_public", true);
  if (targetPid) {
    ventureQuery.eq("project_id", targetPid);
  }
  const { data: ventures } = await ventureQuery.order("project_id", { ascending: true });

  const projects = (ventures ?? []) as {
    project_id: string;
    display_name: string;
    origin_org: string | null;
    origin_pi: string | null;
  }[];

  if (projects.length === 0) {
    return NextResponse.json({ error: "no target projects" }, { status: 404 });
  }

  const results: Awaited<ReturnType<typeof extractForProject>>[] = [];
  for (const p of projects) {
    try {
      const r = await extractForProject(db, anthropic, p);
      results.push(r);
    } catch (e) {
      results.push({ projectId: p.project_id, saved: 0, skipped: 0, total: 0, error: String(e) });
    }
  }

  const totalSaved = results.reduce((s, r) => s + r.saved, 0);
  const totalProjects = results.length;

  return NextResponse.json({ ok: true, total_projects: totalProjects, total_saved: totalSaved, prompt_rev: PROMPT_REV, results });
}
