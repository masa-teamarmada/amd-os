"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CONTRACT_NEXT_ACTION, type ProjectContractEvidenceData, type ProjectContractListData } from "@/lib/project-contract-list";
import { filterProjectContracts, type ContractListSort } from "@/lib/project-contract-list-view";
import { loadProjectContracts, loadProjectContractEvidence, setContractDdVisibility } from "@/lib/project-contract-list-client";

const STATUS_LABELS = { planned: "締結予定", drafting: "草案作成中", under_review: "契約書確認中", awaiting_signature: "署名待ち", signed: "締結済み", stalled: "協議停滞", cancelled: "中止" };
const linkClass = "text-[#1976b9] underline decoration-[#1976b9]/40 underline-offset-2 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2";
const controlClass = "h-11 rounded border border-[#d8d8dc] bg-white px-2 text-sm sm:h-8";
function eventDate(value: string | null | undefined, includeTime = false) {
  const date = new Date(value ?? "");
  if (Number.isNaN(date.getTime())) return "未確認";
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", ...(includeTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}) }).format(date);
}
export function ProjectContractList({ projectId, initialData }: { projectId: string; initialData?: ProjectContractListData }) {
  const [data, setData] = useState<ProjectContractListData | null>(initialData ?? null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<ContractListSort>("updated");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const [evidence, setEvidence] = useState<ProjectContractEvidenceData | null>(null);
  const [detailError, setDetailError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [detailAttempt, setDetailAttempt] = useState(0);
  useEffect(() => {
    if (initialData) return;
    let cancelled = false;
    loadProjectContracts(projectId).then(value => { if (!cancelled) setData(value); }).catch(() => { if (!cancelled) setError("契約リストを取得できません。"); });
    return () => { cancelled = true; };
  }, [initialData, projectId]);
  useEffect(() => {
    if (!selectedId || !data?.canReadEvidence) return;
    let cancelled = false;
    setDetailError(""); setEvidence(null); setLoadingMore(false);
    loadProjectContractEvidence(projectId, selectedId).then(value => { if (!cancelled) setEvidence(value); }).catch(() => { if (!cancelled) setDetailError("文書・経緯を取得できません。"); });
    return () => { cancelled = true; };
  }, [selectedId, projectId, data?.canReadEvidence, detailAttempt]);
  async function toggle(contractId: string, ddVisible: boolean) {
    setSaving(contractId); setError("");
    try { setData(await setContractDdVisibility(projectId, contractId, ddVisible)); }
    catch { setError("DDの表示設定を保存できません。"); }
    finally { setSaving(null); }
  }
  function prefetch(contractId: string) {
    if (data?.canReadEvidence) void loadProjectContractEvidence(projectId, contractId).catch(() => {});
  }
  async function olderHistory() {
    if (!evidence?.nextHistoryCursor || loadingMore) return;
    const id = evidence.contractId;
    setLoadingMore(true); setDetailError("");
    try {
      const page = await loadProjectContractEvidence(projectId, id, evidence.nextHistoryCursor);
      if (selectedRef.current !== id) return;
      setEvidence(previous => previous?.contractId === id ? { ...previous, history: [...previous.history, ...page.history.filter(event => !previous.history.some(existing => existing.id === event.id))], nextHistoryCursor: page.nextHistoryCursor } : previous);
    } catch { if (selectedRef.current === id) setDetailError("過去の経緯を取得できません。もう一度読み込めるよ。"); }
    finally { if (selectedRef.current === id) setLoadingMore(false); }
  }
  const rows = filterProjectContracts(data?.contracts ?? [], search, status, sort);
  const selected = data?.contracts.find(row => row.contractId === selectedId);
  const currentEvidence = evidence?.contractId === selectedId ? evidence : null;
  const hasEvidence = !!data?.canReadEvidence;
  return (
    <section className="space-y-2" data-testid="project-contract-list">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-1 text-base font-semibold">契約リスト</h2>
        {data && <span className="text-xs text-[#6e6e73]">{rows.length} / {data.contracts.length}件</span>}
        <input aria-label="契約を検索" placeholder="契約名・当事者・版を検索" value={search} onChange={event => setSearch(event.target.value)} className={`${controlClass} ml-auto min-w-0 flex-1 sm:max-w-64`} />
        <select aria-label="契約の状態で絞り込み" value={status} onChange={event => setStatus(event.target.value)} className={controlClass}><option value="">全ての状態</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select aria-label="契約の並び順" value={sort} onChange={event => setSort(event.target.value as ContractListSort)} className={controlClass}><option value="updated">最終更新順</option><option value="title">契約名順</option><option value="status">状態順</option></select>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!data ? <p className="py-2 text-sm text-[#6e6e73]">読み込み中…</p> : <div className="overflow-x-auto rounded border border-[#e5e5e7] bg-white">
        <table className="w-full min-w-[920px] table-fixed text-[13px] leading-5" data-testid="contract-summary-table">
          <colgroup><col className="w-[28%]" /><col className="w-[10%]" />{hasEvidence && <col className="w-[20%]" />}<col className="w-[11%]" />{hasEvidence && <col className="w-[14%]" />}<col className="w-[17%]" />{data.canManage && <col className="w-16" />}</colgroup>
          <thead className="bg-[#f5f5f7] text-left text-xs text-[#6e6e73]"><tr>{["契約・当事者", "状態", ...(hasEvidence ? ["最新版"] : []), "最終更新", ...(hasEvidence ? ["次の対応"] : []), "締結・期間", ...(data.canManage ? ["DD"] : [])].map(label => <th key={label} scope="col" className="px-3 py-2 font-medium">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#e5e5e7]">{rows.map(row => <tr key={row.contractId} className="align-top hover:bg-[#f5f8fb]">
            <td className="px-3 py-1.5">
              {hasEvidence ? <button type="button" className={`${linkClass} block min-h-11 w-full truncate text-left font-medium sm:min-h-0`} title={row.title} onClick={() => setSelectedId(row.contractId)} onMouseEnter={() => prefetch(row.contractId)} onFocus={() => prefetch(row.contractId)}>{row.title}</button> : <span className="block truncate font-medium" title={row.title}>{row.title}</span>}
              <span className="block truncate text-xs text-[#6e6e73]" title={`${row.contractingParty} ↔ ${row.counterparty || "相手先未確認"}`}>{row.contractingParty} ↔ {row.counterparty || "相手先未確認"}</span>
            </td>
            <td className="px-3 py-1.5 whitespace-nowrap">{STATUS_LABELS[row.status]}</td>
            {hasEvidence && <td className="px-3 py-1.5">{row.latestDocument ? <a href={row.latestDocument.url} target="_blank" rel="noopener noreferrer" className={`${linkClass} block truncate`} title={row.latestDocument.label}>{row.latestDocument.label}</a> : <span className="text-[#6e6e73]">未登録</span>}<button type="button" className={`${linkClass} block text-xs`} onClick={() => setSelectedId(row.contractId)} onMouseEnter={() => prefetch(row.contractId)} onFocus={() => prefetch(row.contractId)}>文書・経緯</button></td>}
            <td className="px-3 py-1.5 text-xs tabular-nums">{eventDate(row.lastActivityAt)}</td>
            {hasEvidence && <td className="px-3 py-1.5 text-xs">{CONTRACT_NEXT_ACTION[row.status]}</td>}
            <td className="px-3 py-1.5 text-xs"><span className="block">{row.status === "signed" ? `締結 ${eventDate(row.signedAt)}` : "未締結"}</span><span className="block text-[#6e6e73]">{row.effectiveDate || "開始日未確認"} ～ {row.expirationDate || "終了日未確認"}</span></td>
            {data.canManage && <td className="px-3 py-1.5"><label className="flex min-h-8 items-center gap-1 text-xs"><input type="checkbox" aria-label={`${row.title}をDDに表示`} checked={row.ddVisible} disabled={saving !== null} onChange={event => void toggle(row.contractId, event.target.checked)} className="size-4 accent-[#1976b9]" /><span>{saving === row.contractId ? "保存中" : row.ddVisible ? "表示" : "非表示"}</span></label></td>}
          </tr>)}{rows.length === 0 && <tr><td colSpan={hasEvidence ? data.canManage ? 7 : 6 : 4} className="px-3 py-3 text-[#6e6e73]">{data.contracts.length ? "条件に一致する契約はないよ。" : "契約未登録"}</td></tr>}</tbody>
        </table>
      </div>}
      <Dialog open={!!selected && hasEvidence} onOpenChange={open => { if (!open) setSelectedId(null); }}>
        <DialogContent showCloseButton={false} className="max-w-[1160px] max-h-[90dvh] gap-2 overflow-y-auto p-3 sm:max-h-[85dvh]" data-testid="contract-evidence-dialog">
          <div className="flex items-start justify-between gap-3"><DialogTitle className="min-w-0 text-base leading-6 font-semibold">{selected?.title}</DialogTitle><DialogClose className="min-h-11 shrink-0 rounded border border-[#d8d8dc] px-3 text-xs hover:bg-[#f5f5f7] sm:min-h-8">閉じる</DialogClose></div>
          <DialogDescription className="sr-only">契約の状態、文書の版、やりとりの経緯を確認する。</DialogDescription>
          {selected && <dl className="flex flex-wrap gap-x-5 gap-y-1 border-y border-[#e5e5e7] py-2 text-xs leading-5">
            <div className="flex gap-2"><dt className="text-[#6e6e73]">当事者</dt><dd>{selected.contractingParty} ↔ {selected.counterparty || "未確認"}</dd></div>
            <div className="flex gap-2"><dt className="text-[#6e6e73]">状態</dt><dd>{STATUS_LABELS[selected.status]}・{selected.status === "signed" ? `締結 ${eventDate(selected.signedAt)}` : "未締結"}</dd></div>
            <div className="flex gap-2"><dt className="text-[#6e6e73]">次の対応</dt><dd>{CONTRACT_NEXT_ACTION[selected.status]}</dd></div>
          </dl>}
          {detailError && <div role="alert" className="flex items-center gap-3 text-sm text-red-700"><span>{detailError}</span>{!currentEvidence && <button type="button" className={linkClass} onClick={() => setDetailAttempt(value => value + 1)}>再読み込み</button>}</div>}
          {!currentEvidence ? !detailError && <p className="py-3 text-sm text-[#6e6e73]">文書・経緯を読み込み中…</p> : <>
            <div className="flex items-center gap-2 text-sm"><h3 className="font-semibold">文書と版</h3><span className="text-xs text-[#6e6e73]">{currentEvidence.documents.length}版</span></div>
            <div className="max-h-[22dvh] overflow-auto border border-[#e5e5e7]">
              <table className="w-full min-w-[640px] text-xs leading-5"><thead className="sticky top-0 bg-[#f5f5f7] text-left text-[#6e6e73]"><tr><th className="w-32 px-2 py-1 font-medium">受領・返送日時</th><th className="w-72 px-2 py-1 font-medium">版</th><th className="px-2 py-1 font-medium">ファイル名</th></tr></thead>
                <tbody className="divide-y divide-[#e5e5e7]">{currentEvidence.documents.map(doc => <tr key={doc.id} className={doc.latest ? "bg-[#f5f8fb]" : ""}><td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{eventDate(doc.receivedAt, true)}</td><td className="px-2 py-1.5"><a href={doc.url} target="_blank" rel="noopener noreferrer" className={linkClass}>{doc.label}</a>{doc.latest && <span className="ml-2 text-[#6e6e73]">現行</span>}</td><td className="max-w-96 truncate px-2 py-1.5 text-[#6e6e73]" title={doc.fileName}>{doc.fileName}</td></tr>)}{!currentEvidence.documents.length && <tr><td colSpan={3} className="px-2 py-2 text-[#6e6e73]">文書未登録</td></tr>}</tbody>
              </table>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm"><h3 className="font-semibold">やりとりの経緯</h3><span className="text-xs text-[#6e6e73]">新しい順・{currentEvidence.history.length}件表示</span></div>
            <div className="max-h-[42dvh] overflow-auto border border-[#e5e5e7]">
              <table className="w-full min-w-[720px] text-[13px] leading-5" data-testid="contract-history-table"><thead className="sticky top-0 bg-[#f5f5f7] text-left text-xs text-[#6e6e73]"><tr><th className="w-32 px-2 py-1 font-medium">日時</th><th className="w-52 px-2 py-1 font-medium">対応</th><th className="px-2 py-1 font-medium">内容・根拠</th></tr></thead>
                <tbody className="divide-y divide-[#e5e5e7]">{currentEvidence.history.map(event => <tr key={event.id} className="align-top"><td className="px-2 py-1.5 whitespace-nowrap text-xs tabular-nums">{eventDate(event.occurredAt, true)}</td><td className="px-2 py-1.5 font-medium">{event.title}</td><td className="px-2 py-1.5">{event.summary}{event.url && <a href={event.url} target="_blank" rel="noopener noreferrer" className={`${linkClass} ml-2 inline-block text-xs`}>メール</a>}</td></tr>)}{!currentEvidence.history.length && <tr><td colSpan={3} className="px-2 py-2 text-[#6e6e73]">経緯未登録</td></tr>}</tbody>
              </table>
            </div>
            {currentEvidence.nextHistoryCursor && <button type="button" className={`${controlClass} justify-self-start disabled:opacity-50`} disabled={loadingMore} onClick={() => void olderHistory()}>{loadingMore ? "読み込み中…" : "過去20件を読み込む"}</button>}
          </>}
        </DialogContent>
      </Dialog>
    </section>
  );
}
