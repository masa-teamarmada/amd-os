"use client";

import { Fragment, useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, FileCheck2, FileText, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, textOrNull } from "@/components/cockpit/company-overview-ui";
import { AmieListCategory, AmieListStatus } from "@/components/ui/amie-list-signals";
import { loadGovernance, peekGovernance, saveGovernanceEntity } from "@/lib/governance-client";
import { GOVERNANCE_MEETING_TYPES, governanceMeetingKind, governanceMeetingLabel, type GovernanceMeetingKind } from "@/lib/governance-meeting-kind";
import type { CompanyMeeting, CompanyOverviewData } from "@/lib/company-overview";
import { filterGovernanceMeetings, governanceMeetingDateLabel, governanceMeetingResults, governanceMeetingYear, governanceResponseLabel, governanceResultLabel, governanceResultTone } from "@/lib/governance-meeting-presentation";
import styles from "./ProjectGovernanceMeetingPage.module.css";

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
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const resolutionHeadingId = `${detailId}-resolutions`;
  const resolutions = meeting.resolutions_json ?? [];
  const attachments = (meeting.attachments_json ?? []).filter((attachment) => sourceHref(attachment));
  const results = governanceMeetingResults(meeting);
  const date = governanceMeetingDateLabel(meeting);
  const label = governanceMeetingLabel(meeting.meeting_type);
  const category = label.startsWith("取締役決定") ? "取締役決定" : label;
  const agenda = meeting.agenda_summary || resolutions[0]?.title || "議題未登録";
  return <Fragment>
    <tr className={styles.record} data-expanded={expanded} data-governance-meeting-id={meeting.id} onClick={(event) => {
      // Native buttons handle their own activation, including Enter and Space.
      if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea, summary, [role='button']")) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && event.currentTarget.contains(selection.anchorNode)) return;
      setExpanded((current) => !current);
    }}>
      <td><time className={styles.date} dateTime={meeting.meeting_date ?? undefined}>{date}</time><AmieListCategory value={category} title={label} className={styles.kind}>{category}</AmieListCategory></td>
      <td><button type="button" className={styles.agendaButton} aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpanded(!expanded)} title={agenda}><span className={styles.summary}>{agenda}</span></button></td>
      <td><div className={styles.result}><AmieListStatus label={results[0] || "未登録"} tone={governanceResultTone(results[0] || "")} />{results.length > 1 && <span className={styles.more} title={results.join(" / ")}>+{results.length - 1}</span>}</div><span className={styles.resolutionCount}>決議 {resolutions.length}件</span></td>
      <td>{attachments.length ? <button type="button" className={styles.rowButton} aria-label={`${date}の資料 ${attachments.length}件`} aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpanded(!expanded)}><FileText aria-hidden="true" />{attachments.length}件</button> : <span className={styles.muted}>未登録</span>}</td>
      <td><button type="button" className={styles.rowButton} aria-label={`${date}の詳細を${expanded ? "閉じる" : "開く"}`} aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpanded(!expanded)}>{expanded ? "閉じる" : "詳細"}{expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</button></td>
    </tr>
    <tr id={detailId} hidden={!expanded}><td colSpan={5} className={styles.detailCell}><div className={styles.detail}>
      <div className={styles.detailGrid}>
      <section className={styles.resolutionSection} aria-labelledby={resolutionHeadingId}>
      <div className={styles.resolutionHeading}><FileCheck2 aria-hidden="true" /><h3 id={resolutionHeadingId}>決議事項</h3><span>{resolutions.length}件</span></div>
      {resolutions.length ? <table className={styles.resolutions} aria-label={`${date}の決議事項`}>
        <colgroup><col className={styles.resolutionNumber} /><col /><col className={styles.resolutionResult} /></colgroup>
        <thead><tr><th scope="col">No.</th><th scope="col">議案</th><th scope="col">結果</th></tr></thead>
        <tbody>{resolutions.map((resolution, index) => <tr key={index}><td className={styles.resolutionNumber}><span className={styles.resolutionIndex}>{index + 1}</span></td><td className={styles.resolutionTitle}>{resolution.title || "議案名未登録"}</td><td><AmieListStatus label={governanceResultLabel(resolution.result || "")} title={resolution.result || "未確認"} tone={governanceResultTone(resolution.result || "")} className={styles.fullResult} /></td></tr>)}</tbody>
      </table> : <p className={styles.muted}>決議事項未登録</p>}
      </section>
      <aside className={styles.files} aria-label={`${date}の関連資料`}><h3>資料{attachments.length > 0 && ` ${attachments.length}件`}</h3>
        {attachments.length ? <ul className={styles.fileList}>{attachments.map((attachment, index) => <li key={index}><a href={sourceHref(attachment)} target="_blank" rel="noopener noreferrer"><FileText aria-hidden="true" /><span>{attachment.name || `資料${index + 1}`}</span></a></li>)}</ul> : <p className={styles.muted}>資料未登録</p>}
      </aside>
      </div>
      <details className={styles.notes}>
        <summary>記録情報</summary>
        <div className={styles.detailTop}>
          <p>種別：{label}</p>
          {meeting.location && <p>場所・方法：{meeting.location}</p>}
          {meeting.amd_response && meeting.amd_response !== "none" && <p>AMDの対応：{governanceResponseLabel(meeting.amd_response)}</p>}
        </div>
        {meeting.agenda_summary && <p>{meeting.agenda_summary}</p>}
        {meeting.notes && <p>{meeting.notes}</p>}
        {meeting.source_ref && <p>確認元：{meeting.source_ref}</p>}
      </details>
    </div></td></tr>
  </Fragment>;
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
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
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
  const visibleMeetings = filterGovernanceMeetings(meetings, query, year);
  const years = [...new Set(meetings.map(governanceMeetingYear).filter(Boolean))].sort().reverse();

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

  return <div className={`min-w-0 ${styles.page}`} data-testid={`${kind}-meeting-page`}>
    <div className={styles.header}>
      <div className={styles.titleGroup}><h2 className={styles.title}>{label}</h2><span className={styles.count}>{data ? `${meetings.length}件` : ""}</span></div>
      <div className={styles.actions}>
        <Button variant="outline" className="h-9" onClick={() => void load(true)} disabled={loading} aria-label={`${label}の記録を更新`}><RefreshCw aria-hidden="true" className={loading ? "animate-spin" : ""} />更新</Button>
        {!readOnly && <Button className="h-9" onClick={() => { setError(""); setDialogOpen(true); }}><Plus aria-hidden="true" />記録を追加</Button>}
      </div>
    </div>
    {unknownCount > 0 && <p className={styles.info}>種別未判定：{unknownCount}件</p>}
    {error && !dialogOpen && <div role="alert" className={styles.error}><AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-rose-700" />{error}</div>}
    {notice && <div role="status" className={styles.info}>{notice}</div>}
    <div className={styles.toolbar}>
      <div className={styles.search}><Search aria-hidden="true" /><Input type="search" name="meeting_search" aria-label="議題・決議・資料を検索" placeholder="議題・決議・資料を検索" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <select className={styles.select} aria-label="記録の年" value={year} onChange={(event) => setYear(event.target.value)}><option value="">すべての年</option>{years.map((value) => <option key={value} value={value}>{value}年</option>)}</select>
      {(query || year) && <Button variant="ghost" className="h-9" onClick={() => { setQuery(""); setYear(""); }}>絞り込みを解除</Button>}
      <span className={styles.filteredCount} role="status">{query || year ? `${visibleMeetings.length} / ${meetings.length}件` : "日付の新しい順"}</span>
    </div>
    <div className={styles.tableWrap} aria-busy={loading}>
      {loading && !data ? <div className={`${styles.empty} flex items-center justify-center gap-2`} role="status"><Loader2 aria-hidden="true" className="size-4 animate-spin" />読み込み中…</div>
        : error && !data ? <div className={styles.empty}>記録を取得できませんでした。更新から再試行できます。</div>
        : meetings.length ? <table className={styles.table} data-amie-list="records" aria-label={`${label}の記録`}>
          <colgroup><col className={styles.dateColumn} /><col /><col className={styles.resultColumn} /><col className={styles.filesColumn} /><col className={styles.detailColumn} /></colgroup>
          <thead><tr><th scope="col">日付・種別</th><th scope="col">議題</th><th scope="col">決議結果</th><th scope="col">資料</th><th scope="col"><span className="sr-only">詳細</span></th></tr></thead>
          <tbody>{visibleMeetings.length ? visibleMeetings.map((meeting) => <MeetingRecord key={meeting.id} meeting={meeting} />) : <tr><td colSpan={5}><div className={styles.empty}>条件に一致する記録はありません</div></td></tr>}</tbody>
        </table> : <div className={styles.empty}>{label}の記録は未登録</div>}
    </div>
    <Dialog open={dialogOpen} onOpenChange={(open) => { if (!saving) setDialogOpen(open); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-3xl" showCloseButton={false}>
      <form onSubmit={(event) => void saveMeeting(event)}><DialogHeader><DialogTitle>{label}の記録を追加</DialogTitle><DialogDescription>確認した結果と元資料を入力</DialogDescription></DialogHeader>
        {error && <div role="alert" className="mt-3 text-sm text-rose-700">{error}</div>}
        <div className={styles.formSection}>
          <Field label="種別" name="meeting_type"><select id="meeting_type" name="meeting_type" defaultValue={GOVERNANCE_MEETING_TYPES[kind][0].value} className={`${styles.select} ${styles.formSelect}`}>{GOVERNANCE_MEETING_TYPES[kind].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
          <Field label="決定日" name="meeting_date"><Input id="meeting_date" name="meeting_date" type="date" required className="h-10" /></Field>
          <Field label="場所・方法" name="location"><Input id="location" name="location" placeholder="本店 / 書面" className="h-10" /></Field>
          <Field label="結果" name="result"><select id="result" name="result" defaultValue="未確認" className={`${styles.select} ${styles.formSelect}`}>{RESULTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
          <Field label="AMD対応" name="amd_response"><select id="amd_response" name="amd_response" defaultValue="none" className={`${styles.select} ${styles.formSelect}`}>{AMD_RESPONSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
          <Field label="確認元" name="source_ref"><Input id="source_ref" name="source_ref" className="h-10" /></Field>
          <div className="sm:col-span-2"><Field label="議題概要" name="agenda_summary"><Textarea id="agenda_summary" name="agenda_summary" /></Field></div>
          <div className="sm:col-span-2"><Field label="決議事項（1行1件）" name="resolutions"><Textarea id="resolutions" name="resolutions" /></Field></div>
          <Field label="資料名" name="attachment_name"><Input id="attachment_name" name="attachment_name" className="h-10" /></Field>
          <Field label="資料のアドレス" name="attachment_url"><Input id="attachment_url" name="attachment_url" type="url" className="h-10" /></Field>
          <div className="sm:col-span-2"><Field label="注記" name="notes"><Input id="notes" name="notes" className="h-10" /></Field></div>
        </div>
        <DialogFooter><Button type="button" variant="outline" className="h-10" onClick={() => setDialogOpen(false)} disabled={saving}>閉じる</Button><Button type="submit" className="h-10" disabled={saving}>{saving && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}保存</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </div>;
}
