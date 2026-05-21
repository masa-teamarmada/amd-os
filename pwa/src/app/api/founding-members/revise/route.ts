import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

const ALLOWED_ROLES = new Set(["ceo_candidate", "co_founder", "tech_lead", "researcher"]);
const ALLOWED_CATEGORIES = new Set(["amd", "university", "individual", "unknown"]);
const EXCLUDED_ROLES = new Set(["investor", "partner", "business_advisor", "amd_support", "unknown"]);
const EXCLUDED_CATEGORIES = new Set(["vc", "partner_company", "government"]);
const CORE_ROLE_VALUES = ["ceo_candidate", "co_founder", "tech_lead", "researcher"] as const;
const CORE_CATEGORY_VALUES = ["amd", "university", "individual", "unknown"] as const;

interface FoundingMemberSnapshot {
  id: string;
  person_name: string;
  affiliation: string | null;
  role: string | null;
  role_label_jp: string | null;
  category: string | null;
  responsibility: string | null;
  contribution: string | null;
  notes: string | null;
  status: string | null;
}

interface FoundingUpsert {
  personName: string;
  affiliation?: string | null;
  role: string;
  roleLabelJp?: string | null;
  category: string;
  responsibility?: string | null;
  contribution?: string | null;
  status?: "active" | "left" | "tentative";
  reason?: string | null;
}

interface FoundingInvalidate {
  personName: string;
  reason?: string | null;
}

interface FoundingProposal {
  summary: string;
  upserts: FoundingUpsert[];
  invalidates: FoundingInvalidate[];
  skipped?: Array<{ personName?: string | null; reason: string }>;
}

function normalizeRole(value: unknown) {
  const role = String(value || "").trim();
  return ALLOWED_ROLES.has(role) ? role : "researcher";
}

function normalizeCategory(value: unknown) {
  const category = String(value || "").trim();
  return ALLOWED_CATEGORIES.has(category) ? category : "unknown";
}

function normalizeName(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isFounderCore(upsert: FoundingUpsert) {
  if (!upsert.personName.trim()) return false;
  if (EXCLUDED_ROLES.has(upsert.role) || EXCLUDED_CATEGORIES.has(upsert.category)) return false;
  if (["ceo_candidate", "co_founder", "tech_lead"].includes(upsert.role)) return true;
  const blob = [
    upsert.personName,
    upsert.affiliation,
    upsert.roleLabelJp,
    upsert.responsibility,
    upsert.contribution,
    upsert.reason,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /pi|principal investigator|研究代表|代表研究者|発明者|技術シーズ|シーズ保有|創業|共同創業|特許|知財|cto|技術責任者/.test(blob);
}

function proposalFromUnknown(value: unknown): FoundingProposal {
  const obj = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawUpserts = Array.isArray(obj.upserts) ? obj.upserts : [];
  const rawInvalidates = Array.isArray(obj.invalidates) ? obj.invalidates : [];
  const skipped: Array<{ personName?: string | null; reason: string }> = [];

  const upserts = rawUpserts.map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const candidate: FoundingUpsert = {
      personName: normalizeName(row.personName ?? row.person_name),
      affiliation: row.affiliation == null ? null : String(row.affiliation),
      role: normalizeRole(row.role),
      roleLabelJp: row.roleLabelJp == null && row.role_label_jp == null ? null : String(row.roleLabelJp ?? row.role_label_jp),
      category: normalizeCategory(row.category),
      responsibility: row.responsibility == null ? null : String(row.responsibility),
      contribution: row.contribution == null ? null : String(row.contribution),
      status: row.status === "left" || row.status === "tentative" ? row.status : "active",
      reason: row.reason == null ? null : String(row.reason),
    };
    if (!isFounderCore(candidate)) {
      skipped.push({ personName: candidate.personName || null, reason: "創業コアではないため除外" });
      return null;
    }
    return candidate;
  }).filter((row): row is FoundingUpsert => !!row);

  const invalidates = rawInvalidates.map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      personName: normalizeName(row.personName ?? row.person_name),
      reason: row.reason == null ? null : String(row.reason),
    };
  }).filter((row) => row.personName);

  return {
    summary: String(obj.summary || "創業メンバー修正案"),
    upserts,
    invalidates,
    skipped: [...(Array.isArray(obj.skipped) ? obj.skipped.map((s) => ({ reason: String((s as Record<string, unknown>)?.reason || s) })) : []), ...skipped],
  };
}

function parseJsonObject(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("つくよみからJSONが返らなかった");
  return JSON.parse(match[0]) as unknown;
}

