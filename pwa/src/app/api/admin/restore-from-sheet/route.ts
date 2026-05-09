/**
 * GET /api/admin/restore-from-sheet?spreadsheetId=...
 *   Authorization: Bearer $CRON_SECRET
 *
 * AMD OS のマスタースプシから projects と project_members を復元する一回限り script。
 *
 * 処理:
 *   1. DB_Projects シート → projects テーブル (pm_member_id 等は project_members 経由なので
 *      ここでは invoice_to_emails / freee_partner_id / client_name / start_ym 等の field を上書き)
 *   2. DB_ProjectMembers シート → project_members テーブル (PJ ごとに全削除→挿入)
 *
 * 必要 env: GOOGLE_OAUTH_* + SUPABASE_SERVICE_ROLE_KEY (もしくは anon でも書けるが
 *           project_members は RLS のため service_role 必須)
 */

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import { createAdminClient } from "@/lib/supabase/admin";

const PROJECTS_SHEET_ID = 2085927697;
const PROJECT_MEMBERS_SHEET_ID = 1951617084;

function parseBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toUpperCase() === "TRUE";
  return false;
}

function nullIfEmpty(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function findColIndex(header: unknown[], name: string): number {
  return header.findIndex((h) => String(h ?? "") === name);
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const spreadsheetId = searchParams.get("spreadsheetId");
  const dryRun = searchParams.get("dryRun") === "1";
  // report_emails だけピンポイントで上書きしたい場合 (project_members 全置換は走らせない)
  const onlyReportEmails = searchParams.get("onlyReportEmails") === "1";
  if (!spreadsheetId) {
    return NextResponse.json({ error: "spreadsheetId required" }, { status: 400 });
  }

  const googleAuth = await getGoogleAuthAsync();
  if (!googleAuth) {
    return NextResponse.json({ error: "GOOGLE_OAUTH_* env が未設定" }, { status: 500 });
  }

  const sheets = google.sheets({ version: "v4", auth: googleAuth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tabs = (meta.data.sheets ?? []).map((s) => ({
    title: s.properties?.title,
    sheetId: s.properties?.sheetId,
  }));
  const projectsTabTitle = tabs.find((t) => t.sheetId === PROJECTS_SHEET_ID)?.title;
  const membersTabTitle = tabs.find((t) => t.sheetId === PROJECT_MEMBERS_SHEET_ID)?.title;
  if (!projectsTabTitle || !membersTabTitle) {
    return NextResponse.json({ error: "DB_Projects / DB_ProjectMembers タブが見つからない", tabs }, { status: 404 });
  }

  const [pjRes, mbRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: `${projectsTabTitle}!A1:AZ500` }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: `${membersTabTitle}!A1:AZ2000` }),
  ]);
  const pjRows = pjRes.data.values ?? [];
  const mbRows = mbRes.data.values ?? [];
  if (pjRows.length < 2 || mbRows.length < 2) {
    return NextResponse.json({ error: "シートに行が足りない" }, { status: 500 });
  }
  const pjHeader = pjRows[0];
  const mbHeader = mbRows[0];

  // DB_Projects 列 index
  const idxProjectId = findColIndex(pjHeader, "projectId");
  const idxClientName = findColIndex(pjHeader, "clientName");
  const idxFreeePartnerId = findColIndex(pjHeader, "freeePartnerId");
  const idxInvoiceToName = findColIndex(pjHeader, "invoiceToName");
  const idxInvoiceToEmails = findColIndex(pjHeader, "invoiceToEmails");
  const idxReportEmails = findColIndex(pjHeader, "reportEmails");
  const idxContractStartDate = findColIndex(pjHeader, "contractStartDate");
  const idxContractEndDate = findColIndex(pjHeader, "contractEndDate");
  if (idxProjectId < 0) {
    return NextResponse.json({ error: "DB_Projects に projectId 列がない" }, { status: 500 });
  }

  // 各 PJ の patch
  interface PjPatch {
    project_id: string;
    client_name?: string | null;
    freee_partner_id?: string | null;
    invoice_to_emails?: string | null;
    invoice_to_name?: string | null;
    report_emails?: string | null;
  }
  const pjPatches: PjPatch[] = [];
  for (const row of pjRows.slice(1)) {
    const pid = String(row[idxProjectId] ?? "").trim();
    if (!pid || !/^p\d+$/.test(pid)) continue;
    pjPatches.push({
      project_id: pid,
      client_name: idxClientName >= 0 ? nullIfEmpty(row[idxClientName]) : null,
      freee_partner_id: idxFreeePartnerId >= 0 ? nullIfEmpty(row[idxFreeePartnerId]) : null,
      invoice_to_emails: idxInvoiceToEmails >= 0 ? nullIfEmpty(row[idxInvoiceToEmails]) : null,
      invoice_to_name: idxInvoiceToName >= 0 ? nullIfEmpty(row[idxInvoiceToName]) : null,
      report_emails: idxReportEmails >= 0 ? nullIfEmpty(row[idxReportEmails]) : null,
    });
    void idxContractStartDate;
    void idxContractEndDate;
  }

  // DB_ProjectMembers 列 index
  const idxMbProjectId = findColIndex(mbHeader, "projectId");
  const idxMbMemberId = findColIndex(mbHeader, "memberId");
  const idxMbIsActive = findColIndex(mbHeader, "isActive");
  const idxMbIsPM = findColIndex(mbHeader, "isPM");
  const idxMbIsCloser = findColIndex(mbHeader, "isCloser");
  const idxMbRoleLabel = findColIndex(mbHeader, "roleLabel");
  const idxMbJoinYm = findColIndex(mbHeader, "joinYm");
  const idxMbLeaveYm = findColIndex(mbHeader, "leaveYm");
  if (idxMbProjectId < 0 || idxMbMemberId < 0) {
    return NextResponse.json({ error: "DB_ProjectMembers に projectId/memberId 列がない" }, { status: 500 });
  }

  interface PmRow {
    project_id: string;
    member_id: string;
    is_pm: boolean;
    is_closer: boolean;
    is_pl: boolean;
    role_label: string | null;
    join_ym: string | null;
    leave_ym: string | null;
    is_active: boolean;
  }
  const pmRows: PmRow[] = [];
  for (const row of mbRows.slice(1)) {
    const pid = String(row[idxMbProjectId] ?? "").trim();
    const mid = String(row[idxMbMemberId] ?? "").trim();
    if (!pid || !mid) continue;
    pmRows.push({
      project_id: pid,
      member_id: mid,
      is_pm: idxMbIsPM >= 0 ? parseBool(row[idxMbIsPM]) : false,
      is_closer: idxMbIsCloser >= 0 ? parseBool(row[idxMbIsCloser]) : false,
      is_pl: false, // PL はスプシに無い (PWA で新規導入)
      role_label: idxMbRoleLabel >= 0 ? nullIfEmpty(row[idxMbRoleLabel]) : null,
      join_ym: idxMbJoinYm >= 0 ? nullIfEmpty(row[idxMbJoinYm]) : null,
      leave_ym: idxMbLeaveYm >= 0 ? nullIfEmpty(row[idxMbLeaveYm]) : null,
      is_active: idxMbIsActive >= 0 ? parseBool(row[idxMbIsActive]) : true,
    });
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      projectsCount: pjPatches.length,
      projectMembersCount: pmRows.length,
      sampleProject: pjPatches[5],
      sampleMember: pmRows[0],
    });
  }

  const supabase = createAdminClient();

  // 1. projects 上書き (既存値を尊重しつつ、null を上書きしないために patch ベース)
  let pjUpdated = 0;
  const pjErrors: string[] = [];
  for (const patch of pjPatches) {
    const upd: Record<string, unknown> = {};
    if (onlyReportEmails) {
      // ピンポイントモード: report_emails 列だけ上書き (スプシに列がある場合は null も上書き対象)
      if (idxReportEmails >= 0) upd.report_emails = patch.report_emails;
    } else {
      if (patch.client_name) upd.client_name = patch.client_name;
      if (patch.freee_partner_id) upd.freee_partner_id = patch.freee_partner_id;
      if (patch.invoice_to_emails) upd.invoice_to_emails = patch.invoice_to_emails;
      // report_emails (関係先メアド) はスプシの reportEmails 列を直接コピー。
      // 過去に members.email から再生成する処理があったが、AMD メンバーのメアドが
      // 入る誤動作だったため廃止 (2026-05-08)
      if (idxReportEmails >= 0) upd.report_emails = patch.report_emails;
    }
    if (Object.keys(upd).length === 0) continue;
    const { error } = await supabase
      .from("projects")
      .update(upd)
      .eq("project_id", patch.project_id);
    if (error) pjErrors.push(`${patch.project_id}: ${error.message}`);
    else pjUpdated++;
  }

  // onlyReportEmails モードでは project_members 全置換は走らせない (まさ要望: ピンポイント実行)
  if (onlyReportEmails) {
    return NextResponse.json({
      ok: pjErrors.length === 0,
      mode: "onlyReportEmails",
      projectsTotal: pjPatches.length,
      projectsUpdated: pjUpdated,
      projectErrors: pjErrors,
    });
  }

  // 2. project_members 全置換
  // 既存の is_pl=true の rows は失わないように、まず保存しておく
  const { data: existingPls } = await supabase
    .from("project_members")
    .select("project_id, member_id")
    .eq("is_pl", true);
  const plSet = new Set<string>((existingPls ?? []).map((r) => `${r.project_id}::${r.member_id}`));
  for (const r of pmRows) {
    if (plSet.has(`${r.project_id}::${r.member_id}`)) {
      r.is_pl = true;
    }
  }

  // 全削除
  const { error: delErr } = await supabase.from("project_members").delete().neq("project_id", "__never_match__");
  if (delErr) {
    return NextResponse.json({ ok: false, error: `delete failed: ${delErr.message}`, pjUpdated, pjErrors }, { status: 500 });
  }
  // 一括挿入 (大量行なので分割)
  let inserted = 0;
  const insertErrors: string[] = [];
  for (let i = 0; i < pmRows.length; i += 200) {
    const chunk = pmRows.slice(i, i + 200);
    const { error: insErr } = await supabase.from("project_members").insert(chunk);
    if (insErr) insertErrors.push(`chunk ${i}: ${insErr.message}`);
    else inserted += chunk.length;
  }

  // 旧: report_emails を members.email から集約再生成する処理があったが、
  // AMD メンバーのメアドが報告先になってしまう誤動作だったため廃止 (2026-05-08)。
  // 現在は上の (1) で patch.report_emails (DB_Projects.reportEmails 列) を直接コピーする。

  return NextResponse.json({
    ok: insertErrors.length === 0,
    projectsTotal: pjPatches.length,
    projectsUpdated: pjUpdated,
    projectErrors: pjErrors,
    projectMembersTotal: pmRows.length,
    projectMembersInserted: inserted,
    projectMembersErrors: insertErrors,
    plPreserved: plSet.size,
  });
}
