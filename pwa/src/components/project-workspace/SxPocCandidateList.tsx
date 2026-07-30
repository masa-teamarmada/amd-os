"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { SxManagementBundle } from "@/lib/sx-management";
import { deriveSxPocList } from "@/lib/sx-poc-candidates";
import { sxNormalizePublicName } from "@/lib/sx-name-normalize";
import { sxFormatDate } from "./sx-visual-shared";

/**
 * PoC候補先リスト。かる（輕部）が作った多量排出事業者リストの絞り込み結果と、実際に接触が
 * 進んでいる先を、ゴール（排液の調達）に近い順の1枚で見せる（2026-07-27 まさ指示）。
 *
 * 関係先台帳が「1社ずつボールと約束を追う面」なのに対し、ここは「何社まで積み上がったか」を
 * 数で見る面。母集団や目標社数は登録された事実ではないので、ここでは推測して書かない。
 *
 * カードグリッドではなく罫線区切りの一覧にする（2026-07-30）。数十社を横並びカードで積むと
 * 走査が遅くなるため、候補/現況/最終接点/次の一手/ボール担当/編集を1行で読める表にする。
 */
export function SxPocCandidateList({
  management,
  onEditPartner,
}: {
  management: SxManagementBundle;
  onEditPartner?: (partnerId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const list = deriveSxPocList(management.partners);

  if (list.total === 0) {
    return (
      <p className="border border-dashed border-[#d6cebf] px-3 py-4 text-center text-[11px] text-[#777166]" data-testid="sx-poc-list">
        PoC候補先は未登録。
      </p>
    );
  }

  return (
    <div data-testid="sx-poc-list">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-[#e4ddd0] bg-[#f8f5ec] px-3 py-2">
        <span className="text-[11px] font-bold text-[#24231f]">候補 {list.total}社</span>
        <span className="text-[11px] text-[#514e47]">接触済み {list.contactedCount}社</span>
        <span className="text-[11px] font-semibold text-[#2f6a4f]">排液 調達済 {list.securedCount}社</span>
        <span className="text-[10px] text-[#777166]">
          出典: 多量排出事業者リスト（2026-06-23）とルート別状況（2026-07-21）。母集団の総数と必要社数は台帳未登録。
        </span>
      </div>

      <div className="mt-2">
        {list.groups.map((group) => {
          const collapsed = group.key === "untouched" && !expanded;
          const shown = collapsed ? group.partners.slice(0, 6) : group.partners;
          return (
            <section key={group.key} aria-label={group.label} className="border-x border-b border-[#e4ddd0] first:border-t">
              <div className="flex flex-wrap items-baseline gap-x-2 border-b border-[#e4ddd0] bg-[#f3efe4] px-2 py-1">
                <h4 className="text-[11px] font-bold text-[#24231f]">{group.label} {group.partners.length}社</h4>
                <span className="text-[10px] text-[#777166]">{group.hint}</span>
              </div>

              {/* desktop / tablet: ruled table, one row per candidate */}
              <table className="hidden w-full table-fixed border-collapse text-[11px] sm:table">
                <thead>
                  <tr className="border-b border-[#e4ddd0] text-left text-[10px] font-semibold text-[#777166]">
                    <th className="px-2 py-1 font-semibold">候補</th>
                    <th className="px-2 py-1 font-semibold">現況</th>
                    <th className="px-2 py-1 font-semibold">最終接点</th>
                    <th className="px-2 py-1 font-semibold">次の一手</th>
                    <th className="px-2 py-1 font-semibold">ボール担当</th>
                    {onEditPartner && management.canManage && <th className="w-8 px-2 py-1" />}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((partner) => (
                    <tr key={partner.id} className="border-b border-[#eee9df] last:border-b-0">
                      <td className="max-w-[12rem] truncate px-2 py-1 font-semibold text-[#24231f]" title={partner.name}>{partner.name}</td>
                      <td className="px-2 py-1 text-[#514e47]">{group.label}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-[#514e47]">{sxFormatDate(partner.lastContactDate, "未接触")}</td>
                      <td className="max-w-[16rem] truncate px-2 py-1 text-[#69665d]" title={group.key === "untouched" ? "" : sxNormalizePublicName(partner.nextCommitment)}>
                        {group.key === "untouched" ? "—" : sxNormalizePublicName(partner.nextCommitment) || "未設定"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 text-[#514e47]">
                        {partner.currentBallOwner ? sxNormalizePublicName(partner.currentBallOwner) : partner.ownerLabel ? sxNormalizePublicName(partner.ownerLabel) : "担当未確認"}
                      </td>
                      {onEditPartner && management.canManage && (
                        <td className="px-2 py-1 text-right">
                          <button
                            type="button"
                            onClick={() => onEditPartner(partner.id)}
                            className="min-h-11 min-w-11 rounded border border-[#d6cebf] p-1 text-[#514e47] hover:bg-[#f1eee5]"
                            aria-label={`${partner.name}を編集`}
                          >
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* mobile: same row data, two-tier layout instead of a card grid */}
              <ul className="sm:hidden">
                {shown.map((partner) => (
                  <li key={partner.id} className="border-b border-[#eee9df] px-2 py-1.5 last:border-b-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[#24231f]" title={partner.name}>{partner.name}</span>
                      <span className="shrink-0 text-[10px] text-[#514e47]">{group.label}</span>
                      {onEditPartner && management.canManage && (
                        <button
                          type="button"
                          onClick={() => onEditPartner(partner.id)}
                          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded border border-[#d6cebf] text-[#514e47] hover:bg-[#f1eee5]"
                          aria-label={`${partner.name}を編集`}
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[10px] text-[#69665d]">
                      <span>最終接点 {sxFormatDate(partner.lastContactDate, "未接触")}</span>
                      <span>ボール {partner.currentBallOwner ? sxNormalizePublicName(partner.currentBallOwner) : partner.ownerLabel ? sxNormalizePublicName(partner.ownerLabel) : "担当未確認"}</span>
                    </div>
                    {group.key !== "untouched" && (
                      <p className="mt-0.5 truncate text-[10px] text-[#514e47]" title={sxNormalizePublicName(partner.nextCommitment)}>
                        次の一手: {sxNormalizePublicName(partner.nextCommitment) || "未設定"}
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              {collapsed && group.partners.length > shown.length && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="flex min-h-[44px] w-full items-center justify-center border-t border-[#e4ddd0] px-2 py-2 text-[10px] font-semibold text-[#514e47] hover:bg-[#f1eee5]"
                >
                  未接触の候補をすべて表示（残り {group.partners.length - shown.length}社）
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
