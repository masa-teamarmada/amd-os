"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  Download,
  FileSpreadsheet,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
  Users,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  buildCapTableSnapshots,
  capTableTieOut,
  convertibleScenario,
  type CompanyOverviewData,
} from "@/lib/company-overview";
import { downloadCompanyOverviewXlsx } from "@/lib/company-overview-xlsx";
import { CockpitKillerFactorCatalog } from "@/components/cockpit/CockpitKillerFactorCatalog";
import { loadGovernance, peekGovernance, saveGovernanceEntity } from "@/lib/governance-client";
import {
  EmptyState,
  Field,
  InfoCell,
  NativeSelect,
  Section,
  formatDate,
  formatNumber,
  formatYen,
  numberOrNull,
  statusLabel,
  textOrNull,
} from "@/components/cockpit/company-overview-ui";

type DialogKind = "profile" | "financial" | "meeting" | null;

const EMPTY_DATA: CompanyOverviewData = {
  profile: null,
  shareholders: [],
  transactions: [],
  convertibles: [],
  financialPeriods: [],
  rounds: [],
  meetings: [],
  actionItems: [],
};

const LEGAL_STATUS = [
  { value: "pre_incorporation", label: "設立前" },
  { value: "incorporated", label: "設立済み" },
  { value: "liquidating", label: "清算中" },
  { value: "closed", label: "清算済み" },
];
const MEETING_TYPES = [
  { value: "agm", label: "定時株主総会" },
  { value: "egm", label: "臨時株主総会" },
  { value: "board", label: "取締役会" },
  { value: "board_written", label: "取締役会（書面決議）" },
  { value: "shareholder_written", label: "株主総会（書面決議）" },
];

function compactCorporateNumber(value: string | null | undefined) {
  if (!value) return "未入力";
  return value.replace(/^(\d)(\d{4})(\d{4})(\d{4})$/, "$1-$2-$3-$4");
}

function meetingLabel(value: string | null | undefined) {
  return MEETING_TYPES.find((option) => option.value === value)?.label || value || "種別未入力";
}

function sourceHref(attachment: { url?: string; webViewLink?: string; web_view_link?: string }) {
  return attachment.url || attachment.webViewLink || attachment.web_view_link || "";
}

