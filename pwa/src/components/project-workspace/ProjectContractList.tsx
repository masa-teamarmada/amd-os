"use client";
import { Fragment, useEffect, useState } from "react";
import type { ProjectContractListData } from "@/lib/project-contract-list";
import { loadProjectContracts, setContractDdVisibility } from "@/lib/project-contract-list-client";

function eventDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "日時未確認" : new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
const STATUS_LABELS = { planned: "締結予定", drafting: "草案作成中", under_review: "契約書確認中", awaiting_signature: "署名待ち", signed: "締結済み", stalled: "協議停滞", cancelled: "中止" };
export function ProjectContractList({ projectId, initialData }: { projectId: string; initialData?: ProjectContractListData }) {
  const [data, setData] = useState<ProjectContractListData | null>(initialData ?? null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  useEffect(() => {
    if (initialData) return;
    let cancelled = false;
    loadProjectContracts(projectId).then(value => { if (!cancelled) setData(value); }).catch(() => { if (!cancelled) setError("契約リストを取得できません。"); });
    return () => { cancelled = true; };
  }, [initialData, projectId]);
  async function toggle(contractId: string, ddVisible: boolean) {
    setSaving(contractId); setError("");
    try {
      setData(await setContractDdVisibility(projectId, contractId, ddVisible));
    } catch { setError("DDの表示設定を保存できません。"); }
    finally { setSaving(null); }
  }
  return (
    <section className="space-y-4" data-testid="project-contract-list">
      <div className="flex items-center gap-3"><h2 className="text-lg font-semibold">契約リスト</h2>{data && <span className="text-sm text-[#6e6e73]">{data.contracts.length}件</span>}</div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!data ? <p className="text-sm text-[#6e6e73]">読み込み中…</p> : (
        <>
        <div className="overflow-x-auto rounded-xl border border-[#e5e5e7] bg-white">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-[#f5f5f7] text-left text-xs text-[#6e6e73]"><tr>
              {["契約名", "契約当事者", "状態", "締結日", "契約期間", ...(data.canManage ? ["DDに表示"] : [])].map(label => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#e5e5e7]">
              {data.contracts.map(row => <Fragment key={row.contractId}><tr>
                <td className="px-4 py-4 font-medium">{row.title}</td>
                <td className="px-4 py-4"><div>{row.contractingParty}</div><div className="mt-1 text-[#6e6e73]">{row.counterparty || "相手先未確認"}</div></td>
                <td className="px-4 py-4 whitespace-nowrap">{STATUS_LABELS[row.status]}</td>
                <td className="px-4 py-4 whitespace-nowrap">{row.status === "signed" ? row.signedAt?.slice(0, 10) || "未確認" : "未締結"}</td>
                <td className="px-4 py-4">{row.effectiveDate || "開始日未確認"}<br />{row.expirationDate || "終了日未確認"}</td>
                {data.canManage && <td className="px-4 py-4"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" aria-label={`${row.title}をDDに表示`} checked={row.ddVisible} disabled={saving !== null} onChange={event => void toggle(row.contractId, event.target.checked)} className="size-4 accent-[#1976b9]" /><span className="text-xs">{saving === row.contractId ? "保存中…" : row.ddVisible ? "表示" : "非表示"}</span></label></td>}
              </tr>
              </Fragment>)}
              {data.contracts.length === 0 && <tr><td colSpan={data.canManage ? 6 : 5} className="px-4 py-5 text-[#6e6e73]">契約未登録</td></tr>}
            </tbody>
          </table>
        </div>
              {data.contracts.filter(row => row.documents?.length || row.history?.length).map(row => <div key={row.contractId} className="min-w-0 rounded-xl border border-[#e5e5e7] bg-[#fafafa] px-4 py-3">
                <details open={data.contracts.length === 1}>
                  <summary className="min-h-11 cursor-pointer py-3 font-medium text-[#1976b9] focus-visible:outline-2 focus-visible:outline-offset-2">{data.contracts.length > 1 ? `${row.title} — ` : ""}文書とやりとり（{row.documents?.length ?? 0}版・{row.history?.length ?? 0}件）</summary>
                  <div className="grid gap-6 pb-4 pt-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                    <section className="min-w-0" aria-label={`${row.title}の文書と版`}>
                      <h3 className="mb-3 font-semibold">文書と版</h3>
                      <ul className="space-y-3">{row.documents?.map(doc => <li key={doc.id} className="rounded-lg border border-[#e5e5e7] bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2"><a href={doc.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-medium text-[#1976b9] underline underline-offset-4 hover:text-[#125a8c]">{doc.label}を開く</a>{doc.latest && <span className="rounded bg-[#f0f4f8] px-2 py-1 text-xs text-[#475569]">現行の協議版</span>}</div>
                        <p className="mt-1 break-all text-xs leading-5 text-[#6e6e73]">{doc.fileName}</p><p className="mt-2 text-xs text-[#6e6e73]">{eventDate(doc.receivedAt)}</p>
                      </li>)}</ul>
                    </section>
                    <section className="min-w-0" aria-label={`${row.title}のやりとりの経緯`}>
                      <h3 className="mb-3 font-semibold">やりとりの経緯</h3>
                      <ol className="space-y-4 border-l-2 border-[#e5e5e7] pl-4">{row.history?.map(event => <li key={event.id}>
                        <time className="text-xs text-[#6e6e73]" dateTime={event.occurredAt}>{eventDate(event.occurredAt)}</time><p className="mt-1 font-medium">{event.title}</p><p className="mt-1 whitespace-normal break-words text-sm leading-6 text-[#475569]">{event.summary}</p>
                        {event.url && <a href={event.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-xs text-[#1976b9] underline underline-offset-4 hover:text-[#125a8c]">根拠メールを開く</a>}
                      </li>)}</ol>
                    </section>
                  </div>
                </details>
              </div>)}
        </>
      )}
    </section>
  );
}
