"use client";

import { useEffect, useRef, useState } from "react";
import type { SeasonProjectPlan } from "@/lib/payout-season-plan";

const yen = (n: number | null) => n == null ? "未確認" : `${n.toLocaleString("ja-JP")}円`;
const ym = (value: string) => `${value.slice(0, 4)}/${value.slice(4)}`;
const pt = (n: number | null) => n == null ? "未確認" : `${n.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}pt`;
const cell = "whitespace-nowrap px-3 py-1.5 text-right tabular-nums";
const label = "px-3 py-1.5 text-left font-medium";

export function PayoutSeasonEvidence({ project, onOpenMonthly, openRequested = false }: {
  project: SeasonProjectPlan; onOpenMonthly: (projectId: string, sourceYm: string, label: string) => void; openRequested?: boolean;
}) {
  const [selectedYm, setSelectedYm] = useState("");
  const evidenceRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (openRequested) evidenceRef.current?.scrollIntoView({ block: "start", behavior: "instant" }); }, [openRequested]);
  const a = project.allocation!, e = a.evidence;
  const selected = e.monthly.find((m) => m.ym === selectedYm) ?? e.monthly.find((m) => m.cumulativeRemainingYen != null && m.cumulativeRemainingYen < 0) ?? e.monthly.at(-1);
  const ptOver = e.regularAllocatedPt == null ? null : Math.round((e.regularAllocatedPt - e.regularPointBasis) * 100) / 100;
  const adjustments = [
    ["期首からの繰越", e.openingCarryYen], ["保存済み支払と計算額の差", e.savedAdjustmentYen],
    ["切上げ加算", e.roundingYen], ["控除", e.offsetsYen == null ? null : -e.offsetsYen],
    ["その他の未照合差分", e.unexplainedYen],
  ] as const;
  return <details ref={evidenceRef} key={project.projectId} open={openRequested || a.status === "overallocated" || a.paymentStatus === "over_budget"} className="scroll-mt-20 border border-border" data-testid="payout-season-evidence">
    <summary className={`cursor-pointer px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-sky-600 ${a.paymentStatus === "over_budget" ? "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300" : a.status === "overallocated" ? "bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200" : "bg-muted/30"}`}>予算と配分の根拠を確認 · MS別／月別／メンバー別</summary>
    <div className="space-y-3 p-3 text-xs">
      <div className="space-y-1 leading-relaxed">
        <p><strong>振込＋外部未払 {yen(a.cashCommittedYen)}</strong>。期末の社内配分未充当 {yen(a.internalUnfundedYen)}。{a.cashCommittedYen === 0 ? "報酬の現金支払・外部未払は0円。" : ""}</p>
        <p><strong>MS計算による配分額 {yen(e.accruedYen)}</strong>{adjustments.filter(([, value]) => value == null || value !== 0).map(([name, value]) => <span key={name}> {value != null && value < 0 ? "−" : "＋"} {name} {yen(value == null ? null : Math.abs(value))}</span>)} ＝ 社内を含む配分計 {yen(a.committedYen)}。原資 {yen(a.budgetYen)}に対し、{a.remainingYen == null ? "配分差額は未確認" : a.remainingYen < 0 ? `配分超過 ${yen(-a.remainingYen)}` : `配分残額 ${yen(a.remainingYen)}`}。</p>
        <p className={ptOver != null && ptOver > 0 ? "font-medium text-amber-800 dark:text-amber-300" : "text-muted-foreground"}>本契約の原資基準 {pt(e.regularPointBasis)} ／ MS配分 {pt(e.regularAllocatedPt)}{ptOver != null && ptOver > 0 ? `（${pt(ptOver)}超過）` : ""}。別財布のMS配分 {pt(e.extraAllocatedPt)}。</p>
        {e.unexplainedYen != null && e.unexplainedYen !== 0 && <p className="text-amber-800 dark:text-amber-300">その他の未照合差分があるため、月別の保存額・計算根拠を確認する必要がある。</p>}
        {e.notes.length > 0 && <p className="text-amber-800 dark:text-amber-300">{e.notes.join("、")}</p>}
      </div>
      <div>
        <h5 className="mb-1 font-semibold">どの仕事に配分しているか</h5>
        <div role="region" aria-label={`${project.projectName}のMS別年間配分`} tabIndex={0} className="overflow-x-auto border border-border focus-visible:outline-2 focus-visible:outline-sky-600">
          <table data-amie-list="matrix" className="w-full min-w-[640px] border-collapse text-xs"><thead className="border-b border-border bg-muted"><tr><th scope="col" className={label}>MS・仕事</th><th scope="col" className={label}>担当</th><th scope="col" className={label}>原資</th><th scope="col" className={cell}>配分pt</th><th scope="col" className={cell}>配分額</th></tr></thead>
            <tbody>{e.milestones.map((m) => <tr key={`${m.pool}:${m.msKey}`} className="border-b border-border/60 last:border-0"><th scope="row" className={`${label} max-w-[320px] break-words`}>{m.title}</th><td className={label}>{m.memberNames.join("・")}</td><td className={label}>{m.pool === "regular" ? "本契約" : "別財布"}</td><td className={cell}>{pt(m.earnedPt)}</td><td className={cell}>{yen(m.earnedYen)}</td></tr>)}</tbody>
          </table>
        </div>
        {e.msDifferenceYen != null && e.msDifferenceYen !== 0 && <p className="mt-1 text-[11px] text-muted-foreground">MS内訳の合計とメンバー配分計算額の差 {yen(e.msDifferenceYen)}。月次計算根拠で確認。</p>}
      </div>
      <div>
        <h5 className="mb-1 font-semibold">どの月に配分が超過するか <span className="font-normal text-muted-foreground">稼働月を選ぶと、支払と社内配分の内訳を表示</span></h5>
        <div role="region" aria-label={`${project.projectName}の月別原資と配分の比較`} tabIndex={0} className="overflow-x-auto border border-border focus-visible:outline-2 focus-visible:outline-sky-600">
          <table data-amie-list="matrix" className="w-full min-w-[760px] border-collapse text-xs"><thead className="border-b border-border bg-muted"><tr><th scope="col" className={label}>稼働月</th>{["当月の原資", "MS配分額", "振込対象額", "社内配分", "月末残（外部／社内）", "累計配分残額"].map((s) => <th key={s} scope="col" className={cell}>{s}</th>)}</tr></thead>
            <tbody>{e.monthly.map((m) => <tr key={m.ym} className={`border-b border-border/60 last:border-0 ${m.ym === selected?.ym ? "bg-sky-50 dark:bg-sky-950/40" : ""}`}><th scope="row" className={label}><button type="button" aria-pressed={m.ym === selected?.ym} aria-label={`${project.projectName} ${ym(m.ym)}の配分内訳を見る`} className="text-sky-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-600 dark:text-sky-300" onClick={() => setSelectedYm(m.ym)}>{ym(m.ym)}</button></th>{[m.budgetYen, m.accruedYen, m.cashYen, m.internalYen].map((n, i) => <td key={i} className={cell}>{yen(n)}</td>)}<td className={cell}><div>外部 {yen(m.externalUnpaidYen)}</div><div className="mt-1 text-[11px] text-muted-foreground">社内 {yen(m.internalUnfundedYen)}</div></td><td className={`${cell} ${(m.cumulativeRemainingYen ?? 0) < 0 ? "font-semibold text-amber-800 dark:text-amber-300" : ""}`}>{yen(m.cumulativeRemainingYen)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
      {selected && <div>
        <div className="mb-1 flex flex-wrap items-baseline gap-3"><h5 className="font-semibold">{ym(selected.ym)}のメンバー・MS明細</h5><button type="button" className="text-sky-800 underline underline-offset-2 dark:text-sky-300" onClick={() => onOpenMonthly(project.projectId, selected.ym, `${project.projectName} ${ym(selected.ym)}`)}>既存の月次報酬根拠を開く</button></div>
        <div role="region" aria-label={`${project.projectName} ${ym(selected.ym)}のメンバーとMS明細`} tabIndex={0} className="overflow-x-auto border border-border focus-visible:outline-2 focus-visible:outline-sky-600">
          <table data-amie-list="matrix" className="w-full min-w-[900px] border-collapse text-xs"><thead className="border-b border-border bg-muted"><tr><th scope="col" className={label}>メンバー・仕事</th>{["MS配分額", "振込対象額", "社内配分", "外部未払", "社内未充当", "保存額差分"].map((s) => <th key={s} scope="col" className={cell}>{s}</th>)}</tr></thead>
            <tbody>{selected.members.map((m) => <tr key={m.memberId} className="border-b border-border/60 last:border-0 align-top"><th scope="row" className={`${label} min-w-[240px] max-w-[400px]`}><span className="font-semibold">{m.memberName}</span>{m.breakdown.map((line) => <div key={`${line.pool}:${line.msKey}`} className="mt-1 text-[11px] font-normal leading-relaxed text-muted-foreground">{line.title} · {pt(line.earnedPt)} · {yen(line.earnedYen)}</div>)}</th>{[m.accruedYen, m.cashYen, m.internalYen, m.externalUnpaidYen, m.internalUnfundedYen, m.savedAdjustmentYen].map((n, i) => <td key={i} className={`${cell} ${i === 3 && (n ?? 0) > 0 ? "text-red-700 dark:text-red-400" : i === 4 && (n ?? 0) > 0 ? "text-amber-800 dark:text-amber-300" : ""}`}>{yen(n)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>}
      <p className="text-[11px] leading-relaxed text-muted-foreground">予定月を含む保存済み計算の根拠。MS配分額は当月の仕事分、社内配分は非現金のポイント配分。累計配分残額は、累計原資−累計振込・社内配分−その月末の外部未払・社内未充当。過去の確定額と計算額の差を、追加支払や返還の承認として扱わない。</p>
    </div>
  </details>;
}