export function CockpitCompanyOverview({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [data, setData] = useState<CompanyOverviewData>(() => peekGovernance(projectId) ?? EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const exportRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loadGovernance(projectId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "会社概要を読み込めなかったよ");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const snapshots = useMemo(() => buildCapTableSnapshots(data), [data]);
  useEffect(() => {
    if (!snapshots.length) setSelectedSnapshotId("");
    else if (!snapshots.some((snapshot) => snapshot.id === selectedSnapshotId)) setSelectedSnapshotId(snapshots.at(-1)!.id);
  }, [selectedSnapshotId, snapshots]);
  const selectedSnapshot = snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) || snapshots.at(-1) || null;
  const latestSnapshot = snapshots.at(-1) || null;
  const tieOut = capTableTieOut(data);
  const conversion = convertibleScenario(data);
  const latestRound = data.rounds.find((round) => round.price_per_share_yen != null || round.post_money_yen != null) || data.rounds[0];
  const selectedEquityValue = selectedSnapshot && latestRound?.price_per_share_yen
    ? selectedSnapshot.outstandingShares * Number(latestRound.price_per_share_yen)
    : latestRound?.post_money_yen || null;
  const profileCompleteness = [data.profile?.legal_name, data.profile?.head_office, data.profile?.business_purpose, data.profile?.capital_yen, data.profile?.board_structure, data.profile?.fiscal_year_end_month].filter((value) => value != null && value !== "").length;

  async function post(entity: string, row: Record<string, unknown>) {
    await saveGovernanceEntity(projectId, entity, row);
  }

  async function save(label: string, action: () => Promise<void>) {
    setSaving(true);
    setError("");
    try {
      await action();
      setDialog(null);
      await load();
      setNotice(`${label}を保存したよ`);
      window.setTimeout(() => setNotice(""), 3200);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できなかったよ");
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await save("会社基本情報", () => post("company_profile", {
      project_id: projectId,
      legal_status: form.get("legal_status"),
      legal_name: textOrNull(form.get("legal_name")), legal_name_en: textOrNull(form.get("legal_name_en")),
      corporate_number: textOrNull(form.get("corporate_number")), entity_type: textOrNull(form.get("entity_type")),
      incorporated_on: textOrNull(form.get("incorporated_on")), head_office: textOrNull(form.get("head_office")),
      business_purpose: textOrNull(form.get("business_purpose")), representative_name: textOrNull(form.get("representative_name")),
      capital_yen: numberOrNull(form.get("capital_yen")), authorized_shares: numberOrNull(form.get("authorized_shares")),
      registered_issued_shares: numberOrNull(form.get("registered_issued_shares")), board_structure: textOrNull(form.get("board_structure")),
      has_board: form.get("has_board") === "on", has_auditor: form.get("has_auditor") === "on",
      fiscal_year_end_month: numberOrNull(form.get("fiscal_year_end_month")), public_notice_method: textOrNull(form.get("public_notice_method")),
      invoice_registration_number: textOrNull(form.get("invoice_registration_number")), source_ref: textOrNull(form.get("source_ref")),
      source_verified_on: textOrNull(form.get("source_verified_on")), notes: textOrNull(form.get("notes")),
    }));
  }




  async function saveFinancial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await save("年度決算", () => post("financial_period", {
      project_id: projectId, fiscal_year: numberOrNull(form.get("fiscal_year")), period_start_on: textOrNull(form.get("period_start_on")),
      period_end_on: textOrNull(form.get("period_end_on")), statement_status: form.get("statement_status"),
      revenue_yen: numberOrNull(form.get("revenue_yen")), operating_income_yen: numberOrNull(form.get("operating_income_yen")),
      ordinary_income_yen: numberOrNull(form.get("ordinary_income_yen")), net_income_yen: numberOrNull(form.get("net_income_yen")),
      total_assets_yen: numberOrNull(form.get("total_assets_yen")), total_liabilities_yen: numberOrNull(form.get("total_liabilities_yen")),
      net_assets_yen: numberOrNull(form.get("net_assets_yen")), cash_yen: numberOrNull(form.get("cash_yen")), debt_yen: numberOrNull(form.get("debt_yen")),
      filed_on: textOrNull(form.get("filed_on")), source_ref: textOrNull(form.get("source_ref")), notes: textOrNull(form.get("notes")),
    }));
  }

  async function saveMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const resolutions = String(form.get("resolutions") || "").split("\n").map((title) => title.trim()).filter(Boolean).map((title) => ({ title, result: "unknown" }));
    const attachmentName = textOrNull(form.get("attachment_name"));
    const attachmentUrl = textOrNull(form.get("attachment_url"));
    await save("総会・役会情報", () => post("meeting", {
      project_id: projectId, meeting_type: form.get("meeting_type"), meeting_date: textOrNull(form.get("meeting_date")),
      location: textOrNull(form.get("location")), agenda_summary: textOrNull(form.get("agenda_summary")), resolutions_json: resolutions,
      amd_response: form.get("amd_response"), attachments_json: attachmentUrl ? [{ name: attachmentName || "関連資料", url: attachmentUrl }] : [],
      source_ref: textOrNull(form.get("source_ref")), notes: textOrNull(form.get("notes")),
    }));
  }

  async function exportPdf() {
    if (!exportRef.current) return;
    setExportingPdf(true);
    setError("");
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(exportRef.current, { scale: 1.7, backgroundColor: "#f8fafc", useCORS: true, logging: false });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;
      const imageWidth = pageWidth - margin * 2;
      const imageHeight = canvas.height * imageWidth / canvas.width;
      const image = canvas.toDataURL("image/jpeg", 0.9);
      let offset = 0;
      while (offset < imageHeight) {
        if (offset > 0) pdf.addPage();
        pdf.addImage(image, "JPEG", margin, margin - offset, imageWidth, imageHeight, undefined, "FAST");
        offset += pageHeight - margin * 2;
      }
      pdf.save(`${projectName.replace(/[\\/:*?"<>|]/g, "_")}_会社概要_cap-table.pdf`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PDFを作れなかったよ");
    } finally {
      setExportingPdf(false);
    }
  }

  if (loading && !data.profile && data.transactions.length === 0) {
    return <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500"><Loader2 className="mr-2 size-4 animate-spin" />会社概要を読み込み中…</div>;
  }

  return (
    <div className="space-y-4" data-testid="company-overview-tab">
      <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-4 text-white sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><Building2 className="size-4 text-slate-300" /><h1 className="text-base font-semibold tracking-tight">{data.profile?.legal_name || projectName}</h1></div>
          <p className="mt-1 text-xs leading-5 text-slate-300">会社情報・資本政策・機関決定・決算を、全メンバーで更新するPJ正本</p>
        </div>
        <div className="flex flex-wrap gap-2" data-html2canvas-ignore="true">
          <Button variant="outline" className="h-11 border-slate-600 bg-slate-900 text-white hover:bg-slate-800 hover:text-white" onClick={() => downloadCompanyOverviewXlsx(projectName, data)}><FileSpreadsheet />会社概要Excel</Button>
          <Button variant="outline" className="h-11 border-slate-600 bg-slate-900 text-white hover:bg-slate-800 hover:text-white" onClick={() => void exportPdf()} disabled={exportingPdf}>{exportingPdf ? <Loader2 className="animate-spin" /> : <Download />}PDF</Button>
          <Button variant="outline" className="h-11 border-slate-600 bg-slate-900 text-white hover:bg-slate-800 hover:text-white" onClick={() => void load()}><RefreshCw />更新</Button>
        </div>
      </div>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><Check className="size-4" />{notice}</div>}

      <div ref={exportRef} className="space-y-4 rounded-2xl bg-slate-50">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between text-[11px] text-slate-500"><span>基本情報</span><Building2 className="size-4" /></div><div className="mt-2 text-xl font-semibold tabular-nums text-slate-950">{profileCompleteness}<span className="ml-1 text-xs font-normal text-slate-400">/ 6項目</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-slate-800" style={{ width: `${profileCompleteness / 6 * 100}%` }} /></div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between text-[11px] text-slate-500"><span>発行済株式</span><Users className="size-4" /></div><div className="mt-2 text-xl font-semibold tabular-nums text-slate-950">{formatNumber(latestSnapshot?.outstandingShares, 2)}<span className="ml-1 text-xs font-normal text-slate-400">株</span></div><p className={`mt-2 text-[11px] ${tieOut.state === "mismatch" ? "text-rose-600" : tieOut.state === "matched" ? "text-emerald-700" : "text-slate-500"}`}>{tieOut.state === "matched" ? "登記株式数と一致" : tieOut.state === "mismatch" ? `登記との差 ${formatNumber(tieOut.difference, 2)}株` : "登記株式数は未入力"}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between text-[11px] text-slate-500"><span>完全希薄化後</span><WalletCards className="size-4" /></div><div className="mt-2 text-xl font-semibold tabular-nums text-slate-950">{formatNumber(latestSnapshot?.dilutedShares, 2)}<span className="ml-1 text-xs font-normal text-slate-400">株</span></div><p className="mt-2 text-[11px] text-slate-500">転換見込を含む参考値 {formatNumber(conversion.proFormaDilutedShares, 2)}株</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between text-[11px] text-slate-500"><span>直近企業価値</span><Landmark className="size-4" /></div><div className="mt-2 text-xl font-semibold tabular-nums text-slate-950">{formatYen(selectedEquityValue)}</div><p className="mt-2 truncate text-[11px] text-slate-500">{latestRound?.round_name || "ラウンド未入力"}</p></div>
        </div>

        <Section title="基本情報" description="登記・定款・最新の確認資料に基づく会社の現在値" action={<Button variant="outline" className="h-11" onClick={() => setDialog("profile")}><Pencil />編集</Button>}>
          <div className="grid sm:grid-cols-2">
            <InfoCell label="法人状態 / 法人形態" value={`${LEGAL_STATUS.find((option) => option.value === data.profile?.legal_status)?.label || "設立前"} / ${data.profile?.entity_type || "未入力"}`} />
            <InfoCell label="法人番号" value={compactCorporateNumber(data.profile?.corporate_number)} />
            <InfoCell label="商号" value={data.profile?.legal_name} />
            <InfoCell label="英文商号" value={data.profile?.legal_name_en} />
            <InfoCell label="設立日 / 代表者" value={[data.profile?.incorporated_on && formatDate(data.profile.incorporated_on), data.profile?.representative_name].filter(Boolean).join(" / ")} />
            <InfoCell label="資本金 / 決算月" value={`${formatYen(data.profile?.capital_yen)} / ${data.profile?.fiscal_year_end_month ? `${data.profile.fiscal_year_end_month}月` : "未入力"}`} />
            <InfoCell label="本店所在地" value={data.profile?.head_office} wide />
            <InfoCell label="事業内容・定款目的" value={data.profile?.business_purpose} wide />
            <InfoCell label="機関設計" value={[data.profile?.board_structure, data.profile?.has_board == null ? null : data.profile.has_board ? "取締役会設置" : "取締役会非設置", data.profile?.has_auditor == null ? null : data.profile.has_auditor ? "監査役設置" : "監査役非設置"].filter(Boolean).join(" / ")} wide />
            <InfoCell label="公告方法" value={data.profile?.public_notice_method} />
            <InfoCell label="適格請求書発行事業者番号" value={data.profile?.invoice_registration_number} />
            <InfoCell label="確認元 / 確認日" value={[data.profile?.source_ref, data.profile?.source_verified_on && formatDate(data.profile.source_verified_on)].filter(Boolean).join(" / ")} wide />
          </div>
        </Section>

        <CockpitKillerFactorCatalog projectId={projectId} />




        <div className="grid gap-4 xl:grid-cols-2">
          <Section title="総会・取締役会" description="決議、AMD対応、関連資料を開催履歴と一緒に保存" action={<Button variant="outline" className="h-11" onClick={() => setDialog("meeting")}><Plus />開催情報</Button>}>
            {data.meetings.length === 0 ? <EmptyState>総会・取締役会の開催情報はまだないよ。</EmptyState> : <div className="divide-y divide-slate-100">{data.meetings.map((meeting) => <div key={meeting.id} className="px-4 py-4 sm:px-5"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold tabular-nums text-slate-900">{formatDate(meeting.meeting_date)}</span><span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-600">{meetingLabel(meeting.meeting_type)}</span>{meeting.amd_response && <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700">AMD: {meeting.amd_response}</span>}</div>{meeting.agenda_summary && <p className="mt-2 text-xs leading-5 text-slate-600">{meeting.agenda_summary}</p>}{meeting.resolutions_json?.length ? <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-slate-500">{meeting.resolutions_json.map((resolution, index) => <li key={index}>{resolution.title}</li>)}</ul> : null}{meeting.attachments_json?.length ? <div className="mt-3 flex flex-wrap gap-2">{meeting.attachments_json.map((attachment, index) => sourceHref(attachment) ? <a key={index} href={sourceHref(attachment)} target="_blank" rel="noopener noreferrer" className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-50 hover:underline">資料: {attachment.name || index + 1}</a> : null)}</div> : null}</div>)}</div>}
          </Section>

          <Section title="年度決算" description="月次の経営PLとは分け、確定・申告した年度数値を保存" action={<Button variant="outline" className="h-11" onClick={() => setDialog("financial")}><Plus />決算</Button>}>
            {data.financialPeriods.length === 0 ? <EmptyState>年度決算はまだ入力されていないよ。</EmptyState> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-xs"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-4 py-3 text-left font-medium">年度</th><th className="px-3 py-3 text-left font-medium">状態</th><th className="px-3 py-3 text-right font-medium">売上高</th><th className="px-3 py-3 text-right font-medium">営業利益</th><th className="px-3 py-3 text-right font-medium">純利益</th><th className="px-4 py-3 text-right font-medium">純資産</th></tr></thead><tbody className="divide-y divide-slate-100">{data.financialPeriods.map((period) => <tr key={period.id}><td className="px-4 py-3 font-semibold tabular-nums text-slate-900">{period.fiscal_year}</td><td className="px-3 py-3 text-slate-600">{statusLabel(period.statement_status)}</td><td className="px-3 py-3 text-right tabular-nums">{formatYen(period.revenue_yen)}</td><td className={`px-3 py-3 text-right tabular-nums ${Number(period.operating_income_yen) < 0 ? "text-rose-600" : ""}`}>{formatYen(period.operating_income_yen)}</td><td className={`px-3 py-3 text-right tabular-nums ${Number(period.net_income_yen) < 0 ? "text-rose-600" : ""}`}>{formatYen(period.net_income_yen)}</td><td className="px-4 py-3 text-right tabular-nums">{formatYen(period.net_assets_yen)}</td></tr>)}</tbody></table></div>}
          </Section>
        </div>

        {data.actionItems.length > 0 && <Section title="会社運営の要対応" description="総会・登記・株主対応など、期限が残っているもの"><div className="divide-y divide-slate-100">{data.actionItems.map((item) => <div key={item.action_id} className="flex items-start gap-3 px-4 py-3 sm:px-5"><Scale className="mt-0.5 size-4 shrink-0 text-slate-400" /><div className="min-w-0 flex-1"><div className="text-xs font-medium text-slate-900">{item.title}</div>{item.summary && <p className="mt-1 text-[11px] leading-5 text-slate-500">{item.summary}</p>}</div><span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] ${item.due_at && new Date(item.due_at).getTime() < Date.now() ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{item.due_at ? formatDate(item.due_at.slice(0, 10)) : "期日なし"}</span></div>)}</div></Section>}
      </div>

      <Dialog open={dialog === "profile"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-3xl"><form onSubmit={(event) => void saveProfile(event)}><DialogHeader><DialogTitle>会社基本情報を編集</DialogTitle><DialogDescription>登記・定款など、確認した資料を確認元に残してね。</DialogDescription></DialogHeader><div className="my-5 grid gap-4 sm:grid-cols-2">
        <Field label="法人状態"><NativeSelect name="legal_status" defaultValue={data.profile?.legal_status || "pre_incorporation"} options={LEGAL_STATUS} /></Field>
        <Field label="法人形態" name="entity_type"><Input id="entity_type" name="entity_type" defaultValue={data.profile?.entity_type || "株式会社"} className="h-11" /></Field>
        <Field label="商号" name="legal_name"><Input id="legal_name" name="legal_name" defaultValue={data.profile?.legal_name || ""} className="h-11" /></Field>
        <Field label="英文商号" name="legal_name_en"><Input id="legal_name_en" name="legal_name_en" defaultValue={data.profile?.legal_name_en || ""} className="h-11" /></Field>
        <Field label="法人番号" name="corporate_number"><Input id="corporate_number" name="corporate_number" defaultValue={data.profile?.corporate_number || ""} inputMode="numeric" className="h-11" /></Field>
        <Field label="設立日" name="incorporated_on" hint="YYYY-MM-DD"><Input id="incorporated_on" name="incorporated_on" defaultValue={data.profile?.incorporated_on || ""} placeholder="2026-07-16" className="h-11" /></Field>
        <Field label="代表者" name="representative_name"><Input id="representative_name" name="representative_name" defaultValue={data.profile?.representative_name || ""} className="h-11" /></Field>
        <Field label="決算月" name="fiscal_year_end_month"><Input id="fiscal_year_end_month" name="fiscal_year_end_month" defaultValue={data.profile?.fiscal_year_end_month || ""} inputMode="numeric" placeholder="12" className="h-11" /></Field>
        <div className="sm:col-span-2"><Field label="本店所在地" name="head_office"><Input id="head_office" name="head_office" defaultValue={data.profile?.head_office || ""} className="h-11" /></Field></div>
        <div className="sm:col-span-2"><Field label="事業内容・定款目的" name="business_purpose"><Textarea id="business_purpose" name="business_purpose" defaultValue={data.profile?.business_purpose || ""} rows={4} /></Field></div>
        <Field label="資本金（円）" name="capital_yen"><Input id="capital_yen" name="capital_yen" defaultValue={data.profile?.capital_yen || ""} inputMode="numeric" className="h-11" /></Field>
        <Field label="発行可能株式総数" name="authorized_shares"><Input id="authorized_shares" name="authorized_shares" defaultValue={data.profile?.authorized_shares || ""} inputMode="decimal" className="h-11" /></Field>
        <Field label="登記上の発行済株式数" name="registered_issued_shares"><Input id="registered_issued_shares" name="registered_issued_shares" defaultValue={data.profile?.registered_issued_shares || ""} inputMode="decimal" className="h-11" /></Field>
        <Field label="機関設計" name="board_structure"><Input id="board_structure" name="board_structure" defaultValue={data.profile?.board_structure || ""} placeholder="取締役1名・監査役非設置" className="h-11" /></Field>
        <div className="flex items-center gap-6 rounded-xl border border-slate-200 px-4 py-3 sm:col-span-2"><label className="flex min-h-8 items-center gap-2 text-xs"><input type="checkbox" name="has_board" defaultChecked={data.profile?.has_board || false} className="size-4 accent-slate-900" />取締役会設置</label><label className="flex min-h-8 items-center gap-2 text-xs"><input type="checkbox" name="has_auditor" defaultChecked={data.profile?.has_auditor || false} className="size-4 accent-slate-900" />監査役設置</label></div>
        <Field label="公告方法" name="public_notice_method"><Input id="public_notice_method" name="public_notice_method" defaultValue={data.profile?.public_notice_method || ""} className="h-11" /></Field>
        <Field label="適格請求書発行事業者番号" name="invoice_registration_number"><Input id="invoice_registration_number" name="invoice_registration_number" defaultValue={data.profile?.invoice_registration_number || ""} className="h-11" /></Field>
        <Field label="確認元" name="source_ref"><Input id="source_ref" name="source_ref" defaultValue={data.profile?.source_ref || ""} placeholder="登記簿 / 定款 / Drive資料名" className="h-11" /></Field>
        <Field label="確認日" name="source_verified_on"><Input id="source_verified_on" name="source_verified_on" defaultValue={data.profile?.source_verified_on || ""} placeholder="2026-07-16" className="h-11" /></Field>
        <div className="sm:col-span-2"><Field label="メモ" name="notes"><Textarea id="notes" name="notes" defaultValue={data.profile?.notes || ""} /></Field></div>
      </div><DialogFooter><Button type="button" variant="outline" className="h-11" onClick={() => setDialog(null)}>閉じる</Button><Button type="submit" className="h-11" disabled={saving}>{saving && <Loader2 className="animate-spin" />}保存</Button></DialogFooter></form></DialogContent></Dialog>




      <Dialog open={dialog === "financial"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-3xl"><form onSubmit={(event) => void saveFinancial(event)}><DialogHeader><DialogTitle>年度決算を追加・更新</DialogTitle><DialogDescription>同じ年度を保存すると、その年度の数値を更新するよ。</DialogDescription></DialogHeader><div className="my-5 grid gap-4 sm:grid-cols-3">
        <Field label="年度" name="fiscal_year"><Input id="fiscal_year" name="fiscal_year" required inputMode="numeric" defaultValue={new Date().getFullYear()} className="h-11" /></Field><Field label="状態"><NativeSelect name="statement_status" defaultValue="draft" options={[{ value: "draft", label: "下書き" }, { value: "final", label: "確定" }, { value: "filed", label: "申告済み" }]} /></Field><Field label="申告日" name="filed_on"><Input id="filed_on" name="filed_on" className="h-11" /></Field>
        <Field label="期間開始" name="period_start_on"><Input id="period_start_on" name="period_start_on" className="h-11" /></Field><Field label="期間終了" name="period_end_on"><Input id="period_end_on" name="period_end_on" className="h-11" /></Field><Field label="確認元" name="source_ref"><Input id="source_ref" name="source_ref" className="h-11" /></Field>
        {["revenue_yen:売上高", "operating_income_yen:営業利益", "ordinary_income_yen:経常利益", "net_income_yen:当期純利益", "total_assets_yen:総資産", "total_liabilities_yen:負債", "net_assets_yen:純資産", "cash_yen:現預金", "debt_yen:有利子負債"].map((entry) => { const [name, label] = entry.split(":"); return <Field key={name} label={`${label}（円）`} name={name}><Input id={name} name={name} inputMode="numeric" className="h-11" /></Field>; })}
        <div className="sm:col-span-3"><Field label="メモ" name="notes"><Textarea id="notes" name="notes" /></Field></div>
      </div><DialogFooter><Button type="button" variant="outline" className="h-11" onClick={() => setDialog(null)}>閉じる</Button><Button type="submit" className="h-11" disabled={saving}>保存</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={dialog === "meeting"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-2xl"><form onSubmit={(event) => void saveMeeting(event)}><DialogHeader><DialogTitle>総会・取締役会を追加</DialogTitle><DialogDescription>招集・決議・AMDの対応・資料を、同じ開催記録へまとめるよ。</DialogDescription></DialogHeader><div className="my-5 grid gap-4 sm:grid-cols-2">
        <Field label="種別"><NativeSelect name="meeting_type" defaultValue="board" options={MEETING_TYPES} /></Field><Field label="開催日" name="meeting_date"><Input id="meeting_date" name="meeting_date" required className="h-11" /></Field>
        <Field label="場所・方法" name="location"><Input id="location" name="location" placeholder="オンライン / 本店 / 書面" className="h-11" /></Field><Field label="AMD対応"><NativeSelect name="amd_response" defaultValue="none" options={[{ value: "none", label: "未対応" }, { value: "attended", label: "出席" }, { value: "proxy", label: "委任状提出" }, { value: "consented", label: "事前承諾" }, { value: "abstained", label: "棄権" }]} /></Field>
        <div className="sm:col-span-2"><Field label="議題概要" name="agenda_summary"><Textarea id="agenda_summary" name="agenda_summary" /></Field></div><div className="sm:col-span-2"><Field label="決議（1行1件）" name="resolutions"><Textarea id="resolutions" name="resolutions" /></Field></div>
        <Field label="資料名" name="attachment_name"><Input id="attachment_name" name="attachment_name" className="h-11" /></Field><Field label="資料URL" name="attachment_url"><Input id="attachment_url" name="attachment_url" inputMode="url" className="h-11" /></Field>
        <Field label="確認元" name="source_ref"><Input id="source_ref" name="source_ref" className="h-11" /></Field><Field label="メモ" name="notes"><Input id="notes" name="notes" className="h-11" /></Field>
      </div><DialogFooter><Button type="button" variant="outline" className="h-11" onClick={() => setDialog(null)}>閉じる</Button><Button type="submit" className="h-11" disabled={saving}>追加</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
  );
}
