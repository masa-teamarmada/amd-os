/**
 * /api/monthly-report/external-manual-update
 *
 * GET  ?projectId=&ym=  → 提出版本文を取得
 * POST { projectId, ym, content } → 提出版本文を直接保存
 *
 * 提出版の正本は monthly_reports_external.body_md。社内版の手動編集とは
 * 保存先も品質ゲートも分け、保存後に提出版PDFへ同じ本文が反映される。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";

const REQUIRED_SECTIONS = [
  "業務概要",
  "当月の実施内容",
  "体制および打合せ実施記録",
  "主要成果物",
  "来月以降の予定",
] as const;

type MemberIdentity = { code_name: string | null; member_name: string | null };
type JargonFinding = { word: string; label: string };

function toExternalYm(ym: string): string {
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function surnameOnly(memberName: string | null): string {
  const parts = (memberName || "").trim().split(/[\s　]+/).filter(Boolean);
  return parts.length >= 2 ? parts[0] : "担当者";
}

// 印刷表示と同じ原則で、氏名表記と e-Rad の表記ゆれを保存時に整える。
function normalizeSubmission(content: string, members: MemberIdentity[]): string {
  let normalized = content.replace(/eLAD/gi, "e-Rad");
  for (const member of members) {
    const memberName = (member.member_name || "").trim();
    if (memberName) normalized = normalized.split(memberName).join(surnameOnly(member.member_name));
    const codeName = (member.code_name || "").trim();
    if (codeName) {
      normalized = normalized.replace(new RegExp(`\\[${escapeRegExp(codeName)}\\](?=\\()`, "g"), surnameOnly(member.member_name));
    }
  }
  return normalized.trim();
}

function validateSubmission(content: string): string[] {
  const errors: string[] = [];
  if (!content) return ["対外月次業務報告書本文が空です"];

  if (!/^[\t ]*#[\t ]+月次業務報告書[\t ]*(?:\r?\n|$)/u.test(content)) {
    errors.push("先頭見出し「# 月次業務報告書」がありません");
  }
  for (const section of REQUIRED_SECTIONS) {
    const pattern = new RegExp(`^##\\s+\\d+(?:\\.\\d+)?[.．]?\\s*[^\\n]*${escapeRegExp(section)}[^\\n]*$`, "m");
    if (!pattern.test(content)) errors.push(`必須章「${section}」がありません`);
  }

  const h2Count = (content.match(/^##\s+/gm) || []).length;
  if (h2Count < 7) errors.push(`章数が不足しています (${h2Count}章、7章以上必要)`);
  const tableCount = (content.match(/^\|\s*[-:]+/gm) || []).length;
  if (tableCount < 3) errors.push(`表が不足しています (${tableCount}表、3表以上必要)`);
  if (content.length < 3000) errors.push(`本文が短すぎます (${content.length}文字、3000文字以上必要)`);
  if (!/以上のとおり報告する。\s*$/.test(content)) {
    errors.push("末尾が「以上のとおり報告する。」で終わっていません");
  }
  if (/^\s*(?:決定(?:\/確認)?|確認|次アクション)\s*[:：]/m.test(content)) {
    errors.push("生データのラベル行が残っています (報告文へ再構成してください)");
  }
  if (/。\s*,/.test(content)) errors.push("句点直後に ASCII カンマが連結しています");
  if (/(?:\.\.\.|…)/.test(content)) errors.push("省略記号が含まれています");
  return errors;
}

function findJargon(content: string, members: MemberIdentity[]): { hard: JargonFinding[]; soft: JargonFinding[] } {
  const hardPatterns: Array<[RegExp, string]> = [
    [/AMD\s*Score/giu, "AMD Score (内部評価指標名)"],
    [/L2\s*(件数|カウント|snapshot)/giu, "L2 メタデータ"],
    [/月次ルーティン|monthly[_-]?report[_-]?routine/giu, "内部ルーティン名"],
    [/確定済み証跡/gu, "内部プロセス文言"],
  ];
  const softPatterns: Array<[RegExp, string]> = [
    [/cockpit|コックピット/giu, "内部UI名称"],
    [/outbox/giu, "内部運用語"],
    [/プロンプト|LLM|Claude|Anthropic|Opus/giu, "内部実装語"],
  ];
  const collect = (patterns: Array<[RegExp, string]>): JargonFinding[] => patterns.flatMap(([pattern, label]) =>
    Array.from(content.matchAll(pattern), (match) => ({ word: match[0], label }))
  );
  const hard = collect(hardPatterns);
  const soft = collect(softPatterns);

  for (const member of members) {
    const codeName = (member.code_name || "").trim();
    if (!codeName) continue;
    const escaped = escapeRegExp(codeName);
    const pattern = new RegExp(
      `(?:\\[${escaped}\\](?=\\()|(?<![一-龥ぁ-んァ-ンA-Za-z0-9])${escaped}(?=(?:は|が|を|も|へ|から|より|[\\s、。・（(「『【）)」』】])))`,
      "gu"
    );
    hard.push(...Array.from(content.matchAll(pattern), (match) => ({ word: match[0], label: `code_name: ${codeName}` })));
  }
  return { hard, soft };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") || "";
  const ym = searchParams.get("ym") || "";
  if (!projectId || !/^\d{6}$/.test(ym)) {
    return NextResponse.json({ error: "projectId and ym (YYYYMM) required" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("monthly_reports_external")
    .select("body_md, generated_at, updated_at, jargon_check_status")
    .eq("project_id", projectId)
    .eq("ym", toExternalYm(ym))
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    report: data
      ? {
          bodyMd: data.body_md,
          generatedAt: data.generated_at,
          updatedAt: data.updated_at,
          jargonCheckStatus: data.jargon_check_status,
        }
      : null,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await req.json().catch(() => ({}));
  const projectId = String(body.projectId || "").trim();
  const ym = String(body.ym || "").trim();
  const content = typeof body.content === "string" ? body.content : "";
  if (!projectId || !/^\d{6}$/.test(ym)) {
    return NextResponse.json({ error: "projectId and ym (YYYYMM) required" }, { status: 400 });
  }

  const membersRes = await auth.supabase.from("members").select("code_name, member_name");
  if (membersRes.error) return NextResponse.json({ error: membersRes.error.message }, { status: 500 });
  const members = (membersRes.data || []) as MemberIdentity[];
  const normalized = normalizeSubmission(content, members);
  const validationErrors = validateSubmission(normalized);
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: validationErrors.join("\n"), errors: validationErrors }, { status: 422 });
  }

  const jargon = findJargon(normalized, members);
  if (jargon.hard.length > 0) {
    const errors = jargon.hard.map((finding) => `提出版に出せない表現があります: ${finding.word} (${finding.label})`);
    return NextResponse.json({ error: errors.join("\n"), errors }, { status: 422 });
  }

  const externalYm = toExternalYm(ym);
  const now = new Date().toISOString();
  const patch = {
    body_md: normalized,
    updated_at: now,
    jargon_check_status: jargon.soft.length > 0 ? "warning" : "clean",
    jargon_check_findings: jargon.soft,
  };
  const { data: existing, error: existingError } = await auth.supabase
    .from("monthly_reports_external")
    .select("id")
    .eq("project_id", projectId)
    .eq("ym", externalYm)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const result = existing
    ? await auth.supabase.from("monthly_reports_external").update(patch).eq("id", existing.id)
      .select("body_md, generated_at, updated_at, jargon_check_status").single()
    : await auth.supabase.from("monthly_reports_external").insert({
        project_id: projectId,
        ym: externalYm,
        generated_at: now,
        generated_by_model: "manual-edit",
        ...patch,
      }).select("body_md, generated_at, updated_at, jargon_check_status").single();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    report: {
      bodyMd: result.data.body_md,
      generatedAt: result.data.generated_at,
      updatedAt: result.data.updated_at,
      jargonCheckStatus: result.data.jargon_check_status,
    },
  });
}
