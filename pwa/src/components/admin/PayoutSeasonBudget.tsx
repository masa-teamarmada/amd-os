"use client";

import { useEffect, useState } from "react";
import type { SeasonProjectPlan } from "@/lib/payout-season-plan";
import { PayoutSeasonEvidence } from "./PayoutSeasonEvidence";

const yen = (n: number | null) => n == null ? "未確認" : `${n.toLocaleString("ja-JP")}円`;
const month = (ym: string | null) => ym ? `${ym.slice(0, 4)}/${ym.slice(4)}` : "未設定";
const numeric = "whitespace-nowrap px-3 py-2 text-right tabular-nums";
const th = "px-3 py-2 text-left font-medium";
function verdict(project: SeasonProjectPlan) {
  const a = project.allocation;
  return a?.status === "within_budget" ? "予算内" : a?.status === "deficit" ? "赤字" : "要確認";
}
function color(project: SeasonProjectPlan) {
  return project.allocation?.status === "deficit" ? "font-semibold text-red-700 dark:text-red-400" : project.allocation?.status === "unknown" ? "text-amber-800 dark:text-amber-300" : "text-foreground";
}

export function PayoutSeasonBudget({ projects, onOpenMonthly }: { projects: SeasonProjectPlan[]; onOpenMonthly: (projectId: string, sourceYm: string, label: string) => void }) {
  const [selectedId, setSelectedId] = useState("");
  const [evidenceRequest, setEvidenceRequest] = useState({ projectId: "", version: 0 });
  useEffect(() => { setSelectedId(new URLSearchParams(window.location.search).get("seasonProject") ?? ""); }, []);
  const configured = projects.filter((p) => p.planId);
  const selected = configured.find((p) => p.projectId === selectedId) ?? configured[0];
  if (!selected) return <p className="border border-border p-3 text-xs text-amber-800">シーズン報酬予算が未設定のため、年間配分と赤字の判定を確認できない状態。</p>;
  const a = selected.allocation!;
  function selectProject(projectId: string, showEvidence = false) {
    setSelectedId(projectId);
    const url = new URL(window.location.href);
    url.searchParams.set("seasonProject", projectId);
    window.history.replaceState(null, "", url);
    if (showEvidence) setEvidenceRequest((request) => ({ projectId, version: request.version + 1 }));
  }
  return <div className="space-y-3 border border-border p-3" data-testid="payout-season-budget">
    <div>
      <h3 className="text-sm font-semibold">シーズン全体の報酬予算とメンバー別配分</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">登録済みの報酬予算に、支払記録・今後の予定・内部配賦・期末未払を照合。金額は税抜。PJ名を選ぶと、下に全メンバーの配分を表示。</p>
    </div>
    <div role="region" aria-label="PJ別のシーズン報酬予算と赤字判定" tabIndex={0} className="overflow-x-auto border border-border focus-visible:outline-2 focus-visible:outline-sky-600">
      <table data-amie-list="matrix" className="w-full min-w-[920px] border-collapse text-xs" data-testid="payout-season-budget-overview">
        <thead className="border-b border-border bg-muted"><tr>
          <th scope="col" className={th}>PJ・稼働期間</th>
          {["報酬予算", "振込対象額", "内部配賦", "期末未払・未充当", "配分計", "予算残額"].map((label) => <th key={label} scope="col" className={`${numeric} font-medium`}>{label}</th>)}
          <th scope="col" className={th}>判定</th>
        </tr></thead>
        <tbody>{configured.map((p) => <tr key={p.projectId} data-season-budget-project={p.projectId} className={`border-b border-border/60 last:border-0 ${p.projectId === selected.projectId ? "bg-sky-50 dark:bg-sky-950/40" : "hover:bg-muted/30"}`}>
          <th scope="row" className={`${th} align-top`}><button type="button" aria-pressed={p.projectId === selected.projectId} aria-label={`${p.projectName}のメンバー別配分を見る`} onClick={() => selectProject(p.projectId)} className="font-semibold text-sky-800 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-sky-600 dark:text-sky-300">{p.projectName}</button><div className="mt-1 whitespace-nowrap text-[11px] font-normal text-muted-foreground">{month(p.startYm)}〜{month(p.endYm)}</div></th>
          {[p.allocation?.budgetYen, p.allocation?.cashYen, p.allocation?.internalYen, p.allocation?.closingUnfundedYen, p.allocation?.committedYen, p.allocation?.remainingYen].map((n, i) => <td key={i} className={`${numeric} ${i === 5 ? color(p) : ""}`}>{yen(n ?? null)}</td>)}
          <td className={`whitespace-nowrap px-3 py-2 ${color(p)}`} title={p.allocation?.issues.join("、")}><button type="button" className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-600" aria-label={`${p.projectName}の${verdict(p)}の根拠を見る`} onClick={() => selectProject(p.projectId, true)}>{verdict(p)}</button>{p.planStatus === "draft" && <div className="text-[11px] font-normal">検討中</div>}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h4 className="text-sm font-semibold">{selected.projectName}のメンバー別配分</h4>
      <span className="text-xs text-muted-foreground">本契約予算 {yen(a.regularBudgetYen)} ＋ 別財布予算 {yen(a.extraBudgetYen)}</span>
      <span className={`ml-auto text-sm ${color(selected)}`} role="status">{a.remainingYen == null ? "赤字判定は保留" : a.remainingYen < 0 ? `予算超過 ${yen(-a.remainingYen)} · AMDの赤字` : `残額 ${yen(a.remainingYen)} · 登録済み配分は予算内`}</span>
    </div>
    {a.issues.length > 0 ? <div className="border-l-2 border-amber-400 bg-amber-50 p-2 text-xs leading-relaxed text-amber-950 dark:bg-amber-950/30 dark:text-amber-200">{a.issues.join("、")}。未確認の金額があるため、合意前に確認が必要。</div> : <div role="region" aria-label={`${selected.projectName}の全メンバー年間配分表`} tabIndex={0} className="overflow-x-auto border border-border focus-visible:outline-2 focus-visible:outline-sky-600">
      <table data-amie-list="matrix" className="w-full min-w-[640px] border-collapse text-xs" data-testid="payout-season-member-allocation">
        <thead className="border-b border-border bg-muted"><tr><th scope="col" className={th}>メンバー</th>{["振込対象額", "内部配賦", "期末未払・未充当", "配分計"].map((label) => <th key={label} scope="col" className={`${numeric} font-medium`}>{label}</th>)}</tr></thead>
        <tbody>{a.members.map((m) => <tr key={m.memberId} data-season-member={m.memberId} className="border-b border-border/60 hover:bg-muted/20"><th scope="row" className={th}>{m.memberName}<span className="ml-2 text-[11px] font-normal text-muted-foreground">{m.memberId}</span></th>{[m.cashYen, m.internalYen, m.closingUnfundedYen, m.totalYen].map((n, i) => <td key={i} className={numeric}>{n === 0 ? "—" : yen(n)}</td>)}</tr>)}</tbody>
        <tfoot className="bg-muted/40 font-semibold"><tr><th scope="row" className={th}>シーズン計</th>{[a.cashYen, a.internalYen, a.closingUnfundedYen, a.committedYen].map((n, i) => <td key={i} className={numeric}>{yen(n)}</td>)}</tr></tfoot>
      </table>
    </div>}
    <PayoutSeasonEvidence key={`${selected.projectId}:${evidenceRequest.version}`} project={selected} onOpenMonthly={onOpenMonthly} openRequested={evidenceRequest.projectId === selected.projectId} />
    <p className="text-[11px] leading-relaxed text-muted-foreground">内部配賦は支払対象外メンバーへの報酬原資の割当。販管費等に使う分は報酬予算に含めない。残額＝報酬予算−配分計。期末未払・未充当は最終月の残高を1回だけ計上。未承認の追加報酬は登録後に反映。{projects.length > configured.length && `シーズン未設定の${projects.length - configured.length}PJは判定対象外。`}</p>
  </div>;
}
