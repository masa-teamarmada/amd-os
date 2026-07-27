/**
 * /api/project/monthly-report-print
 *
 * GET ?projectId=&ym= → クライアント提出用月次レポートの集約データ
 *
 * 大学・研究機関向け国プロ網羅型レポート用に拡張 (v0.32.0)。
 * 章立て A-J 全ブロックを 1 fetch で返す。
 *
 * 章 / 出典テーブル:
 *  A. 表紙          → projects + 業務契約特定 (contracts.signed の最新 + contract_terms)
 *  B. Exec Summary  → monthly_reports + amd_score_inputs (XRL/AMD Score)
 *  C. 進捗          → monthly_reports / value_milestones (Gantt含む) / milestone_monthly_progress / project_xrl_log
 *  D. 成果          → project_strategy_signals (polarity🎉✨) / project_grants / project_media_mentions
 *  E. 主要会議      → project_meeting_summaries (当月)
 *  F. 体制          → project_members + members + milestone_responsibility + project_founding_members
 *  G. 課題          → project_meeting_summaries.risks + signals(polarity⚠️) + action_items
 *  H. 財務          → billing_cycles + reimbursements + project_grants.disbursed_yen
 *  I. 次月計画      → action_items (翌月) + meetings (upcoming翌月)
 *  J. 添付          → meeting_assets + project_documents + contract_documents
 *
 * 列名は design/db_schema.md 準拠 (想像で書かない)。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";

// UI は全PJ共通の submission を使う。旧提出先別キーは保存済みURLの互換性だけ残す。
const VALID_PRINT_TEMPLATES = new Set(["internal", "submission", "nims-cx", "ehime-sx", "kogakuin-kute"]);

function toHyphenYm(ym: string): string {
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}`;
}

// 提出版の氏名表記: 姓のみ。スペースが無く安全に姓を切り出せない場合は「担当者」。
function toSurnameOnly(memberName: string | null | undefined): string {
  const name = (memberName || "").trim();
  if (!name) return "担当者";
  const parts = name.split(/[\s　]+/).filter(Boolean);
  if (parts.length >= 2) return parts[0];
  return "担当者";
}

// 提出版本文の用語正規化: eLAD 表記ゆれを e-Rad に統一し、本文中に残った code_name を姓のみに置換する。
type MemberIdentity = { code_name: string; member_name: string | null };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeJargonForSubmission(body: string, members: MemberIdentity[] = []): string {
  let out = body.replace(/eLAD/gi, "e-Rad");

  const identities = members
    .map((member) => ({
      codeName: (member.code_name || "").trim(),
      memberName: (member.member_name || "").trim(),
      surname: toSurnameOnly(member.member_name),
    }))
    .filter((member) => member.codeName || member.memberName);

  // まずフルネームと markdown のメンバーリンクを確実に姓へ落とす。
  for (const member of identities) {
    if (member.memberName) out = out.split(member.memberName).join(member.surname);
    if (member.codeName) {
      const escaped = escapeRegExp(member.codeName);
      out = out.replace(new RegExp(`\\[${escaped}\\](?=\\()`, "g"), member.surname);
    }
  }

  // 「まさとりり」のようにコードネームを連結した内部文も、語の組合せを限定して置換する。
  for (const left of identities) {
    for (const right of identities) {
      if (!left.codeName || !right.codeName || left === right) continue;
      out = out.split(`${left.codeName}と${right.codeName}`).join(`${left.surname}と${right.surname}`);
    }
  }

  // 単独コードネームは、名前として現れる高確度の区切り・助詞がある場合だけ置換する。
  for (const member of identities) {
    if (!member.codeName) continue;
    if (out.trim() === member.codeName) return member.surname;
    const escaped = escapeRegExp(member.codeName);
    const pattern = new RegExp(`(^|[\\s、。,，。・（(「『【:：]|[はがをものと])${escaped}(?=(?:(?:は|が|を|も|へ|の|から|より)(?:[\\s、。,，。]|$|[一-龥ぁ-んァ-ンA-Za-z0-9])|[A-Z]{2,}|[:：]))`, "g");
    out = out.replace(pattern, `$1${member.surname}`);
  }
  return out;
}

function normalizeSubmissionPayload(value: unknown, members: MemberIdentity[]): unknown {
  if (typeof value === "string") return normalizeJargonForSubmission(value, members);
  if (Array.isArray(value)) return value.map((item) => normalizeSubmissionPayload(item, members));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeSubmissionPayload(item, members)]));
  }
  return value;
}

function nextYm(ym: string): string {
  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(4, 6), 10);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}${String(nm).padStart(2, "0")}`;
}
function prevYm(ym: string): string {
  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(4, 6), 10);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}${String(pm).padStart(2, "0")}`;
}
function ymFirstDay(ym: string): string {
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`;
}
function ymLastDay(ym: string): string {
  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(4, 6), 10);
  const d = new Date(y, m, 0).getDate();
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-${String(d).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const ym = searchParams.get("ym");
  if (!projectId || !/^\d{6}$/.test(ym ?? "")) {
    return NextResponse.json({ error: "projectId and ym (YYYYMM) required" }, { status: 400 });
  }
  const rawTemplate = searchParams.get("template") || "internal";
  const template = VALID_PRINT_TEMPLATES.has(rawTemplate) ? rawTemplate : "internal";
  const isSubmission = template !== "internal";
  const ymStr = ym as string;
  const nextYmStr = nextYm(ymStr);
  const prevYmStr = prevYm(ymStr);
  const ymStart = ymFirstDay(ymStr);
  const ymEnd = ymLastDay(ymStr);

  const db = auth.supabase;

  const [
    projRes, repRes, milestoneRes, meetingRes, signalRes, pmRes, noteRes,
    planCycleRes, contractsRes, foundingRes,
    grantsRes, mediaRes, xrlLogRes, actionRes, reimburseRes,
    upcomingMeetingRes,
  ] = await Promise.all([
    db.from("projects")
      .select("project_id,project_name,client_name,status,start_ym,end_ym,fee_type,fee_amount")
      .eq("project_id", projectId).maybeSingle(),
    db.from("monthly_reports")
      .select("draft_content,final_content,status,generated_at,fixed_at,confirmed_by,pl_review_requested_at,pl_review_requested_by")
      .eq("project_id", projectId).eq("ym", ymStr).maybeSingle(),
    db.from("value_milestones")
      .select("milestone_id,plan_cycle_id,title,points,tag,is_active,period_start_ym,target_ym,sort_order,success_criteria")
      .eq("is_active", true),
    db.from("project_meeting_summaries")
      .select("meeting_id,meeting_date,meeting_start_at,title,summary_short,narrative_md,decided,next_actions,risks,notion_url,source_kinds,source_url")
      .eq("project_id", projectId).eq("ym", ymStr)
      .order("meeting_date", { ascending: true }),
    db.from("project_strategy_signals")
      .select("signal_id,signal_type,title,summary,impact_level,decision_state,signal_date,status,polarity,score_impact_summary")
      .eq("project_id", projectId).eq("ym", ymStr)
      .eq("status", "confirmed")
      .order("signal_date", { ascending: false }),
    db.from("project_members")
      .select("member_id,role,role_label,is_pm,is_pl,is_closer,is_active,join_ym,leave_ym")
      .eq("project_id", projectId).eq("is_active", true),
    db.from("project_monthly_notes")
      .select("body,updated_at,updated_by")
      .eq("project_id", projectId).eq("ym", ymStr).maybeSingle(),
    db.from("value_plan_cycles")
      .select("plan_cycle_id,status,period_start_ym,period_end_ym,total_points,budget_yen")
      .eq("project_id", projectId)
      .order("period_start_ym", { ascending: false }),
    // 契約特定情報: signed/effective を優先、なければ最新の terms
    db.from("contracts")
      .select("contract_id,contract_title,counterparty_name,contract_type,status,effective_date,expiration_date,contract_value_yen,canonical_title")
      .eq("project_id", projectId)
      .in("status", ["signed", "active", "effective"])
      .order("effective_date", { ascending: false, nullsFirst: false }),
    db.from("project_founding_members")
      .select("person_name,affiliation,role,role_label_jp,category,status")
      .eq("project_id", projectId).eq("status", "active"),
    db.from("project_grants")
      .select("id,grant_name,agency,grant_type,amount_yen,disbursed_yen,period_start_ym,period_end_ym,adopted_date,status")
      .eq("project_id", projectId)
      .order("adopted_date", { ascending: false, nullsFirst: false }),
    db.from("project_media_mentions")
      .select("id,occurred_on,title,media_name,kind,source_url")
      .eq("project_id", projectId)
      .eq("verified", true)
      .gte("occurred_on", ymStart).lte("occurred_on", ymEnd)
      .order("occurred_on", { ascending: false }),
    db.from("project_xrl_log")
      .select("id,observed_at,trl,brl,grl,srl,hrl,bottleneck,milestone_label,source_note")
      .eq("project_id", projectId)
      .order("observed_at", { ascending: false })
      .limit(8),
    db.from("action_items")
      .select("action_id,scope,category,title,assignee_member_id,due_at,status,priority,source_hash")
      .eq("project_id", projectId)
      .in("status", ["open", "in_progress", "blocked"])
      .order("due_at", { ascending: true, nullsFirst: false }),
    db.from("reimbursements")
      .select("reimbursement_id,date,category,amount,tax_rate,description,member_id,status,billed_ym")
      .eq("project_id", projectId)
      .eq("billed_ym", ymStr),
    db.from("project_meeting_summaries")
      .select("meeting_id,meeting_date,title,summary_short,source_kinds")
      .eq("project_id", projectId).eq("ym", nextYmStr)
      .order("meeting_date", { ascending: true }),
  ]);

  if (projRes.error || !projRes.data) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }
  const proj = projRes.data;

  // MS を当該 PJ の **現役** plan_cycle に絞る (= status='fixed' / 'closed' / 'archived' = 過去シーズンは除外)。
  // 過去シーズンには見積明細や旧 MS が is_active=true のまま大量に残っていることがあり、
  // 全 plan_cycle から拾うと MS 表 / Gantt に重複・期間未設定 MS が出現する (SX で 75 件混入の事例)。
  const planCycles = planCycleRes.data || [];
  const activeCycleStatuses = new Set(["active", "confirmed", "draft", "in_progress"]);
  const activePlanCycles = planCycles.filter((c) => activeCycleStatuses.has(c.status));
  const planCycleIds = new Set(activePlanCycles.map((c) => c.plan_cycle_id));
  const projectMilestones = (milestoneRes.data || [])
    .filter((m) => planCycleIds.has(m.plan_cycle_id))
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  const milestoneIds = projectMilestones.map((m) => m.milestone_id);

  // 当月 + 前月 milestone_monthly_progress (Gantt の累積比較用)
  const progressRes = milestoneIds.length
    ? await db.from("milestone_monthly_progress")
        .select("milestone_key,ym,progress_pct,consumed_pt,source,note")
        .in("milestone_key", milestoneIds)
        .in("ym", [ymStr, prevYmStr])
    : { data: [] };
  const currProgressMap = new Map(
    ((progressRes.data || []) as Array<{ milestone_key: string; ym: string; progress_pct: number; note: string | null; source: string | null }>)
      .filter((p) => p.ym === ymStr)
      .map((p) => [p.milestone_key, p])
  );
  const prevProgressMap = new Map(
    ((progressRes.data || []) as Array<{ milestone_key: string; ym: string; progress_pct: number }>)
      .filter((p) => p.ym === prevYmStr)
      .map((p) => [p.milestone_key, p.progress_pct])
  );

  const milestones = projectMilestones.map((m) => {
    const p = currProgressMap.get(m.milestone_id);
    const prevPct = Number(prevProgressMap.get(m.milestone_id) || 0);
    const currPct = Math.round(Number(p?.progress_pct || 0));
    return {
      milestoneId: m.milestone_id,
      title: m.title,
      points: Number(m.points || 0),
      tag: m.tag || "normal",
      periodStartYm: m.period_start_ym || null,
      targetYm: m.target_ym || null,
      successCriteria: m.success_criteria || null,
      progressPct: currPct,
      prevProgressPct: Math.round(prevPct),
      deltaPct: currPct - Math.round(prevPct),
      note: p?.note || null,
      source: p?.source || null,
    };
  });

  // 当該PJのメンバー責任 (MS別 share)
  const responsibilityRes = milestoneIds.length
    ? await db.from("milestone_responsibility")
        .select("milestone_id,member_id,role,share,task_description")
        .in("milestone_id", milestoneIds)
    : { data: [] };

  // メンバー名解決 (project_members + responsibility + action_items.assignee の member_id 全部)
  // v0.33.0: 正式な報告書には本名 (member_name) を出す。フォールバックで code_name。
  const pmRows = pmRes.data || [];
  const respRows = (responsibilityRes.data || []) as Array<{ milestone_id: string; member_id: string; role: string | null; share: number | null; task_description: string | null }>;
  const actionAssigneeIds = ((actionRes.data || []) as Array<{ assignee_member_id: string | null }>)
    .map((a) => a.assignee_member_id).filter((v): v is string => !!v);
  const memberIdSet = new Set([
    ...pmRows.map((r) => r.member_id),
    ...respRows.map((r) => r.member_id),
    ...actionAssigneeIds,
  ]);
  const memberNameRes = memberIdSet.size
    ? await db.from("members").select("member_id,code_name,member_name").in("member_id", Array.from(memberIdSet))
    : { data: [] };
  // 本名優先、無ければ code_name。ただし提出版 (internal 以外) は必ず姓のみ、code_name は絶対に出さない。
  const memberNameMap = new Map(((memberNameRes.data || []) as Array<{ member_id: string; code_name: string; member_name: string | null }>)
    .map((m) => [m.member_id, isSubmission ? toSurnameOnly(m.member_name) : (m.member_name && m.member_name.trim() ? m.member_name : m.code_name)]));

  const members = pmRows.map((pm) => ({
    memberId: pm.member_id,
    codeName: memberNameMap.get(pm.member_id) || pm.member_id,
    role: pm.role || null,
    roleLabel: pm.role_label || null,
    isPm: !!pm.is_pm,
    isPl: !!pm.is_pl,
    isCloser: !!pm.is_closer,
    joinYm: pm.join_ym || null,
    leaveYm: pm.leave_ym || null,
  }));

  const responsibilities = respRows.map((r) => ({
    milestoneId: r.milestone_id,
    memberId: r.member_id,
    codeName: memberNameMap.get(r.member_id) || r.member_id,
    role: r.role || null,
    share: Number(r.share || 0),
    taskDescription: r.task_description || null,
  }));

  // 業務契約特定情報
  const signedContracts = (contractsRes.data || []) as Array<{
    contract_id: string; contract_title: string; counterparty_name: string | null;
    contract_type: string; status: string; effective_date: string | null;
    expiration_date: string | null; contract_value_yen: number | null; canonical_title: string | null;
  }>;
  const primaryContract = signedContracts[0] || null;

  // contract_terms の最新 (applied) からも契約番号・見積書番号を拾う
  const termsRes = await db.from("contract_terms")
    .select("term_id,contract_id,contract_no,quote_no,contract_title,counterparty_name,period_start,period_end,amount_tax_incl,billing_distribution,status")
    .eq("project_id", projectId)
    .eq("status", "applied")
    .order("period_start", { ascending: false, nullsFirst: false })
    .limit(5);
  const primaryTerm = ((termsRes.data || []) as Array<{ contract_id: string | null; contract_no: string | null; quote_no: string | null; contract_title: string | null; counterparty_name: string | null; period_start: string | null; period_end: string | null; amount_tax_incl: number | null }>)[0] || null;

  const contractIdentification = {
    contractId: primaryContract?.contract_id || primaryTerm?.contract_id || null,
    title: primaryContract?.canonical_title || primaryContract?.contract_title || primaryTerm?.contract_title || null,
    counterparty: primaryContract?.counterparty_name || primaryTerm?.counterparty_name || null,
    contractType: primaryContract?.contract_type || null,
    contractNo: primaryTerm?.contract_no || null,
    quoteNo: primaryTerm?.quote_no || null,
    // 入札番号は列がないので現状 null。タスク#12 で列追加後に埋まる。
    bidNo: null as string | null,
    amdContractNo: null as string | null, // タスク#12 で列追加後に埋まる
    periodStart: primaryContract?.effective_date || primaryTerm?.period_start || null,
    periodEnd: primaryContract?.expiration_date || primaryTerm?.period_end || null,
    contractValueYen: Number(primaryContract?.contract_value_yen || primaryTerm?.amount_tax_incl || 0) || null,
  };

  // 提出版本文: monthly_reports_external.body_md を優先、無ければ monthly_reports.final_content にフォールバック
  let submissionBody: string | null = null;
  let submissionGeneratedAt: string | null = null;
  let submissionMemberIdentities: MemberIdentity[] = [];
  if (isSubmission) {
    // 本文には PJ メンバー外の AMD メンバーが登場することもあるため、提出版の
    // 匿名化辞書は当該 PJ の担当者だけでなく members 全体から作る。
    const submissionMemberRes = await db.from("members").select("code_name,member_name");
    submissionMemberIdentities = (submissionMemberRes.data || memberNameRes.data || []) as MemberIdentity[];
    const externalRes = await db.from("monthly_reports_external")
      .select("body_md,generated_at,generated_by_model,jargon_check_status")
      .eq("project_id", projectId).eq("ym", toHyphenYm(ymStr)).maybeSingle();
    if (externalRes.data?.body_md) {
      submissionBody = normalizeJargonForSubmission(externalRes.data.body_md, submissionMemberIdentities);
      submissionGeneratedAt = externalRes.data.generated_at || null;
    } else {
      const fallbackBody = repRes.data?.final_content || repRes.data?.draft_content || "";
      submissionBody = fallbackBody ? normalizeJargonForSubmission(fallbackBody, submissionMemberIdentities) : null;
    }
  }

  // 5生データ確認状況 (ソース証跡)
  const sourceTraceRes = await db.from("monthly_reports")
    .select("collection_summary_json")
    .eq("project_id", projectId).eq("ym", ymStr).maybeSingle();
  const sourceCheck = (sourceTraceRes.data?.collection_summary_json as Record<string, unknown> | null) || null;

  // 当月会議資料リンク (meeting_assets)
  const meetingIds = (meetingRes.data || []).map((m) => m.meeting_id);
  const meetingAssetsRes = meetingIds.length
    ? await db.from("meeting_assets")
        .select("meeting_id,storage_path,drive_file_id,web_view_link,file_name,mime_type,uploaded_at")
        .in("meeting_id", meetingIds)
    : { data: [] };

  // PJ 資料台帳 (当月更新分)
  const docsRes = await db.from("project_documents")
    .select("id,file_name,web_view_link,mime_type,created_at,uploaded_by")
    .eq("project_id", projectId)
    .gte("created_at", `${ymStart}T00:00:00Z`)
    .lte("created_at", `${ymEnd}T23:59:59Z`)
    .order("created_at", { ascending: false });

  // 契約書 PDF (最新)
  const contractDocsRes = await db.from("contract_documents")
    .select("document_id,document_kind,file_name,web_view_link,is_latest,received_at")
    .eq("project_id", projectId)
    .eq("is_latest", true)
    .order("received_at", { ascending: false })
    .limit(10);

  // 当月 billing_cycles (財務)
  const billingRes = await db.from("billing_cycles")
    .select("project_id,ym,status,budget_yen,budget_reported_amount,extra_revenue_json,extra_budget_yen,invoice_sent_at,payment_confirmed_at")
    .eq("project_id", projectId).eq("ym", ymStr).maybeSingle();

  // ─── 整形 ─────────────────────────────────────
  const meetings = (meetingRes.data || []).map((m) => ({
    meetingId: m.meeting_id,
    meetingDate: m.meeting_date,
    title: m.title,
    summaryShort: m.summary_short || "",
    narrativeMd: m.narrative_md || null,
    decided: Array.isArray(m.decided) ? m.decided : [],
    nextActions: Array.isArray(m.next_actions) ? m.next_actions : [],
    risks: Array.isArray(m.risks) ? m.risks : [],
    notionUrl: m.notion_url || null,
    sourceKinds: m.source_kinds || null,
  }));

  const signals = (signalRes.data || []).map((s) => ({
    signalId: s.signal_id,
    signalType: s.signal_type,
    title: s.title,
    summary: s.summary,
    impactLevel: s.impact_level,
    decisionState: s.decision_state,
    signalDate: s.signal_date,
    polarity: s.polarity || null,
    scoreImpactSummary: s.score_impact_summary || null,
  }));

  // 成果系シグナル (🎉 大進捗 + ✨ 順調な前進)
  const achievementSignals = signals.filter((s) => s.polarity === "🎉" || s.polarity === "✨");
  // リスク系シグナル
  const riskSignals = signals.filter((s) => s.polarity === "⚠️");
  // 戦略転換シグナル
  const pivotSignals = signals.filter((s) => s.polarity === "🔄");

  const grants = ((grantsRes.data || []) as Array<{ id: string; grant_name: string; agency: string | null; grant_type: string | null; amount_yen: number | null; disbursed_yen: number | null; period_start_ym: string | null; period_end_ym: string | null; adopted_date: string | null; status: string | null }>).map((g) => ({
    id: g.id,
    grantName: g.grant_name,
    agency: g.agency || null,
    grantType: g.grant_type || null,
    amountYen: Number(g.amount_yen || 0),
    disbursedYen: Number(g.disbursed_yen || 0),
    periodStartYm: g.period_start_ym || null,
    periodEndYm: g.period_end_ym || null,
    adoptedDate: g.adopted_date || null,
    status: g.status || null,
  }));

  const media = ((mediaRes.data || []) as Array<{ id: string; occurred_on: string; title: string; media_name: string; kind: string; source_url: string | null }>).map((m) => ({
    id: m.id,
    occurredOn: m.occurred_on,
    title: m.title,
    mediaName: m.media_name,
    kind: m.kind,
    sourceUrl: m.source_url || null,
  }));

  const xrlLog = ((xrlLogRes.data || []) as Array<{ id: string; observed_at: string; trl: number | null; brl: number | null; grl: number | null; srl: number | null; hrl: number | null; bottleneck: string | null; milestone_label: string | null; source_note: string | null }>).map((x) => ({
    id: x.id,
    observedAt: x.observed_at,
    trl: x.trl,
    brl: x.brl,
    grl: x.grl,
    srl: x.srl,
    hrl: x.hrl,
    bottleneck: x.bottleneck || null,
    milestoneLabel: x.milestone_label || null,
    sourceNote: x.source_note || null,
  }));

  // 当月の XRL = 当月以前で一番新しい1件、前月の XRL = 前月末以前で一番新しい1件
  const currentXrl = xrlLog.find((x) => x.observedAt <= ymEnd) || null;
  const previousXrl = xrlLog.find((x) => x.observedAt < ymStart) || null;

  const actionItems = ((actionRes.data || []) as Array<{ action_id: string; scope: string; category: string | null; title: string; assignee_member_id: string | null; due_at: string | null; status: string; priority: string | null }>).map((a) => ({
    actionId: a.action_id,
    scope: a.scope,
    category: a.category || null,
    title: a.title,
    assignee: a.assignee_member_id ? (memberNameMap.get(a.assignee_member_id) || a.assignee_member_id) : null,
    dueAt: a.due_at || null,
    status: a.status,
    priority: a.priority || null,
  }));
  // 翌月までに期日が来るアクション (= 次月の重点)
  const nextMonthActions = actionItems.filter((a) => {
    if (!a.dueAt) return false;
    const due = a.dueAt.slice(0, 10);
    return due >= ymStart && due <= ymLastDay(nextYmStr);
  });

  const reimbursements = ((reimburseRes.data || []) as Array<{ reimbursement_id: string; date: string; category: string; amount: number; tax_rate: number | null; description: string | null; member_id: string | null; status: string }>).map((r) => ({
    reimbursementId: r.reimbursement_id,
    date: r.date,
    category: r.category,
    amount: Number(r.amount || 0),
    taxRate: Number(r.tax_rate || 0),
    description: r.description || null,
    member: r.member_id ? (memberNameMap.get(r.member_id) || r.member_id) : null,
    status: r.status,
  }));
  const reimburseTotal = reimbursements.reduce((s, r) => s + r.amount, 0);

  const upcomingMeetings = ((upcomingMeetingRes.data || []) as Array<{ meeting_id: string; meeting_date: string; title: string; summary_short: string | null; source_kinds: string | null }>)
    .filter((m) => (m.source_kinds || "").includes("upcoming"))
    .map((m) => ({
      meetingId: m.meeting_id,
      meetingDate: m.meeting_date,
      title: m.title,
      summaryShort: m.summary_short || "",
    }));

  const meetingAssets = ((meetingAssetsRes.data || []) as Array<{ meeting_id: string; file_name: string; web_view_link: string | null; mime_type: string; uploaded_at: string }>).map((a) => ({
    meetingId: a.meeting_id,
    fileName: a.file_name,
    webViewLink: a.web_view_link || null,
    mimeType: a.mime_type,
    uploadedAt: a.uploaded_at,
  }));
  const projectDocs = ((docsRes.data || []) as Array<{ id: string; file_name: string; web_view_link: string | null; mime_type: string; created_at: string }>).map((d) => ({
    id: d.id,
    fileName: d.file_name,
    webViewLink: d.web_view_link || null,
    mimeType: d.mime_type,
    createdAt: d.created_at,
  }));
  const contractDocs = ((contractDocsRes.data || []) as Array<{ document_id: string; document_kind: string; file_name: string; web_view_link: string | null; received_at: string }>).map((d) => ({
    documentId: d.document_id,
    documentKind: d.document_kind,
    fileName: d.file_name,
    webViewLink: d.web_view_link || null,
    receivedAt: d.received_at,
  }));

  const founding = ((foundingRes.data || []) as Array<{ person_name: string; affiliation: string | null; role: string | null; role_label_jp: string | null; category: string }>).map((f) => ({
    personName: f.person_name,
    affiliation: f.affiliation || null,
    role: f.role || null,
    roleLabelJp: f.role_label_jp || null,
    category: f.category,
  }));

  const overallPct = (() => {
    const counted = milestones.filter((m) => (m.tag || "").toLowerCase() !== "buffer");
    const totalPt = counted.reduce((s, m) => s + m.points, 0);
    if (totalPt <= 0) return 0;
    const weighted = counted.reduce((s, m) => s + m.progressPct * m.points, 0) / totalPt;
    return Math.round(weighted);
  })();

  // planCycle は Gantt の計画期間として使うので、現役 (active/confirmed/draft) を優先。
  // 無ければ fallback で fixed の最新 (= 全 cycle のうち period_end_ym 降順の先頭) を使う。
  const planCycle = activePlanCycles[0] || planCycles[0] || null;
  // 期待進捗% (経過月数比)
  const expectedPct = (() => {
    if (!planCycle) return null;
    const ymToMonths = (s: string) => parseInt(s.slice(0, 4), 10) * 12 + parseInt(s.slice(4, 6), 10);
    const total = ymToMonths(planCycle.period_end_ym) - ymToMonths(planCycle.period_start_ym) + 1;
    const elapsed = ymToMonths(ymStr) - ymToMonths(planCycle.period_start_ym) + 1;
    if (total <= 0) return null;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  })();

  // RAG (3軸: スケジュール / コスト / リスク)
  const rag = {
    schedule: (() => {
      if (expectedPct === null) return "n/a";
      const diff = expectedPct - overallPct;
      if (diff <= 5) return "green";
      if (diff <= 20) return "amber";
      return "red";
    })(),
    cost: (() => {
      const budget = Number(billingRes.data?.budget_yen || 0);
      const reported = Number(billingRes.data?.budget_reported_amount || 0);
      if (budget <= 0) return "n/a";
      const usageRatio = reported / budget;
      if (usageRatio <= 1.0) return "green";
      if (usageRatio <= 1.1) return "amber";
      return "red";
    })(),
    risk: (() => {
      if (riskSignals.length === 0) return "green";
      const critical = riskSignals.filter((r) => r.impactLevel === "critical" || r.impactLevel === "high");
      if (critical.length === 0) return "amber";
      return "red";
    })(),
  };

  const responsePayload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    project: {
      projectId: proj.project_id,
      projectName: proj.project_name,
      clientName: proj.client_name || null,
      status: proj.status,
      startYm: proj.start_ym || null,
      endYm: proj.end_ym || null,
      feeType: proj.fee_type || null,
      feeAmount: Number(proj.fee_amount || 0) || null,
    },
    ym: ymStr,
    nextYm: nextYmStr,
    template,
    isSubmission,
    submissionBody,
    submissionGeneratedAt,
    usingSubmissionFallback: isSubmission && Boolean(submissionBody) && !submissionGeneratedAt,
    report: repRes.data
      ? {
          status: repRes.data.status || "pending",
          draftContent: repRes.data.draft_content || "",
          finalContent: repRes.data.final_content || "",
          generatedAt: repRes.data.generated_at,
          fixedAt: repRes.data.fixed_at,
          confirmedBy: repRes.data.confirmed_by || null,
          plReviewRequestedAt: repRes.data.pl_review_requested_at || null,
          plReviewRequestedBy: repRes.data.pl_review_requested_by || null,
        }
      : null,
    monthlyNote: noteRes.data?.body || "",
    contract: contractIdentification,
    milestones,
    responsibilities,
    overallPct,
    expectedPct,
    rag,
    planCycle: planCycle
      ? {
          planCycleId: planCycle.plan_cycle_id,
          status: planCycle.status,
          periodStartYm: planCycle.period_start_ym,
          periodEndYm: planCycle.period_end_ym,
          totalPoints: Number(planCycle.total_points || 0),
          budgetYen: Number(planCycle.budget_yen || 0),
        }
      : null,
    meetings,
    upcomingMeetings,
    signals,
    achievementSignals,
    riskSignals,
    pivotSignals,
    grants,
    media,
    xrlLog,
    currentXrl,
    previousXrl,
    members,
    founding,
    actionItems,
    nextMonthActions,
    reimbursements,
    reimburseTotal,
    billing: billingRes.data
      ? {
          status: billingRes.data.status,
          budgetYen: Number(billingRes.data.budget_yen || 0),
          budgetReportedAmount: Number(billingRes.data.budget_reported_amount || 0),
          extraRevenueJson: billingRes.data.extra_revenue_json || null,
          extraBudgetYen: Number(billingRes.data.extra_budget_yen || 0) || null,
          invoiceSentAt: billingRes.data.invoice_sent_at || null,
          paymentConfirmedAt: billingRes.data.payment_confirmed_at || null,
        }
      : null,
    attachments: {
      meetingAssets,
      projectDocs,
      contractDocs,
    },
    sourceCheck,
  };
  return NextResponse.json(isSubmission
    ? normalizeSubmissionPayload(responsePayload, submissionMemberIdentities)
    : responsePayload);
}
