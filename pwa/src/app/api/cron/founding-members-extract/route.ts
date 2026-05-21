/**
 * Related Members Extract cron — PJ の関連メンバーを LLM で抽出。
 *
 * まさ判断 (2026-05-22): HRL 根拠 = 「該当SU 社員 + AMD 伴走メンバー」だけ。
 *   大学・研究機関の PI / 共同研究者 / 特許保有者、VC、顧客、行政、partner_company は除外。
 *   AMD メンバーは `members.code_name` で表記 (フルネーム / 姓のみ表記禁止 = 重複防止)。
 *
 * 入力 (PJ ごと):
 *   - monthly_reports.draft_content (直近 6 ヶ月)
 *   - project_meeting_summaries (直近 3 ヶ月)
 *   - project_knowledge (直近 6 ヶ月)
 *   - project_ventures.origin_org / origin_pi / display_name
 *   - 既存 project_founding_members (重複防止)
 *   - members.code_name (alias map)
 *
 * 出力: 関連メンバーリスト (Anthropic Sonnet 4.5 で JSON 抽出)
 *   [{ person_name, affiliation, role, category, responsibility, contribution, evidence }]
 *
 * 既存 (project_id, person_name) UNIQUE で upsert。新規追加 / 変更があれば
 * l2_notifications に kind='founding_members' で投入。
 *
 * Bearer ${CRON_SECRET} 認証。
 *   - GET /api/cron/founding-members-extract: 全 PJ をループ
 *   - GET /api/cron/founding-members-extract?project_id=p09: 単一 PJ
 *
 * projects.project_category='ecosystem' は AMD Score / HRL 根拠の対象外なので除外する。
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
  "startup",
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

interface AmdMemberRow {
  member_id: string;
  code_name: string;
  member_name: string | null;
}

const PROMPT_REV = "v3_2026-05-22_related_members_su_plus_amd";

// HRL 根拠から外すカテゴリ (= 該当SU + AMD 以外)
const HRL_EXCLUDED_CATEGORIES = new Set([
  "university",
  "vc",
  "partner_company",
  "government",
  "individual",
]);
// HRL 根拠から外す役割
const HRL_EXCLUDED_ROLES = new Set(["investor", "partner"]);

function normalizeRole(s: string): string {
  const lower = (s ?? "").toLowerCase().trim();
  return (ROLE_VALUES as readonly string[]).includes(lower) ? lower : "unknown";
}
function normalizeCategory(s: string): string {
  const lower = (s ?? "").toLowerCase().trim();
  return (CATEGORY_VALUES as readonly string[]).includes(lower) ? lower : "unknown";
}

function buildAmdNameAliasMap(rows: AmdMemberRow[]): Map<string, string> {
  // alias (= 表記揺れ) → code_name
  const map = new Map<string, string>();
  for (const m of rows) {
    if (!m.code_name) continue;
    map.set(m.code_name, m.code_name);
    if (m.member_name) {
      const full = m.member_name.trim();
      if (full) {
        map.set(full, m.code_name);
        map.set(full.replace(/\s+/g, ""), m.code_name);
        // 姓だけ表記 (e.g. "山地 正洋" → "山地")
        const surname = full.split(/\s+/)[0];
        if (surname && surname !== m.code_name) {
          map.set(surname, m.code_name);
        }
      }
    }
  }
  return map;
}

function normalizePersonName(name: string, aliasMap: Map<string, string>): string {
  const trimmed = (name ?? "").trim();
  return aliasMap.get(trimmed) ?? aliasMap.get(trimmed.replace(/\s+/g, "")) ?? trimmed;
}

/**
 * 関連メンバー判定: HRL 根拠 = 該当SU + AMD のみ。
 * AMD code_name に一致したものは category='amd' に強制、それ以外は category='startup' (該当SU社員) に強制。
 */
