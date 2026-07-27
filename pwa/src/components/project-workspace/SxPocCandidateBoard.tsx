"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { SxManagementBundle } from "@/lib/sx-management";
import { deriveSxPocBoard } from "@/lib/sx-poc-candidates";
import { sxNormalizePublicName } from "@/lib/sx-name-normalize";

/**
 * PoC候補先ボード。かる（輕部）が作った多量排出事業者リストの絞り込み結果と、実際に接触が
 * 進んでいる先を、ゴール（排液の調達）に近い順の1枚で見せる（2026-07-27 まさ指示）。
 *
 * 関係先台帳が「1社ずつボールと約束を追う面」なのに対し、ここは「何社まで積み上がったか」を
 * 数で見る面。母集団や目標社数は登録された事実ではないので、ここでは推測して書かない。
 */
export function SxPocCandidateBoard({
  management,
  onEditPartner,
}: {
  management: SxManagementBundle;
  onEditPartner?: (partnerId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const board = deriveSxPocBoard(management.partners);

  if (board.total === 0) {
    return (
      <p className="rounded-md border border-dashed border-[#d6cebf] px-3 py-4 text-center text-[11px] text-[#777166]" data-testid="sx-poc-board">
        PoC候補先は未登録。
      </p>
    );
  }

  return (
    <div data-testid="sx-poc-board">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-[#e4ddd0] bg-[#f8f5ec] px-3 py-2">
        <span className="text-[11px] font-bold text-[#24231f]">候補 {board.total}社</span>
        <span className="text-[11px] text-[#514e47]">接触済み {board.contactedCount}社</span>
        <span className="text-[11px] font-semibold text-[#2f6a4f]">排液 調達済 {board.securedCount}社</span>
        <span className="text-[10px] text-[#777166]">
          出典: 多量排出事業者リスト（2026-06-23）とルート別状況（2026-07-21）。母集団の総数と必要社数は台帳未登録。
        </span>
      </div>

      <div className="mt-2 space-y-2">
        {board.groups.map((group) => {
          const collapsed = group.key === "untouched" && !expanded;
          const shown = collapsed ? group.partners.slice(0, 6) : group.partners;
          return (
            <section key={group.key} aria-label={group.label}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <h4 className="text-[11px] font-bold text-[#24231f]">{group.label} {group.partners.length}社</h4>
                <span className="text-[10px] text-[#777166]">{group.hint}</span>
              </div>
              <ul className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((partner) => (
                  <li
                    key={partner.id}
                    className={`min-w-0 rounded-md border px-2 py-1.5 ${group.key === "secured" ? "border-[#9dbfa9] bg-[#f1f7f2]" : group.key === "agreed" ? "border-[#d5bc82] bg-[#fbf1dc]" : "border-[#e4ddd0] bg-[#fffdf7]"}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[#24231f]" title={partner.name}>{partner.name}</span>
                      {onEditPartner && management.canManage && (
                        <button
                          type="button"
                          onClick={() => onEditPartner(partner.id)}
                          className="min-h-0 min-w-0 shrink-0 rounded border border-[#d6cebf] p-0.5 text-[#514e47] hover:bg-[#f1eee5]"
                          aria-label={`${partner.name}を編集`}
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-[#69665d]" title={partner.agreedScope}>{partner.agreedScope}</p>
                    {group.key !== "untouched" && (
                      <p className="mt-0.5 truncate text-[10px] text-[#514e47]" title={sxNormalizePublicName(partner.nextCommitment)}>
                        次の一手: {sxNormalizePublicName(partner.nextCommitment)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {collapsed && group.partners.length > shown.length && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="mt-1 rounded border border-[#d6cebf] px-2 py-1 text-[10px] font-semibold text-[#514e47] hover:bg-[#f1eee5]"
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
