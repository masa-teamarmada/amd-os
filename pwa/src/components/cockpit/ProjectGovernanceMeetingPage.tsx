"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Loader2, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, Field, NativeSelect, Section, formatDate, textOrNull } from "@/components/cockpit/company-overview-ui";
import { loadGovernance, peekGovernance, saveGovernanceEntity } from "@/lib/governance-client";
import { GOVERNANCE_MEETING_TYPES, governanceMeetingKind, governanceMeetingLabel, type GovernanceMeetingKind } from "@/lib/governance-meeting-kind";
import type { CompanyMeeting, CompanyOverviewData } from "@/lib/company-overview";

const PAGE_LABEL = { shareholder: "株主総会", board: "取締役会" } as const;
const RESULTS = [
  { value: "未確認", label: "未確認" },
  { value: "可決", label: "可決" },
  { value: "否決", label: "否決" },
  { value: "継続審議", label: "継続審議" },
];
const AMD_RESPONSES = [
  { value: "none", label: "未対応" },
  { value: "attended", label: "出席" },
  { value: "proxy", label: "委任状提出" },
  { value: "consented", label: "事前承諾" },
  { value: "abstained", label: "棄権" },
];

function sourceHref(attachment: { url?: string; webViewLink?: string; web_view_link?: string }): string {
  const value = attachment.url || attachment.webViewLink || attachment.web_view_link || "";
  return /^https?:\/\//i.test(value) ? value : "";
}

