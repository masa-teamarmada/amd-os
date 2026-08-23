"use client";

/**
 * AMDがこのPJへ行ってきたこと。
 * 正本: pwa/spec/4-7-amd-contributions-current-spec.md
 *
 * 守ること:
 *   - 日付の新しい順に並べる。impact や件数で並べ替えて「大きい貢献」を上へ出さない
 *   - 件数を貢献度の指標として大きく出さない。母数としてだけ小さく添える
 *   - 「記録から拾えた分だけ」と必ず出す。無記録を「やっていない」に見せない
 *   - 推定 (source=inferred) は行ごとに推定と出し、観測へ昇格させない
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AmdContributionItem, AmdContributionsPayload } from "@/lib/amd-contributions";
import { loadAmdContributions, peekAmdContributions } from "@/lib/amd-contributions-client";

/** 初期に開いておく月数。それ以前は畳む (長いPJでも進捗タブの末尾が伸びきらないように)。 */
const OPEN_MONTHS = 2;

function formatYm(ym: string): string {
  if (!/^\d{6}$/.test(ym)) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
}

function formatMd(ymd: string): string {
  if (ymd.length < 10) return ymd;
  return `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`;
}

function ContributionRow({ item }: { item: AmdContributionItem }) {
  return (
    <li className="flex gap-3 border-t border-[#f0f0f2] px-4 py-2 first:border-t-0">
      <div className="w-10 shrink-0 pt-0.5 text-[11px] tabular-nums text-[#86868b]">{formatMd(item.occurredOn)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.kind === "meeting" && (
            <span className="shrink-0 rounded border border-[#c7d7e0] bg-[#eef4f8] px-1.5 py-0.5 text-[10px] font-semibold text-[#376274]">
              打ち合わせ
            </span>
          )}
          {item.memberNames.map((name, index) => (
            <Link
              key={`${item.key}:${item.memberIds[index] ?? name}`}
              href={`/mypage?memberId=${encodeURIComponent(item.memberIds[index] ?? "")}`}
              className="shrink-0 rounded border border-[#e5e5e7] bg-[#fafafa] px-1.5 py-0.5 text-[10px] text-[#1d1d1f] hover:bg-[#f0f0f2]"
            >
              {name}
            </Link>
          ))}
          <span className="min-w-0 text-[13px] leading-5 text-[#1d1d1f]">{item.title}</span>
        </div>
        {item.detail && <p className="mt-0.5 text-[12px] leading-5 text-[#5b5b60]">{item.detail}</p>}
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[#86868b]">
          <span>出所: {item.sourceLabel}</span>
          {item.evidenceStage === "inferred" && (
            <span className="rounded border border-amber-300 bg-amber-50 px-1 py-0.5 font-semibold text-amber-800">
              推定
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function MonthBlock({ ym, items }: { ym: string; items: AmdContributionItem[] }) {
  return (
    <div className="border-t border-[#e5e5e7]">
      <div className="bg-[#fafafa] px-4 py-1.5 text-[11px] font-semibold text-[#5b5b60]">{formatYm(ym)}</div>
      <ul>
        {items.map((item) => (
          <ContributionRow key={item.key} item={item} />
        ))}
      </ul>
    </div>
  );
}

export function CockpitAmdContributions({ projectId }: { projectId: string }) {
  const [payload, setPayload] = useState<AmdContributionsPayload | null>(
    () => peekAmdContributions(projectId) ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = peekAmdContributions(projectId);
    setPayload(cached ?? null);
    setError(null);
    loadAmdContributions(projectId)
      .then((json) => {
        if (!cancelled) setPayload(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "AMDの活動記録の取得に失敗");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const grouped = new Map<string, AmdContributionItem[]>();
  for (const item of payload?.items ?? []) {
    const current = grouped.get(item.ym) ?? [];
    current.push(item);
    grouped.set(item.ym, current);
  }
  const months = [...grouped.keys()];
  const openMonths = months.slice(0, OPEN_MONTHS);
  const foldedMonths = months.slice(OPEN_MONTHS);

  return (
    <section
      data-testid="cockpit-amd-contributions"
      className="overflow-hidden rounded-xl border border-[#e5e5e7] bg-white"
      aria-labelledby="amd-contributions-title"
    >
      <div className="px-4 py-3">
        <h3 id="amd-contributions-title" className="text-[13px] font-semibold text-[#1d1d1f]">
          AMDがこのPJへ行ってきたこと
        </h3>
        <p className="mt-1 text-[11px] leading-4 text-[#86868b]">
          AMD OSが生データ（週次の活動記録・カレンダー・メール・MTGサマリ）から拾えた分だけを日付順に並べている。
          ここに無いことは「やっていない」ではなく「記録から拾えていない」。手で書き足す欄は持たない。
        </p>
        {payload && payload.items.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#5b5b60]">
            <span>
              期間: {payload.firstOn} 〜 {payload.lastOn}（記録のある月 {payload.activeMonths}か月）
            </span>
            {payload.members.length > 0 && (
              <span className="flex flex-wrap items-center gap-1">
                関わったメンバー:
                {payload.members.map((member) => (
                  <Link
                    key={member.memberId}
                    href={`/mypage?memberId=${encodeURIComponent(member.memberId)}`}
                    className="rounded border border-[#e5e5e7] bg-[#fafafa] px-1.5 py-0.5 text-[10px] text-[#1d1d1f] hover:bg-[#f0f0f2]"
                  >
                    {member.codeName}
                  </Link>
                ))}
              </span>
            )}
          </div>
        )}
      </div>

      {error ? (
        <div className="border-t border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800">{error}</div>
      ) : !payload ? (
        <div className="border-t border-[#e5e5e7] px-4 py-4 text-[12px] text-[#86868b]">読み込み中…</div>
      ) : payload.items.length === 0 ? (
        <div className="border-t border-[#e5e5e7] px-4 py-4 text-[12px] leading-5 text-[#86868b]">
          このPJに紐づくAMDの活動記録がまだ拾えていない（活動が無いという意味ではない）。
          週次の活動記録とMTGサマリがこのPJへ紐づくと、ここに自動で並ぶ。
        </div>
      ) : (
        <>
          {openMonths.map((ym) => (
            <MonthBlock key={ym} ym={ym} items={grouped.get(ym) ?? []} />
          ))}
          {foldedMonths.length > 0 && (
            <details className="border-t border-[#e5e5e7]">
              <summary className="cursor-pointer list-none px-4 py-2 text-[12px] text-[#376274] marker:content-none hover:bg-[#fafafa]">
                ▶ それ以前（{formatYm(foldedMonths[foldedMonths.length - 1])} 〜 {formatYm(foldedMonths[0])}）を開く
              </summary>
              {foldedMonths.map((ym) => (
                <MonthBlock key={ym} ym={ym} items={grouped.get(ym) ?? []} />
              ))}
            </details>
          )}
          <div className="border-t border-[#e5e5e7] bg-[#fafafa] px-4 py-2 text-[10px] leading-4 text-[#86868b]">
            記録から拾えた活動 {payload.recordedCount}件。
            {payload.truncated && " 上限に達したため古い記録は省いている。"}
            この件数は貢献の大きさではなく、拾えた記録の母数。
          </div>
        </>
      )}
    </section>
  );
}
