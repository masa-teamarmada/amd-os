"use client";

import { useEffect, useState } from "react";
import { buildSeasonPayoutView } from "@/lib/payout-season-allocation";
import type { SeasonProjectPlan } from "@/lib/payout-season-plan";
import { PayoutSeasonEvidence } from "./PayoutSeasonEvidence";

const yen = (n: number | null) => n == null ? "未確認" : `${n.toLocaleString("ja-JP")}円`;
const month = (ym: string | null) => ym ? `${ym.slice(0, 4)}/${ym.slice(4)}` : "未設定";
const numeric = "whitespace-nowrap px-3 py-2 text-right tabular-nums";
const th = "px-3 py-2 text-left font-medium";
function verdict(project: SeasonProjectPlan) {
  const a = project.allocation;
  if (!a || a.paymentStatus === "unknown") return "支払未確認";
  if (a.cashCommittedYen === 0) return "支払なし";
  if (a.paymentStatus === "over_budget") return "支払原資超過";
  return (buildSeasonPayoutView(a).remainingYen ?? 0) < 0 ? "配分要確認" : "支払予算内";
}
function color(project: SeasonProjectPlan) {
  const a = project.allocation;
  return !a || a.paymentStatus === "unknown" || (buildSeasonPayoutView(a).remainingYen ?? 0) < 0 ? "font-semibold text-amber-800 dark:text-amber-300" : "text-foreground";
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
  const payout = buildSeasonPayoutView(a);
  function selectProject(projectId: string, showEvidence = false) {
    setSelectedId(projectId);
    const url = new URL(window.location.href);
    url.searchParams.set("seasonProject", projectId);
    window.history.replaceState(null, "", url);
    if (showEvidence) setEvidenceRequest((request) => ({ projectId, version: request.version + 1 }));
  }
  return <div className="space-y-3 border border-border p-3" data-testid="payout-season-budget">
    <div>
      <h3 className="text-sm font-semibold">シーズン全体の支払予算と振込対象者</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">支払済み・今後の振込予定と、期末の未払を確認。金額は税抜。PJ名を選ぶと、振込対象者ごとのシーズン合計を表示。</p>
    </div>
    <div role="region" aria-label="PJ別のシーズン支払予算と振込額" tabIndex={0} className="overflow-x-auto border border-border focus-visible:outline-2 focus-visible:outline-sky-600">
      <table data-amie-list="matrix" className="w-full min-w-[720px] border-collapse text-xs" data-testid="payout-season-budget-overview">
        <thead className="border-b border-border bg-muted"><tr>
          <th scope="col" className={th}>PJ・稼働期間</th>
          {["支払用原資", "振込対象額", "期末未払", "支払計", "残額"].map((label) => <th key={label} scope="col" className={`${numeric} font-medium`}>{label}</th>)}
          <th scope="col" className={th}>支払判定</th>
        </tr></thead>
        <tbody>{configured.map((p) => { const view = p.allocation ? buildSeasonPayoutView(p.allocation) : null; return <tr key={p.projectId} data-season-budget-project={p.projectId} className={`border-b border-border/60 last:border-0 ${p.projectId === selected.projectId ? "bg-sky-50 dark:bg-sky-950/40" : "hover:bg-muted/30"}`}>
          <th scope="row" className={`${th} align-top`}><button type="button" aria-pressed={p.projectId === selected.projectId} aria-label={`${p.projectName}の振込対象者を見る`} onClick={() => selectProject(p.projectId)} className="font-semibold text-sky-800 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-sky-600 dark:text-sky-300">{p.projectName}</button><div className="mt-1 whitespace-nowrap text-[11px] font-normal text-muted-foreground">{month(p.startYm)}〜{month(p.endYm)}</div></th>
          {[view?.budgetYen, p.allocation?.cashYen, p.allocation?.externalUnpaidYen, view?.totalYen, view?.remainingYen].map((n, i) => <td key={i} className={`${numeric} ${i === 4 ? color(p) : ""}`}>{yen(n ?? null)}</td>)}
          <td className="whitespace-nowrap px-3 py-2" title={p.allocation?.issues.join("、")}><button type="button" className="text-left underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-600" aria-label={`${p.projectName}の支払・配分の根拠を見る`} onClick={() => selectProject(p.projectId, true)}><span className={`block ${paymentColor(p)}`}>{verdict(p)}</span></button>{p.planStatus === "draft" && <div className="text-[11px] font-normal">検討中</div>}</td>
        </tr>; })}</tbody>
      </table>
    </div>
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h4 className="text-sm font-semibold">{selected.projectName}の振込対象者</h4>
      <span className="text-xs text-muted-foreground">支払用原資 {yen(payout.budgetYen)}</span>
      <span className={`ml-auto text-sm ${color(selected)}`} role="status">{payout.remainingYen == null ? "支払予算の確認が必要" : payout.remainingYen < 0 ? `配分要確認 ${yen(-payout.remainingYen)}` : `支払用原資の残額 ${yen(payout.remainingYen)}`}</span>
    </div>
    <p className={`text-xs ${paymentColor(selected)}`}>振込＋期末外部未払 {yen(a.cashCommittedYen)} · {verdict(selected)}</p>
    {a.issues.length > 0 ? <div className="border-l-2 border-amber-400 bg-amber-50 p-2 text-xs leading-relaxed text-amber-950 dark:bg-amber-950/30 dark:text-amber-200">{a.issues.join("、")}。未確認の金額があるため、合意前に確認が必要。</div> : <div role="region" aria-label={`${selected.projectName}の振込対象者の年間支払表`} tabIndex={0} className="overflow-x-auto border border-border focus-visible:outline-2 focus-visible:outline-sky-600">
      <table data-amie-list="matrix" className="w-full min-w-[560px] border-collapse text-xs" data-testid="payout-season-member-allocation">
        <thead className="border-b border-border bg-muted"><tr><th scope="col" className={th}>メンバー</th>{["振込対象額", "期末未払", "支払計"].map((label) => <th key={label} scope="col" className={`${numeric} font-medium`}>{label}</th>)}</tr></thead>
        <tbody>{payout.members.map((m) => <tr key={m.memberId} data-season-member={m.memberId} className="border-b border-border/60 hover:bg-muted/20"><th scope="row" className={th}>{m.memberName}<span className="ml-2 text-[11px] font-normal text-muted-foreground">{m.memberId}</span></th>{[m.cashYen, m.externalUnpaidYen, m.cashYen + m.externalUnpaidYen].map((n, i) => <td key={i} className={numeric}>{n === 0 ? "—" : yen(n)}</td>)}</tr>)}{payout.members.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-muted-foreground">このシーズンの振込対象者はいない。支払額・外部未払ともに0円。</td></tr>}</tbody>
        <tfoot className="bg-muted/40 font-semibold"><tr><th scope="row" className={th}>シーズン計</th>{[a.cashYen, a.externalUnpaidYen, payout.totalYen].map((n, i) => <td key={i} className={numeric}>{yen(n)}</td>)}</tr></tfoot>
      </table>
    </div>}
    <PayoutSeasonEvidence key={`${selected.projectId}:${evidenceRequest.version}`} project={selected} onOpenMonthly={onOpenMonthly} openRequested={evidenceRequest.projectId === selected.projectId} />
    <p className="text-[11px] leading-relaxed text-muted-foreground">支払用原資は、登録済みの報酬予算から支払対象外メンバーの既存割当を確保して計算（最低0円）。残額＝支払用原資−振込対象額−期末未払。期末未払は最終月の残高を1回計上。会社の損益は原価・販管費を含む財務で確認。{projects.length > configured.length && `シーズン未設定の${projects.length - configured.length}PJは判定対象外。`}</p>
  </div>;
}