function MeetingRecord({ meeting }: { meeting: CompanyMeeting }) {
  const resolutions = meeting.resolutions_json ?? [];
  const attachments = (meeting.attachments_json ?? []).filter((attachment) => sourceHref(attachment));
  return <article className="px-4 py-5 sm:px-5" data-governance-meeting-id={meeting.id}>
    <div className="flex flex-wrap items-center gap-2">
      <time className="text-sm font-semibold tabular-nums text-slate-950" dateTime={meeting.meeting_date ?? undefined}>{formatDate(meeting.meeting_date ?? meeting.meeting_ym)}</time>
      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">{governanceMeetingLabel(meeting.meeting_type)}</span>
    </div>
    {meeting.agenda_summary && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{meeting.agenda_summary}</p>}
    {meeting.location && <p className="mt-2 text-xs text-slate-500">場所・方法：{meeting.location}</p>}
    {meeting.amd_response && meeting.amd_response !== "none" && <p className="mt-2 text-xs text-slate-500">AMDの対応：{meeting.amd_response}</p>}
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-slate-700">決議事項</h3>
      {resolutions.length ? <ol className="mt-2 space-y-2">
        {resolutions.map((resolution, index) => <li key={`${index}-${resolution.title ?? ""}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-900">{resolution.title || "議案名未登録"}</p>
          <p className="mt-1 text-xs text-slate-600">結果：{resolution.result || "未確認"}</p>
        </li>)}
      </ol> : <p className="mt-2 text-sm text-slate-500">決議事項未登録</p>}
    </div>
    {attachments.length > 0 && <div className="mt-4 flex flex-wrap gap-2" aria-label="資料">
      {attachments.map((attachment, index) => <a key={`${index}-${sourceHref(attachment)}`} href={sourceHref(attachment)} target="_blank" rel="noopener noreferrer" className="max-w-full break-all rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:underline">{attachment.name || `資料${index + 1}`}</a>)}
    </div>}
    {(meeting.notes || meeting.source_ref) && <details className="mt-4 text-xs text-slate-600">
      <summary className="w-fit cursor-pointer font-medium text-slate-700">確認内容・注記</summary>
      {meeting.notes && <p className="mt-2 whitespace-pre-wrap leading-5">{meeting.notes}</p>}
      {meeting.source_ref && <p className="mt-2 break-all leading-5">確認元：{meeting.source_ref}</p>}
    </details>}
  </article>;
}

export function ProjectGovernanceMeetingPage({ projectId, kind, readOnly = false }: {
  projectId: string;
  kind: GovernanceMeetingKind;
  readOnly?: boolean;
}) {
  const [data, setData] = useState<CompanyOverviewData | null>(() => peekGovernance(projectId) ?? null);
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const label = PAGE_LABEL[kind];

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try { setData(await loadGovernance(projectId, { force })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "記録を読み込めませんでした"); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  const meetings = (data?.meetings ?? []).filter((meeting) => governanceMeetingKind(meeting.meeting_type) === kind);
  const unknownCount = (data?.meetings ?? []).filter((meeting) => governanceMeetingKind(meeting.meeting_type) === null).length;

  async function saveMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const resolutions = String(form.get("resolutions") || "").split("\n").map((title) => title.trim()).filter(Boolean)
      .map((title) => ({ title, result: String(form.get("result") || "未確認") }));
    const attachmentUrl = textOrNull(form.get("attachment_url"));
    setSaving(true);
    setError("");
    try {
      await saveGovernanceEntity(projectId, "meeting", {
        project_id: projectId,
        meeting_type: form.get("meeting_type"),
        meeting_date: textOrNull(form.get("meeting_date")),
        location: textOrNull(form.get("location")),
        agenda_summary: textOrNull(form.get("agenda_summary")),
        amd_response: form.get("amd_response"),
        resolutions_json: resolutions,
        attachments_json: attachmentUrl ? [{ name: textOrNull(form.get("attachment_name")) || "関連資料", url: attachmentUrl }] : [],
        source_ref: textOrNull(form.get("source_ref")),
        notes: textOrNull(form.get("notes")),
      });
      await load();
      setDialogOpen(false);
      setNotice("記録を保存しました");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存できませんでした"); }
    finally { setSaving(false); }
  }

  return <div className="min-w-0 space-y-4" data-testid={`${kind}-meeting-page`}>
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5">
      <div className="min-w-0 flex-1"><h1 className="text-lg font-semibold text-slate-950">{label}</h1><p className="mt-1 text-xs text-slate-500">記録 {meetings.length}件</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-10" onClick={() => void load(true)} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />更新</Button>
        {!readOnly && <Button className="h-10" onClick={() => setDialogOpen(true)}><Plus />記録を追加</Button>}
      </div>
    </div>
    {kind === "board" && data?.profile?.has_board === false && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">会社概要の機関設計：取締役会非設置。取締役決定の資料は種別を区別して掲載。</p>}
    {unknownCount > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">種別未判定の機関記録：{unknownCount}件。登録種別を確認してください。</p>}
    {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertTriangle className="size-4 shrink-0" />{error}</div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
    <Section title={`${label}の記録`}>
      {loading && !data ? <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" />読み込み中…</div>
        : meetings.length ? <div className="divide-y divide-slate-200">{meetings.map((meeting) => <MeetingRecord key={meeting.id} meeting={meeting} />)}</div>
        : <EmptyState>{label}の記録は未登録</EmptyState>}
    </Section>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-2xl">
      <form onSubmit={(event) => void saveMeeting(event)}><DialogHeader><DialogTitle>{label}の記録を追加</DialogTitle><DialogDescription>確認した結果と元資料を入力</DialogDescription></DialogHeader>
        <div className="my-5 grid gap-4 sm:grid-cols-2">
          <Field label="種別"><NativeSelect key={kind} name="meeting_type" defaultValue={GOVERNANCE_MEETING_TYPES[kind][0].value} options={[...GOVERNANCE_MEETING_TYPES[kind]]} /></Field>
          <Field label="決定日" name="meeting_date"><Input id="meeting_date" name="meeting_date" type="date" required className="h-11" /></Field>
          <Field label="場所・方法" name="location"><Input id="location" name="location" placeholder="本店 / 書面" className="h-11" /></Field>
          <Field label="結果"><NativeSelect name="result" defaultValue="未確認" options={RESULTS} /></Field>
          <Field label="AMD対応"><NativeSelect name="amd_response" defaultValue="none" options={AMD_RESPONSES} /></Field>
          <div className="sm:col-span-2"><Field label="議題概要" name="agenda_summary"><Textarea id="agenda_summary" name="agenda_summary" /></Field></div>
          <div className="sm:col-span-2"><Field label="決議事項（1行1件）" name="resolutions"><Textarea id="resolutions" name="resolutions" /></Field></div>
          <Field label="資料名" name="attachment_name"><Input id="attachment_name" name="attachment_name" className="h-11" /></Field>
          <Field label="資料のアドレス" name="attachment_url"><Input id="attachment_url" name="attachment_url" type="url" className="h-11" /></Field>
          <Field label="確認元" name="source_ref"><Input id="source_ref" name="source_ref" className="h-11" /></Field>
          <Field label="注記" name="notes"><Input id="notes" name="notes" className="h-11" /></Field>
        </div>
        <DialogFooter><Button type="button" variant="outline" className="h-11" onClick={() => setDialogOpen(false)}>閉じる</Button><Button type="submit" className="h-11" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}保存</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </div>;
}
