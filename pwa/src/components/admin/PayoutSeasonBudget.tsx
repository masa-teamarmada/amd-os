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
  return a?.paymentStatus === "within_budget" ? a.cashCommittedYen === 0 ? "支払なし" : "支払原資内" : a?.paymentStatus === "over_budget" ? "支払原資超過" : "支払未確認";
}
function color(project: SeasonProjectPlan) {
  return project.allocation?.status === "overallocated" ? "font-semibold text-amber-800 dark:text-amber-300" : project.allocation?.status === "unknown" ? "text-amber-800 dark:text-amber-300" : "text-foreground";
}
function paymentColor(project: SeasonProjectPlan) { return project.allocation?.paymentStatus === "over_budget" ? "font-semibold text-red-700 dark:text-red-400" : project.allocation?.paymentStatus === "unknown" ? "text-amber-800 dark:text-amber-300" : "text-foreground"; }

export function PayoutSeasonBudget({ projects, onOpenMonthly }: { projects: SeasonProjectPlan[]; onOpenMonthly: (projectId: string, sourceYm: string, label: string) => void }) {
  const [selectedId, setSelectedId] = useState("");
  const [evidenceRequest, setEvidenceRequest] = useState({ projectId: "", version: 0 });
  useEffect(() => { setSelectedId(new URLSearchParams(window.location.search).get("seasonProject") ?? ""); }, []);
  const configured = projects.filter((p) => p.planId);
  const selected = configured.find((p) => p.projectId === selectedId) ?? configured[0];
  if (!selected) return <p className="border border-border p-3 text-xs text-amber-800">シーズン報酬予算が未設定のため、年間の支払と配分を確認できない状態。</p>;
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
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">登録済みの報酬予算に対し、現金支払と社内のポイント配分をそれぞれ確認。金額は税抜。PJ名を選ぶと、下に全メンバーの配分を表示。</p>
    </div>
    <div role="region" aria-label="PJ別のシーズン報酬支払と配分の確認" tabIndex={0} className="overflow-x-auto border border-border focus-visible:outline-2 focus-visible:outline-sky-600">
      <table data-amie-list="matrix" className="w-full min-w-[920px] border-collapse text-xs" data-testid="payout-season-budget-overview">
        <thead className="border-b border-border bg-muted"><tr>
          <th scope="col" className={th}>PJ・稼働期間</th>
          {["報酬予算", "振込対象額", "社内配分", "期末残（外部／社内）", "配分計", "配分残額"].map((label) => <th key={label} scope="col" className={`${numeric} font-medium`}>{label}</th>)}
          <th scope="col" className={th}>支払・配分</th>
        </tr></thead>
        <tbody>{configured.map((p) => <tr key={p.projectId} data-season-budget-project={p.projectId} className={`border-b border-border/60 last:border-0 ${p.projectId === selected.projectId ? "bg-sky-50 dark:bg-sky-950/40" : "hover:bg-muted/30"}`}>
          <th scope="row" className={`${th} align-top`}><button type="button" aria-pressed={p.projectId === selected.projectId} aria-label={`${p.projectName}のメンバー別配分を見る`} onClick={() => selectProject(p.projectId)} className="font-semibold text-sky-800 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-sky-600 dark:text-sky-300">{p.projectName}</button><div className="mt-1 whitespace-nowrap text-[11px] font-normal text-muted-foreground">{month(p.startYm)}〜{month(p.endYm)}</div></th>
          {[p.allocation?.budgetYen, p.allocation?.cashYen, p.allocation?.internalYen].map((n, i) => <td key={i} className={numeric}>{yen(n ?? null)}</td>)}
          <td className={numeric}><div>外部 {yen(p.allocation?.externalUnpaidYen ?? null)}</div><div className="mt-1 text-[11px] text-muted-foreground">社内 {yen(p.allocation?.internalUnfundedYen ?? null)}</div></td>
          {[p.allocation?.committedYen, p.allocation?.remainingYen].map((n, i) => <td key={i} className={`${numeric} ${i === 1 ? color(p) : ""}`}>{yen(n ?? null)}</td>)}
          <td className="whitespace-nowrap px-3 py-2" title={p.allocation?.issues.join("、")}><button type="button" className="text-left underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-600" aria-label={`${p.projectName}の支払・配分の根拠を見る`} onClick={() => selectProject(p.projectId, true)}><span className={`block ${paymentColor(p)}`}>{verdict(p)}</span>{p.allocation?.status === "overallocated" && <span className="mt-1 block text-[11px] text-amber-800 dark:text-amber-300">配分超過</span>}</button>{p.planStatus === "draft" && <div className="text-[11px] font-normal">検討中</div>}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h4 className="text-sm font-semibold">{selected.projectName}のメンバー別配分</h4>
      <span className="text-xs text-muted-foreground">本契約予算 {yen(a.regularBudgetYen)} ＋ 別財布予算 {yen(a.extraBudgetYen)}</span>
      <span className={`ml-auto text-sm ${color(selected)}`} role="status">{a.remainingYen == null ? "配分の確認が必要" : a.remainingYen < 0 ? `社内を含む配分超過 ${yen(-a.remainingYen)}` : `社内を含む配分残額 ${yen(a.remainingYen)}`}</span>
    </div>
    <p className={`text-xs ${paymentColor(selected)}`}>振込＋期末外部未払 {yen(a.cashCommittedYen)} · {verdict(selected)}<span className="ml-4 text-muted-foreground">期末の社内配分未充当 {yen(a.internalUnfundedYen)}</span></p>
    {a.issues.length > 0 ? <div className="border-l-2 border-amber-400 bg-amber-50 p-2 text-xs leading-relaxed text-amber-950 dark:bg-amber-950/30 dark:text-amber-200">{a.issues.join("、")}。未確認の金額があるため、合意前に確認が必要。</div> : <div role="region" aria-label={`${selected.projectName}の全メンバー年間配分表`} tabIndex={0} className="overflow-x-auto border border-border focus-visible:outline-2 focus-visible:outline-sky-600">
      <table data-amie-list="matrix" className="w-full min-w-[760px] border-collapse text-xs" data-testid="payout-season-member-allocation">
        <thead className="border-b border-border bg-muted"><tr><th scope="col" className={th}>メンバー</th>{["振込対象額", "社内配分", "期末外部未払", "期末社内未充当", "配分計"].map((label) => <th key={label} scope="col" className={`${numeric} font-medium`}>{label}</th>)}</tr></thead>
        <tbody>{a.members.map((m) => <tr key={m.memberId} data-season-member={m.memberId} className="border-b border-border/60 hover:bg-muted/20"><th scope="row" className={th}>{m.memberName}<span className="ml-2 text-[11px] font-normal text-muted-foreground">{m.memberId}</span></th>{[m.cashYen, m.internalYen, m.externalUnpaidYen, m.internalUnfundedYen, m.totalYen].map((n, i) => <td key={i} className={numeric}>{n === 0 ? "—" : yen(n)}</td>)}</tr>)}</tbody>
        <tfoot className="bg-muted/40 font-semibold"><tr><th scope="row" className={th}>シーズン計</th>{[a.cashYen, a.internalYen, a.externalUnpaidYen, a.internalUnfundedYen, a.committedYen].map((n, i) => <td key={i} className={numeric}>{yen(n)}</td>)}</tr></tfoot>
      </table>
    </div>}
    <PayoutSeasonEvidence key={`${selected.projectId}:${evidenceRequest.version}`} project={selected} onOpenMonthly={onOpenMonthly} openRequested={evidenceRequest.projectId === selected.projectId} />
    <p className="text-[11px] leading-relaxed text-muted-foreground">支払判定は振込＋外部未払と報酬原資の比較。社内配分は非現金のポイント配分。配分残額には社内の割当・未充当も含む。会社損益は実際の原価・販管費を含む財務で確認する。販管費分は報酬予算に含めず、期末残高は最終月を1回だけ計上。{projects.length > configured.length && `シーズン未設定の${projects.length - configured.length}PJは判定対象外。`}</p>
  </div>;
}
