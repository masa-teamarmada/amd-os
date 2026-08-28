/**
 * PJ概要タブ「シーズン予算と消化」。
 *
 * まさ依頼 2026-08-28:「各PJのそのシーズンの予算配分をちゃんとPJコックピットに書いておくといい。
 * 予算を棒グラフで示して、ここまで消化している、ここは未消化、ってのが視覚的にも分かるように」。
 *
 * 数字は `/admin/season-pl` (シーズン予実表) と同じ `computeSeasonPl` の結果をそのまま読む。
 * この画面で別計算をしない。設計正本: pwa/design/season_budget_actual.md
 */
"use client";

import { useEffect, useState } from "react";
import type { SeasonBudgetSeason } from "@/app/api/project/[projectId]/season-budget/route";
import { loadSeasonBudget, peekSeasonBudget } from "@/lib/season-budget-client";

function fmtYen(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function fmtPct(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function ymLabel(ym: string) {
  return /^\d{6}$/.test(ym) ? `${ym.slice(0, 4)}/${ym.slice(4, 6)}` : ym;
}

type BarPart = { label: string; value: number; className: string; note?: string };

/** 横一本の積み上げ棒。合計に対する各部分の割合をそのまま幅にする。 */
function StackedBar({ parts, total }: { parts: BarPart[]; total: number }) {
  const shown = parts.filter((part) => part.value > 0);
  return (
    <div className="mt-2">
      <div className="flex h-7 w-full overflow-hidden rounded border border-[#d6d6da] bg-[#f2f2f5]">
        {shown.map((part) => (
          <div
            key={part.label}
            className={`h-full ${part.className}`}
            style={{ width: total > 0 ? `${(part.value / total) * 100}%` : "0%" }}
            title={`${part.label} ${fmtYen(part.value)}`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((part) => (
          <span key={part.label} className="inline-flex items-baseline gap-1.5 text-[11px]">
            <span className={`inline-block size-2.5 shrink-0 rounded-sm ${part.className}`} aria-hidden />
            <span className="font-medium text-[#1d1d1f]">{part.label}</span>
            <span className="tabular-nums text-[#3c3c43]">{fmtYen(part.value)}</span>
            <span className="tabular-nums text-[#8e8e93]">{fmtPct(part.value, total)}</span>
            {part.note && <span className="text-[#8e8e93]">{part.note}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * 検算バッジ。`tone="note"` は「異常ではないが見ておく値」。
 * 未割当ptは将来MS用に意図して残すことがあるので赤にしない
 * (SXは13ptを意図的に残す。pwa/design/season_budget_actual.md 2026-07-29 確定)。
 */
function CheckBadge({ ok, label, tone = "check" }: { ok: boolean; label: string; tone?: "check" | "note" }) {
  const className = ok
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : tone === "note"
      ? "border-[#d6d6da] bg-[#f5f5f7] text-[#3c3c43]"
      : "border-red-200 bg-red-50 text-red-800";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      {ok ? "✓" : tone === "note" ? "·" : "!"} {label}
    </span>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 border-l border-[#e5e5e7] px-3 first:border-l-0 first:pl-0">
      <p className="text-[11px] text-[#8e8e93]">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-[#1d1d1f]">{value}</p>
      {note && <p className="mt-0.5 truncate text-[10px] text-[#8e8e93]">{note}</p>}
    </div>
  );
}

function SeasonCard({ season }: { season: SeasonBudgetSeason }) {
  const checks = season.checks;
  // ① クライアント請求が何に分かれるか。バッファ + メンバー原資(65%) + AMD(35%) = 請求額。
  const revenueParts: BarPart[] = [
    { label: "バッファ", value: season.bufferTotalYen, className: "bg-amber-300", note: season.bufferBreakdownSet ? "" : "内訳未設定・逆算" },
    { label: "メンバー原資", value: season.memberBudgetYen, className: "bg-sky-400" },
    { label: "AMD", value: season.amdMarginYen, className: "bg-emerald-400" },
  ];

  // ② メンバー原資をどこまで使ったか。
  // 支払済み = 現金で出た分、社内配賦 = 支払対象外メンバーへ割り当てた分 (現金は出ない)、
  // 未払い残 = 発生済みでまだ払えていない分、未消化 = まだ誰の取り分にもなっていない残り。
  const paidToMembersYen = season.members
    .filter((member) => member.reserveKind === "cash")
    .reduce((sum, member) => sum + member.paidYen, 0);
  const reserveYen = season.members
    .filter((member) => member.reserveKind === "company_reserve")
    .reduce((sum, member) => sum + member.paidYen, 0);
  // メンバー別が見えない (非admin) ときは内訳を出さず、消化合計だけ見せる
  const consumedYen = season.paidSumYen;
  const stockYen = season.finalStockSumYen;
  const remainingYen = Math.max(0, season.memberBudgetYen - consumedYen - stockYen);
  const allocationParts: BarPart[] = season.membersVisible
    ? [
        { label: "支払済み", value: paidToMembersYen, className: "bg-emerald-500" },
        { label: "社内配賦", value: reserveYen, className: "bg-slate-400", note: "現金は出ない" },
        { label: "未払い残", value: stockYen, className: "bg-amber-400" },
        { label: "未消化", value: remainingYen, className: "bg-[#e5e5ea]" },
      ]
    : [
        { label: "消化済み", value: consumedYen, className: "bg-emerald-500" },
        { label: "未払い残", value: stockYen, className: "bg-amber-400" },
        { label: "未消化", value: remainingYen, className: "bg-[#e5e5ea]" },
      ];

  return (
    <div className="rounded-md border border-[#e5e5e7] bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[13px] font-semibold text-[#1d1d1f]">
          {ymLabel(season.periodStartYm)} 〜 {ymLabel(season.periodEndYm)}
          <span className="ml-2 text-[11px] font-normal text-[#8e8e93]">{season.cycleMonths}か月・税抜</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          <CheckBadge ok={checks.closes} label="請求額と内訳が一致" />
          <CheckBadge ok={checks.budgetMatchesMonthlyCaps} label="原資と月枠の合計が一致" />
          <CheckBadge
            ok={checks.ptFullyAssigned}
            tone="note"
            label={checks.ptFullyAssigned ? "pt割当済み" : `未割当 ${checks.unassignedPt}pt`}
          />
          <CheckBadge ok={checks.officerStockConverges} label="対象外メンバーの繰越が収束" />
        </div>
      </div>

      <div className="mt-3">
        <p className="text-[12px] font-semibold text-[#1d1d1f]">
          クライアント請求 {fmtYen(season.invoiceTotalYen)} の内訳
        </p>
        <p className="mt-0.5 text-[11px] text-[#8e8e93]">
          先にバッファ（営業費用・旅費など）を引き、残りの65%がメンバーへ配れる原資、35%がAMDの取り分。
        </p>
        <StackedBar parts={revenueParts} total={season.invoiceTotalYen} />
      </div>

      <div className="mt-4">
        <p className="text-[12px] font-semibold text-[#1d1d1f]">
          メンバー原資 {fmtYen(season.memberBudgetYen)} の消化
        </p>
        <p className="mt-0.5 text-[11px] text-[#8e8e93]">
          MSの消化ptに応じて各メンバーの取り分が決まる。月々の支払枠に収まらない分は未払い残として翌月へ回る。
        </p>
        <StackedBar parts={allocationParts} total={season.memberBudgetYen} />
      </div>

      <div className="mt-4 flex flex-wrap gap-y-3 border-t border-[#e5e5e7] pt-3">
        <Metric label="入金確認済み" value={fmtYen(season.invoiceConfirmedYen)} note={`請求の ${fmtPct(season.invoiceConfirmedYen, season.invoiceTotalYen)}`} />
        <Metric label="pt単価 (本契約)" value={fmtYen(season.regularPtUnitYen)} note={checks.ptUnitConsistent ? "契約と整合" : `想定 ${fmtYen(checks.ptUnitExpected)}`} />
        <Metric label="消化pt" value={`${Math.round(season.earnedPtSum * 100) / 100} / ${season.totalPoints}pt`} note={`MS設定 ${season.msPointsSum}pt`} />
        {season.extraPoolBudgetYen > 0 && (
          <Metric label="別財布の原資" value={fmtYen(season.extraPoolBudgetYen)} note={`別契約分・${season.extraPointsSum}pt`} />
        )}
        <Metric label="シーズン末の未払い残" value={fmtYen(season.finalStockSumYen)} note={season.finalStockSumYen > 0 ? "0で閉じるのが正" : "0で閉じる見込み"} />
      </div>

      {season.membersVisible && season.members.length > 0 && (
        <div className="mt-4 overflow-x-auto border-t border-[#e5e5e7] pt-3">
          <p className="mb-2 text-[12px] font-semibold text-[#1d1d1f]">メンバー別（pt比の取り分と実績）</p>
          <table className="w-full min-w-[560px] text-[11px]">
            <thead className="border-b border-[#e5e5e7] text-[#8e8e93]">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">メンバー</th>
                <th className="px-2 py-1.5 text-right font-medium">消化pt</th>
                <th className="px-2 py-1.5 text-right font-medium">pt比の取り分</th>
                <th className="px-2 py-1.5 text-right font-medium">配賦済み</th>
                <th className="px-2 py-1.5 text-right font-medium">未払い残</th>
                <th className="px-2 py-1.5 text-right font-medium">差</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2f2f5]">
              {season.members.map((member) => (
                <tr key={member.memberId}>
                  <td className="px-2 py-1.5">
                    <span className="font-medium text-[#1d1d1f]">{member.memberName}</span>
                    {member.reserveKind === "company_reserve" && (
                      <span className="ml-1.5 rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[10px] text-slate-600">
                        現金支払なし
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{Math.round(member.earnedPt * 100) / 100}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtYen(member.budgetShareYen)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtYen(member.paidYen)}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${member.finalStockYen > 0 ? "text-amber-800" : ""}`}>
                    {fmtYen(member.finalStockYen)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-[#8e8e93]">
                    {member.convergenceDeltaYen === 0 ? "0" : fmtYen(member.convergenceDeltaYen)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1.5 text-[10px] text-[#8e8e93]">
            「差」は（配賦済み＋未払い残）−（pt比の取り分）。期中はずれるのが正常で、シーズン最終月に0へ収束する。
          </p>
        </div>
      )}
    </div>
  );
}

export function CockpitSeasonBudget({ projectId }: { projectId: string }) {
  const [seasons, setSeasons] = useState<SeasonBudgetSeason[] | null>(
    () => peekSeasonBudget(projectId)?.seasons ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadSeasonBudget(projectId)
      .then((payload) => {
        if (!alive) return;
        setSeasons(payload.seasons);
        setError(null);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, [projectId]);

  return (
    <section
      data-testid="cockpit-season-budget"
      className="overflow-hidden rounded-md border border-[#d6d6da] bg-white shadow-sm"
      aria-label="シーズン予算と消化"
    >
      <div className="border-b border-[#e5e5e7] bg-[#fafafa] px-4 py-2.5">
        <h2 className="text-[13px] font-semibold text-[#1d1d1f]">シーズン予算と消化</h2>
        <p className="mt-0.5 text-[11px] text-[#8e8e93]">
          このPJの契約期間で、いくら請求して、いくらメンバーへ配れて、どこまで配り終えたか。
          数字は支払通知書と同じ計算（シーズン予実表）から読む。
        </p>
      </div>
      <div className="space-y-3 p-4">
        {error && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-900">{error}</p>
        )}
        {!error && seasons == null && <p className="text-[12px] text-[#8e8e93]">読み込み中…</p>}
        {!error && seasons != null && seasons.length === 0 && (
          <p className="text-[12px] text-[#8e8e93]">
            このPJには進行中のシーズン（plan cycle）がまだありません。
          </p>
        )}
        {seasons && seasons.length > 0 && <SeasonCard season={seasons[0]} />}
        {seasons && seasons.length > 1 && (
          <details className="rounded-md border border-[#e5e5e7] bg-[#fafafa]">
            <summary className="cursor-pointer list-none px-4 py-2.5 text-[12px] font-semibold text-[#1d1d1f]">
              過去のシーズン {seasons.length - 1}件を見る
              <span className="ml-2 font-normal text-[#8e8e93]">
                {seasons.slice(1).map((season) => `${ymLabel(season.periodStartYm)}〜${ymLabel(season.periodEndYm)}`).join(" / ")}
              </span>
            </summary>
            <div className="space-y-3 px-3 pb-3">
              {seasons.slice(1).map((season) => (
                <SeasonCard key={season.planCycleId} season={season} />
              ))}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
