"use client";

import { useMemo } from "react";
import {
  resolveObligationCatalog,
  type ObligationCoverage,
} from "@/lib/admin-schedule/rules/statutory-obligation-catalog";
import type { OperatingFact } from "@/lib/admin-schedule/types";

export type CatalogOccurrenceInput = {
  event_kind: string;
  title: string;
  due_on: string | null;
  lifecycle_status: string;
};

const COVERAGE_LABELS: Record<ObligationCoverage, string> = {
  generated: "カレンダーに出ている",
  needs_fact: "会社の情報が足りない",
  not_applicable: "該当しない",
  not_implemented: "仕組みがまだ無い",
};

const COVERAGE_STYLES: Record<ObligationCoverage, string> = {
  generated: "bg-emerald-100 text-emerald-900",
  needs_fact: "bg-amber-100 text-amber-950",
  not_applicable: "bg-muted text-muted-foreground",
  not_implemented: "bg-rose-100 text-rose-950",
};

const FACT_LABELS: Record<string, string> = {
  fiscal_year_end_month: "決算月",
  previous_corporate_tax_yen: "前期の法人税額",
  corporate_tax_interim_required: "法人税の中間申告が要るか",
  consumption_tax_filing_mode: "消費税の申告区分",
  withholding_payment_mode: "源泉所得税の納付方式",
  payroll_closing_day: "給与の締日",
  payroll_payment_day: "給与の支給日",
  year_end_adjustment_deadline_ymd: "年末調整の締切",
  social_insurance_enrollment: "社会保険の加入",
  labor_insurance_enrollment: "労働保険の加入",
  depreciable_assets_held: "償却資産を持っているか",
  real_estate_held: "土地・建物を持っているか",
  vehicles_held: "社用車を持っているか",
  resident_tax_special_collection_enrollment: "住民税を給与から天引きしているか",
  bonus_payments: "賞与を払うか",
  stamp_duty_taxable_documents: "印紙が要る契約書があるか",
};

function factLabel(key: string): string {
  return FACT_LABELS[key] ?? key;
}

/**
 * 会社が負う税・保険料・提出の全件。カレンダーに出ていないものも、出ていない理由とともに残す。
 * 生成できたものだけを並べると、仕組みの無い義務が画面から消えて誰も気づけない。
 */
export function StatutoryObligationCatalog({
  occurrences,
  facts,
  today,
}: {
  occurrences: CatalogOccurrenceInput[];
  facts: OperatingFact[];
  today: string;
}) {
  const resolved = useMemo(() => {
    const knownFactKeys = new Set(
      facts
        .filter((fact) => !fact.superseded_at && (fact.value_json as { missing?: boolean } | null)?.missing !== true)
        .map((fact) => fact.fact_key)
    );
    return resolveObligationCatalog(occurrences, knownFactKeys, today);
  }, [facts, occurrences, today]);
  const gaps = resolved.filter((entry) => entry.coverage !== "generated" && entry.coverage !== "not_applicable");
  return (
    <section aria-labelledby="obligation-catalog-title" data-testid="statutory-obligation-catalog" className="space-y-3 border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="obligation-catalog-title" className="text-lg font-semibold">会社が負う税・保険料・提出の全件</h2>
        <p className="text-sm text-muted-foreground">
          {resolved.length}件のうち{gaps.length}件はまだ予定を作れていない。作れない理由と、埋めるのに要る情報を各行に書いた。
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-semibold">名前</th>
              <th scope="col" className="py-2 pr-3 font-semibold">納付先・提出先</th>
              <th scope="col" className="py-2 pr-3 font-semibold">いつ</th>
              <th scope="col" className="py-2 pr-3 font-semibold">いまの状態</th>
              <th scope="col" className="py-2 font-semibold">補足</th>
            </tr>
          </thead>
          <tbody>
            {resolved.map((entry) => (
              <tr key={entry.key} className="border-b border-border/60 align-top">
                <td className="py-2 pr-3">
                  <a href={entry.officialUrl} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2 hover:no-underline">{entry.title}</a>
                  <span className="ml-1 text-xs text-muted-foreground">{entry.kind === "filing" ? "提出" : "納付"}</span>
                </td>
                <td className="py-2 pr-3 text-xs">{entry.payee}</td>
                <td className="py-2 pr-3 text-xs">{entry.cadence}</td>
                <td className="py-2 pr-3">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${COVERAGE_STYLES[entry.coverage]}`}>{COVERAGE_LABELS[entry.coverage]}</span>
                  {entry.coverage === "generated" && (
                    <span className="ml-1 text-xs text-muted-foreground tabular-nums">{entry.occurrenceCount}件{entry.nextDueOn && ` / 次は${entry.nextDueOn}`}</span>
                  )}
                </td>
                <td className="py-2 text-xs leading-5">
                  {entry.missingFacts.length > 0 && (
                    <span className="mr-1 font-semibold">足りない情報: {entry.missingFacts.map(factLabel).join("、")}。</span>
                  )}
                  {entry.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
