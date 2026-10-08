import { contractOperationalChecks, contractSourceUrl } from "@/lib/contract-operational-checks";
import { textTerm, type ProjectContractTerms } from "@/lib/project-contract-terms";

const legalTerms = [
  ["秘密保持の対象", "confidentialitySummary"],
  ["秘密保持の存続", "confidentialitySurvival"],
  ["再委託", "subcontractingTerms"],
  ["知財の帰属", "ipOwnership"],
  ["利用権", "usageRights"],
  ["公開・発表", "publicityRights"],
  ["独占・競業", "exclusivityTerms"],
  ["解除", "terminationTerms"],
  ["賠償・責任", "liabilityTerms"],
  ["準拠法・管轄", "governingLawJurisdiction"],
] as const;

export function ContractOperationalChecks({ terms }: { terms: ProjectContractTerms }) {
  const checks = contractOperationalChecks(terms.operationalChecks);
  const sourceUrl = contractSourceUrl(terms.sourceRef);
  return <div className="border-t border-[#e5e5ea] px-3 py-3 text-sm text-[#1d1d1f]" data-testid="contract-operational-checks">
    <h4 className="font-semibold">契約の論点・必要な手続き</h4>
    <p className="mt-1 text-xs leading-5 text-[#6e6e73]">契約条項の確認結果。今回の相手・資料に対する開示承認の記録は、別途確認する。</p>
    <div className="mt-2 divide-y divide-[#e5e5ea] border-y border-[#e5e5ea]">
      {checks.length ? checks.map(check => <details key={check.id} className="group" open={check.status === "needs_confirmation"}>
        <summary className="cursor-pointer py-2 leading-6 focus-visible:outline-2 focus-visible:outline-[#0071e3]">
          <span className="font-medium">{check.question}</span>
          <span className={`ml-2 inline-block rounded px-2 text-xs ${check.status === "confirmed" ? "bg-[#f0f3f6] text-[#42474d]" : "bg-[#fff4de] text-[#805500]"}`}>{check.status === "confirmed" ? "条項確認済み" : "追加確認が必要"}</span>
        </summary>
        <div className="pb-3 leading-6">
          <p>{check.answer}</p>
          {!!check.actions.length && <ol className="mt-2 space-y-1">{check.actions.map((action, index) => <li key={index} className="flex gap-2"><span className="shrink-0 tabular-nums text-[#6e6e73]">{index + 1}.</span><span><span className="mr-2 text-xs font-medium text-[#6e6e73]">{action.kind === "contract_requirement" ? "契約上の義務" : "開示前の確認"}</span>{action.text}</span></li>)}</ol>}
          {!!check.unresolved.length && <div className="mt-2 border-l-2 border-[#d7ad60] pl-3"><p className="text-xs font-semibold text-[#805500]">まだ確定していないこと</p><ul className="mt-1 list-disc pl-4">{check.unresolved.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
          <p className="mt-2 break-words text-xs leading-5 text-[#6e6e73]">根拠：{check.sourceUrl ? <a className="text-[#0071e3] underline underline-offset-2" href={check.sourceUrl} target="_blank" rel="noopener noreferrer">{check.sourceTitle}</a> : check.sourceTitle} ｜ {check.sourceClause || "条項未確認"} ｜ 確認日 {check.checkedAt || "未確認"}</p>
        </div>
      </details>) : <div className="py-2 leading-6"><p className="font-medium">秘密情報を第三者に開示するときは？ <span className="ml-2 text-xs text-[#805500]">手続き未確認</span></p><p className="text-xs text-[#6e6e73]">この契約の開示条件・承認者・申請方法は確認結果が未登録。下の条項要約と原文から確認する。</p></div>}
    </div>
    <details className="mt-2">
      <summary className="cursor-pointer py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-[#0071e3]">権利・制限・責任の条項要約</summary>
      <dl className="divide-y divide-[#e5e5ea] border-y border-[#e5e5ea]">{legalTerms.map(([label, key]) => <div key={key} className="grid gap-1 py-2 sm:grid-cols-[140px_1fr] sm:gap-3"><dt className="text-xs font-medium text-[#6e6e73]">{label}</dt><dd className="min-w-0 whitespace-pre-wrap break-words text-sm leading-6">{textTerm(terms[key]) || "未確認"}</dd></div>)}</dl>
      {sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-[#0071e3] underline underline-offset-2">要約の根拠文書を開く</a>}
    </details>
  </div>;
}
