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

type MemberIdentity = { code_name: string | null; member_name: string | null };
type JargonFinding = { word: string; label: string };
type ReportHeading = { normalized: string; index: number };
type ReportTable = { index: number; columns: string[]; rows: string[][]; section?: string | null };

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

function stripStandaloneHorizontalRules(content: string): string {
  return content
    .split(/\r?\n/u)
    .filter((line) => !/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/u.test(line))
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
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
  return stripStandaloneHorizontalRules(normalized);
}

function previousExternalYm(ym: string): string {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}

function normalizeStructureText(text: string): string {
  return text
    .replace(/\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/gu, "DATE")
    .replace(/\d{4}年\d{1,2}月\d{1,2}日/gu, "DATE")
    .replace(/\d{4}[\/\-]\d{1,2}/gu, "MONTH")
    .replace(/\d{4}年\d{1,2}月/gu, "MONTH")
    .replace(/\d{1,2}月\d{1,2}日/gu, "DATE")
    .replace(/\d{1,2}月/gu, "MONTH")
    .replace(/令和\d+年度/gu, "年度")
    .replace(/：/gu, ":")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeH2(text: string): string {
  const normalized = normalizeStructureText(text)
    .replace(/^(?:\d+(?:[.．]\d+)*[.．]?|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s*/u, "")
    .replace(/[（(][^）)]*[）)]\s*$/u, "")
    .trim();
  return /^その他活動(?::|$)/u.test(normalized) ? "その他活動" : normalized;
}

function extractH1(content: string): string {
  const match = /^[\t ]*#[\t ]+([^\n]+)$/mu.exec(content);
  return normalizeStructureText(match?.[1] || "");
}

function extractH2s(content: string): ReportHeading[] {
  return [...content.matchAll(/^##[\t ]+([^\n]+)$/gmu)].map((match) => ({
    normalized: normalizeH2(match[1]),
    index: match.index,
  }));
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function extractTables(content: string, headings: ReportHeading[]): ReportTable[] {
  const lines = content.split(/\r?\n/);
  const offsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1;
  }
  const tables: ReportTable[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const separators = splitTableRow(lines[i + 1]);
    if (!lines[i].includes("|") || separators.length === 0 || !separators.every((cell) => /^:?-{1,}:?$/.test(cell))) continue;
    const rows: string[][] = [];
    let j = i + 2;
    for (; j < lines.length && lines[j].includes("|"); j++) rows.push(splitTableRow(lines[j]));
    let section: string | null = null;
    for (const heading of headings) {
      if (heading.index < offsets[i]) section = heading.normalized;
      else break;
    }
    tables.push({ index: offsets[i], columns: splitTableRow(lines[i]), rows, section });
    i = j - 1;
  }
  return tables;
}

