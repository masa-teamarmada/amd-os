"use client";
import { useEffect, useState } from "react";
import type { ProjectContractListData } from "@/lib/project-contract-list";
import { loadProjectContracts, setContractDdVisibility } from "@/lib/project-contract-list-client";

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
        <div className="overflow-x-auto rounded-xl border border-[#e5e5e7] bg-white">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-[#f5f5f7] text-left text-xs text-[#6e6e73]"><tr>
              {["契約名", "契約当事者", "状態", "締結日", "契約期間", ...(data.canManage ? ["DDに表示"] : [])].map(label => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#e5e5e7]">
              {data.contracts.map(row => <tr key={row.contractId}>
                <td className="px-4 py-4 font-medium">{row.title}</td>
                <td className="px-4 py-4"><div>{row.contractingParty}</div><div className="mt-1 text-[#6e6e73]">{row.counterparty || "相手先未確認"}</div></td>
                <td className="px-4 py-4 whitespace-nowrap">{STATUS_LABELS[row.status]}</td>
                <td className="px-4 py-4 whitespace-nowrap">{row.status === "signed" ? row.signedAt?.slice(0, 10) || "未確認" : "未締結"}</td>
                <td className="px-4 py-4">{row.effectiveDate || "開始日未確認"}<br />{row.expirationDate || "終了日未確認"}</td>
                {data.canManage && <td className="px-4 py-4"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" aria-label={`${row.title}をDDに表示`} checked={row.ddVisible} disabled={saving !== null} onChange={event => void toggle(row.contractId, event.target.checked)} className="size-4 accent-[#1976b9]" /><span className="text-xs">{saving === row.contractId ? "保存中…" : row.ddVisible ? "表示" : "非表示"}</span></label></td>}
              </tr>)}
              {data.contracts.length === 0 && <tr><td colSpan={data.canManage ? 6 : 5} className="px-4 py-5 text-[#6e6e73]">契約未登録</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