function classifyMember(
  m: LlmPerson,
  aliasMap: Map<string, string>
): { ok: boolean; person_name: string; role: string; category: string; reason?: string } {
  const normalizedName = normalizePersonName(m.person_name, aliasMap);
  const role = normalizeRole(m.role);
  const rawCategory = normalizeCategory(m.category);
  const isAmd = aliasMap.has(m.person_name.trim()) || aliasMap.has(m.person_name.trim().replace(/\s+/g, ""));

  if (HRL_EXCLUDED_ROLES.has(role)) {
    return { ok: false, person_name: normalizedName, role, category: rawCategory, reason: "role=investor/partner はHRL根拠外" };
  }
  if (HRL_EXCLUDED_CATEGORIES.has(rawCategory) && !isAmd) {
    return { ok: false, person_name: normalizedName, role, category: rawCategory, reason: `category=${rawCategory} はHRL根拠外 (該当SU+AMD以外)` };
  }
  // category を強制
  const category = isAmd ? "amd" : rawCategory === "amd" ? "startup" : rawCategory === "unknown" ? "startup" : "startup";
  return { ok: true, person_name: normalizedName, role, category };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DBClient = any;

async function extractForProject(
  db: DBClient,
  anthropic: Anthropic,
  project: { project_id: string; display_name: string; origin_org: string | null; origin_pi: string | null },
  amdMembers: AmdMemberRow[]
): Promise<{ projectId: string; saved: number; skipped: number; total: number; error?: string }> {
  const projectId = project.project_id;
  const aliasMap = buildAmdNameAliasMap(amdMembers);

  // 1. 既存メンバー fetch
  const { data: existing } = await db
    .from("project_founding_members")
    .select("id, person_name, role, category, status, source_documents")
    .eq("project_id", projectId);
  const existingByName = new Map<string, { id: string; person_name: string; role: string | null; category: string; status: string | null }>();
  for (const e of (existing ?? []) as { id: string; person_name: string; role: string; category: string; status: string | null; source_documents: unknown }[]) {
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
  const amdCodeNames = amdMembers.map((m) => m.code_name).filter(Boolean).join(" / ");
  const amdAliasLines = amdMembers
    .map((m) => `  - ${m.code_name}${m.member_name ? ` (本名: ${m.member_name})` : ""}`)
    .join("\n");

  const prompt = `あなたは Deep-Tech ベンチャースタジオ AMD のアナリストです。
PJ「${project.display_name}」(project_id=${projectId}) の **関連メンバー** を抽出してください。

# 関連メンバーの定義 (まさ判断 2026-05-22)
このリストは HRL (Human Resources Readiness Level) の評価ベースです。
含めるのは「**該当SUの社員 + AMDの伴走メンバー**」だけ。それ以外は除外する。

## 含める
- 該当SUの代表 / CEO / CTO / 経営メンバー / 社員 / 社員候補 / 創業候補 (category=startup)
- AMD 側でこのPJを伴走しているメンバー (category=amd)
  - CEO 候補 / 共同創業者 / 技術リードとして入っていても、AMD 所属のままなら category=amd

## 除外する (一切入れない)
- 大学 / 研究機関の PI / 研究代表 / 共同研究者 / 発明者 / 特許保有者 (= category=university)
- VC / ファンド / 投資家 / 出資検討者 (= category=vc)
- 産業パートナー / 顧客 / サプライヤー / 委託先 (= category=partner_company)
- 補助金 / 行政 / 支援機関 / 採択担当 (= category=government)
- ちょっと相談した人 / 同席者 / 紹介者 / 窓口

迷ったら **除外** してください。

# AMD メンバー (alias 解決リスト — 必ずこの code_name で出力)
${amdAliasLines}

抽出時は本名 / 姓のみ / フルネーム連結 で見つけた場合も必ず **code_name 1 つに集約** する。
例: 「山地正洋」「山地 正洋」「山地」→ "まさ" / 「梅本隆司」「梅本」→ "うめ" / 「肥塚」「肥塚 恭子」→ "きよ"
AMD code_name (${amdCodeNames}) と一致した person は **category="amd"** にする。

# SU 社員 / 創業候補
AMD code_name に該当しない人物で、該当SUの社員 / 社員候補 / 創業候補は **category="startup"** にする。
affiliation には SU 名 (例: "JOYCLE", "CryoX") を入れる。AMD と SU の二重表記 ("JOYCLE / AMD") は避ける。

# 既知の文脈
- display_name (SU 名): ${project.display_name}
- origin_org: ${project.origin_org ?? "(不明)"}
- origin_pi: ${project.origin_pi ?? "(不明)"}
- 既知メンバー (このリストに無い人物が見つかったら新規追加、ある人物は同じ person_name で返す): ${existingNames}

# ソースドキュメント (${docs.length} 件)
${docsBlock.slice(0, 60000)}

# 抽出ルール
1. 文中で **明示的に名前が挙がっている人物のみ** を抽出 (推測で勝手に追加しない)
2. 同一人物の別表記は AMD は code_name に、SU 社員は最も具体的な name に **代表 1 つ** に統一
3. 既知メンバーと同一人物なら同じ person_name で返す
4. 役割・所属が文中に書かれていなければ role='unknown' / category='startup' (= 該当SU社員と仮定)
5. 「あの人」「彼」のような曖昧な代名詞だけの言及は **除外**
6. 大学・研究機関 / VC / 協業先 / 顧客 / 行政 / 補助金担当は、名前が明示されていても **除外**

# 役割 (role) の値
- ceo_candidate: CEO/代表 候補
- co_founder: 共同創業者
- tech_lead: 技術リード (CTO 候補 / リード研究者)
- business_advisor: 事業アドバイザ
- amd_support: AMD のサポート担当 (PL/PM/closer 等)
- researcher: 研究者 (PI 以外、技術メンバー)
- unknown: 不明

# カテゴリ (category) の値
- amd: AMD の伴走メンバー (= AMD code_name に該当する人物)
- startup: 該当SUの社員 / 創業候補
- unknown: 役割不明だが該当SUか伴走か判別不能 (= 暫定保存、後で再分類)

# 出力フォーマット (JSON、preamble・コードフェンス禁止)
{
  "members": [
    {
      "person_name": "string (AMD は code_name 必須)",
      "affiliation": "string or null (SU 名 / 'AMD' / '不明')",
      "role": "上記 role enum のいずれか",
      "role_label_jp": "string or null",
      "category": "amd | startup | unknown",
      "responsibility": "string or null",
      "contribution": "string or null",
      "evidence": "string (どのドキュメントのどこに書いてあったかの抜粋、80 字以内)",
      "status": "active|left|tentative"
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

  // 保存前 filter: classifyMember で HRL根拠外を reject + person_name を AMD alias で正規化
  const dedupByName = new Map<string, { src: LlmPerson; role: string; category: string }>();
  for (const raw of parsed.members ?? []) {
    if (!raw.person_name || raw.person_name.length < 1 || raw.person_name.length > 80) continue;
    const cls = classifyMember(raw, aliasMap);
    if (!cls.ok) continue;
    // 同一人物の重複は最初のを残す (LLM 側でも集約指示済み)
    if (dedupByName.has(cls.person_name)) continue;
    dedupByName.set(cls.person_name, { src: { ...raw, person_name: cls.person_name }, role: cls.role, category: cls.category });
  }
  const acceptedMembers = Array.from(dedupByName.values());

  // 4. upsert + diff 検出
  const today = new Date().toISOString().slice(0, 10);
  const sourceDocs = docs.slice(0, 60).map((d) => ({ type: d.type, id: d.id, ymOrDate: d.ymOrDate }));

  let saved = 0;
  let skipped = 0;
  const newOrChanged: string[] = [];

  for (const item of acceptedMembers) {
    const { src: m, role, category } = item;
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
      // 通知の「はい」で active 化されるまで tentative。既存 active で role/category 不変なら維持。
      status:
        existingRow?.status === "active" && existingRow.role === role && existingRow.category === category
          ? "active"
          : "tentative",
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
    }

    const { error } = await db.from("project_founding_members").upsert(payload, {
      onConflict: "project_id,person_name",
      ignoreDuplicates: false,
    });
    if (error) {
      console.error("[related-members-extract] upsert error", error);
      skipped++;
    } else {
      saved++;
    }
  }

  // 5. 通知 (新規 or 役割変更があれば)
  if (newOrChanged.length > 0) {
    const summary = newOrChanged.slice(0, 8).join(" / ");
    await db.from("l2_notifications").upsert(
      {
        l2_kind: "founding_members",
        target_id: projectId,
        scope_key: today,
        title: `📋 ${project.display_name} 関連メンバー更新 (${newOrChanged.length} 件)`,
        summary,
        saved_count: newOrChanged.length,
        total_count: acceptedMembers.length,
        importance: 1,
      },
      { onConflict: "l2_kind,target_id,scope_key" }
    );
  }

  return { projectId, saved, skipped, total: acceptedMembers.length };
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

  // AMD members の alias map を 1 回だけ取得して全 PJ で再利用
  const { data: amdMembersRaw } = await db
    .from("members")
    .select("member_id, code_name, member_name")
    .eq("status", "active");
  const amdMembers = ((amdMembersRaw ?? []) as AmdMemberRow[]).filter((m) => m.code_name);

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

  const projectsRaw = (ventures ?? []) as {
    project_id: string;
    display_name: string;
    origin_org: string | null;
    origin_pi: string | null;
  }[];

  if (projectsRaw.length === 0) {
    return NextResponse.json({ error: "no target projects" }, { status: 404 });
  }

  const projectIds = [...new Set(projectsRaw.map((project) => project.project_id))];
  const { data: projectRows, error: projectError } = await db
    .from("projects")
    .select("project_id, project_category")
    .in("project_id", projectIds);
  if (projectError) {
    return NextResponse.json({ error: "fetch project categories failed", detail: projectError.message }, { status: 500 });
  }
  const categoryByProject = new Map(
    ((projectRows ?? []) as Array<{ project_id: string; project_category: string | null }>).map((row) => [
      row.project_id,
      row.project_category || "dtsu",
    ])
  );
  const skippedEcosystem = projectsRaw.filter((project) => categoryByProject.get(project.project_id) === "ecosystem");
  const projects = projectsRaw.filter((project) => categoryByProject.get(project.project_id) !== "ecosystem");

  const results: Awaited<ReturnType<typeof extractForProject>>[] = [];
  for (const p of skippedEcosystem) {
    results.push({ projectId: p.project_id, saved: 0, skipped: 0, total: 0, error: "skipped: ecosystem project" });
  }
  for (const p of projects) {
    try {
      const r = await extractForProject(db, anthropic, p, amdMembers);
      results.push(r);
    } catch (e) {
      results.push({ projectId: p.project_id, saved: 0, skipped: 0, total: 0, error: String(e) });
    }
  }

  const totalSaved = results.reduce((s, r) => s + r.saved, 0);
  const totalProjects = results.length;

  return NextResponse.json({
    ok: true,
    total_projects: totalProjects,
    total_saved: totalSaved,
    skipped_ecosystem: skippedEcosystem.length,
    prompt_rev: PROMPT_REV,
    results,
  });
}