function sameSequence(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function fixedRowLabels(table: ReportTable | undefined): string[] {
  return (table?.rows || []).map((row) => normalizeStructureText(row[0] || "")).filter(Boolean);
}

function compareSubmissionStructure(content: string, reference: string): string[] {
  const errors: string[] = [];
  if (extractH1(content) !== extractH1(reference)) errors.push("表題(H1)が直前月提出版と異なります");

  const candidateHeadings = extractH2s(content);
  const referenceHeadings = extractH2s(reference);
  if (!sameSequence(candidateHeadings.map((item) => item.normalized), referenceHeadings.map((item) => item.normalized))) {
    errors.push("主要見出し(H2)の構成・順序が直前月提出版と異なります");
  }

  const candidateTables = extractTables(content, candidateHeadings);
  const referenceTables = extractTables(reference, referenceHeadings);
  if (candidateTables.length !== referenceTables.length) errors.push("表の数が直前月提出版と異なります");
  for (let i = 0; i < Math.min(candidateTables.length, referenceTables.length); i++) {
    const candidate = candidateTables[i];
    const previous = referenceTables[i];
    if ((candidate.section || "冒頭") !== (previous.section || "冒頭")) errors.push(`${i + 1}番目の表の所属章が直前月提出版と異なります`);
    if (!sameSequence(candidate.columns.map(normalizeStructureText), previous.columns.map(normalizeStructureText))) {
      errors.push(`${i + 1}番目の表の列構成が直前月提出版と異なります`);
    }
  }

  const candidateOpening = candidateTables.find((table) => !table.section);
  const referenceOpening = referenceTables.find((table) => !table.section);
  if (referenceOpening && !sameSequence(fixedRowLabels(candidateOpening), fixedRowLabels(referenceOpening))) {
    errors.push("冒頭項目表の固定行が直前月提出版と異なります");
  }

  const workTables = (tables: ReportTable[]) => tables.filter((table) => normalizeStructureText(table.columns[0] || "") === "業務項目");
  const candidateWorkTables = workTables(candidateTables);
  const referenceWorkTables = workTables(referenceTables);
  if (candidateWorkTables.length !== referenceWorkTables.length) errors.push("業務項目表の数が直前月提出版と異なります");
  for (let i = 0; i < Math.min(candidateWorkTables.length, referenceWorkTables.length); i++) {
    if (!sameSequence(fixedRowLabels(candidateWorkTables[i]), fixedRowLabels(referenceWorkTables[i]))) {
      errors.push(`${i + 1}番目の業務項目表の固定行が直前月提出版と異なります`);
    }
  }

  const tail = (value: string) => normalizeStructureText(value.trim().split(/\r?\n/).filter(Boolean).at(-1) || "");
  if (tail(content) !== tail(reference)) errors.push("末尾定型文が直前月提出版と異なります");
  return errors;
}

function validateSubmission(content: string, reference = "", allowFormatChange = false): string[] {
  const errors: string[] = [];
  if (!content) return ["対外月次業務報告書本文が空です"];

  if (!/^[\t ]*#[\t ]+月次業務報告書[\t ]*(?:\r?\n|$)/u.test(content)) {
    errors.push("先頭見出し「# 月次業務報告書」がありません");
  }
  const h2Count = (content.match(/^##\s+/gm) || []).length;
  if (h2Count < 2) errors.push(`章数が不足しています (${h2Count}章、2章以上必要)`);
  const tableCount = (content.match(/^\|\s*[-:]+/gm) || []).length;
  if (tableCount < 1) errors.push(`表が不足しています (${tableCount}表、1表以上必要)`);
  if (content.length < 3000) errors.push(`本文が短すぎます (${content.length}文字、3000文字以上必要)`);
  if (!/以上のとおり報告する。\s*$/.test(content)) {
    errors.push("末尾が「以上のとおり報告する。」で終わっていません");
  }
  if (/^\s*(?:決定(?:\/確認)?|確認|次アクション)\s*[:：]/m.test(content)) {
    errors.push("生データのラベル行が残っています (報告文へ再構成してください)");
  }
  if (/。\s*,/.test(content)) errors.push("句点直後に ASCII カンマが連結しています");
  if (/(?:\.\.\.|…)/.test(content)) errors.push("省略記号が含まれています");
  if (/(?:^|[（(・|\s])([一-龥々]{4,8})[ 　]+(?:特定)?(?:教授|准教授|講師|助教|先生|様)(?=$|[\s、。・|）)])/gmu.test(content)) {
    errors.push("外部関係者の個人名＋敬称・役職が残っています。氏名が正式な責任特定に不可欠でない限り、組織・研究チーム・協議事項を主語にしてください");
  }
  if (/経営(?:体制|チーム)?候補者|経営チーム候補/gu.test(content)) {
    errors.push("人を候補者ラベルで表す文が残っています。『経営体制に関する協議』のように論点を主語にしてください");
  }
  if (/巻き込む|参加(?:企業|機関).{0,12}動くため/gu.test(content)) {
    errors.push("外部関係者を動かす対象として扱う表現が残っています。参画の意義・条件・共同作業として書き直してください");
  }
  if (reference && !allowFormatChange) errors.push(...compareSubmissionStructure(content, reference));
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
  const allowFormatChange = body.allowFormatChange === true;
  if (!projectId || !/^\d{6}$/.test(ym)) {
    return NextResponse.json({ error: "projectId and ym (YYYYMM) required" }, { status: 400 });
  }

  const membersRes = await auth.supabase.from("members").select("code_name, member_name");
  if (membersRes.error) return NextResponse.json({ error: membersRes.error.message }, { status: 500 });
  const members = (membersRes.data || []) as MemberIdentity[];
  const normalized = normalizeSubmission(content, members);
  const previousYm = previousExternalYm(ym);
  const previousRes = await auth.supabase
    .from("monthly_reports_external")
    .select("body_md")
    .eq("project_id", projectId)
    .eq("ym", previousYm)
    .maybeSingle();
  if (previousRes.error) return NextResponse.json({ error: previousRes.error.message }, { status: 500 });
  const referenceBody = previousRes.data?.body_md || "";
  const validationErrors = validateSubmission(normalized, referenceBody, allowFormatChange);
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
    formatMatch: referenceBody ? compareSubmissionStructure(normalized, referenceBody).length === 0 : null,
    report: {
      bodyMd: result.data.body_md,
      generatedAt: result.data.generated_at,
      updatedAt: result.data.updated_at,
      jargonCheckStatus: result.data.jargon_check_status,
    },
  });
}