async function buildProposal(input: {
  projectId: string;
  projectName: string;
  instruction: string;
  currentRows: FoundingMemberSnapshot[];
}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      summary: "ANTHROPIC_API_KEY がないため提案を生成できない",
      upserts: [],
      invalidates: [],
      skipped: [{ reason: "ANTHROPIC_API_KEY missing" }],
    };
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const currentJson = JSON.stringify(input.currentRows.map((r) => ({
    personName: r.person_name,
    affiliation: r.affiliation,
    role: r.role,
    roleLabelJp: r.role_label_jp,
    category: r.category,
    responsibility: r.responsibility,
    contribution: r.contribution,
    status: r.status,
  })), null, 2);

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1800,
    temperature: 0.1,
    system: [
      "あなたはAMD OSのアシスタントAI「つくよみ」。PJの創業メンバー台帳を、PMの指示に従って安全に修正する。",
      "創業メンバーは創業者 / CEO候補 / 共同創業者 / CTO候補 / 技術創業者 / PI / 研究代表 / 発明者 / 技術シーズ保有者だけ。",
      "VC、投資家、協業先、顧客候補、行政、補助金担当、単なるadvisor、紹介者、同席者、AMDサポートだけの人物は創業メンバーに入れない。",
      "迷う人物は invalidates ではなく skipped に理由を書き、upserts には入れない。",
      "返答はJSONだけ。",
    ].join("\n"),
    messages: [{
      role: "user",
      content: [
        `PJ: ${input.projectName} (${input.projectId})`,
        "",
        "現在の創業メンバー:",
        currentJson,
        "",
        "PMからの修正指示:",
        input.instruction,
        "",
        "返答形式:",
        JSON.stringify({
          summary: "何を直す案か1文",
          upserts: [{
            personName: "氏名",
            affiliation: "所属 or null",
            role: CORE_ROLE_VALUES.join("|"),
            roleLabelJp: "日本語役割",
            category: CORE_CATEGORY_VALUES.join("|"),
            responsibility: "担当",
            contribution: "根拠",
            status: "active|left|tentative",
            reason: "なぜ創業コアか",
          }],
          invalidates: [{ personName: "除外する既存氏名", reason: "除外理由" }],
          skipped: [{ personName: "判断対象氏名", reason: "反映しない理由" }],
        }),
      ].join("\n"),
    }],
  });

  const text = msg.content.map((part) => part.type === "text" ? part.text : "").join("").trim();
  return proposalFromUnknown(parseJsonObject(text));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: { projectId?: string; instruction?: string; mode?: string; proposal?: FoundingProposal };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "invalid JSON" }, { status: 400 });
  }

  const projectId = String(body.projectId || "").trim();
  const instruction = String(body.instruction || "").trim();
  const mode = body.mode === "apply" ? "apply" : "preview";
  if (!projectId) return NextResponse.json({ ok: false, message: "projectId required" }, { status: 400 });
  if (!instruction && mode === "preview") return NextResponse.json({ ok: false, message: "instruction required" }, { status: 400 });

  const db = createAdminClient();
  const [{ data: project }, { data: currentRows, error: currentError }] = await Promise.all([
    db.from("projects").select("project_id, project_name").eq("project_id", projectId).maybeSingle(),
    db
      .from("project_founding_members")
      .select("id, person_name, affiliation, role, role_label_jp, category, responsibility, contribution, notes, status")
      .eq("project_id", projectId)
      .neq("status", "invalid")
      .order("updated_at", { ascending: false }),
  ]);
  if (currentError) return NextResponse.json({ ok: false, message: currentError.message }, { status: 500 });

  if (mode === "preview") {
    const proposal = await buildProposal({
      projectId,
      projectName: project?.project_name || projectId,
      instruction,
      currentRows: (currentRows || []) as FoundingMemberSnapshot[],
    });
    return NextResponse.json({ ok: true, proposal });
  }

  const proposal = proposalFromUnknown(body.proposal);
  const now = new Date().toISOString();
  const nameToRow = new Map(((currentRows || []) as FoundingMemberSnapshot[]).map((r) => [r.person_name, r]));
  let upserted = 0;
  let invalidated = 0;

  for (const row of proposal.upserts) {
    const existing = nameToRow.get(row.personName);
    const payload: Record<string, unknown> = {
      project_id: projectId,
      person_name: row.personName,
      affiliation: row.affiliation ?? null,
      role: row.role,
      role_label_jp: row.roleLabelJp ?? null,
      category: row.category,
      responsibility: row.responsibility ?? null,
      contribution: row.contribution ?? null,
      notes: row.reason ? `つくよみ編集: ${row.reason}` : `つくよみ編集: ${proposal.summary}`,
      status: row.status ?? "active",
      extracted_by: "tsukuyomi",
      source_documents: [{ type: "tsukuyomi_instruction", id: now, instruction }],
      last_observed_at: now.slice(0, 10),
      updated_at: now,
    };
    if (!existing) {
      payload.first_observed_at = now.slice(0, 10);
      payload.created_at = now;
    }
    const { error } = await db.from("project_founding_members").upsert(payload, { onConflict: "project_id,person_name" });
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    upserted++;
  }

  for (const row of proposal.invalidates) {
    const existing = nameToRow.get(row.personName);
    if (!existing) continue;
    const { error } = await db
      .from("project_founding_members")
      .update({
        status: "invalid",
        notes: row.reason ? `つくよみ編集で除外: ${row.reason}` : `つくよみ編集で除外: ${proposal.summary}`,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    invalidated++;
  }

  await db.from("tsukuyomi_learnings").insert({
    scope: "founding_members",
    scope_key: projectId,
    content: `${proposal.summary} / upsert=${upserted}, invalid=${invalidated}`,
    source: "founding_members_revision",
    source_ref: projectId,
    created_by: auth.user.email,
  });

  return NextResponse.json({ ok: true, upserted, invalidated, proposal });
}
