"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * TODOごとのptを、MSごとに並べて比べる面。正本は spec 3-21 と 3-22 §5。
 *
 * ゴールツリーの中にptを飛び飛びで出すと「このTODOはpt高すぎないか」を比べられず、
 * ツリーとガントは外部メンバーも見る面なので報酬に直結する数字を置けない
 * （まさ 2026-09-11）。だからMS・月次タブ（内部だけ）にこのリストを置く。
 *
 * 同じMSの中はptの大きい順。棒の長さでPJ内の相対的な重さが分かる。
 */

type Owner = { memberId: string; displayName: string };
type Row = {
  id: string;
  title: string;
  actionKind: "work" | "measure";
  status: string;
  estimatedPt: number | null;
  acceptedPt: number | null;
  plannedEnd: string | null;
  isOverdue: boolean;
  isUnassigned: boolean;
  owners: Owner[];
  ownerLabel: string;
};
type Group = {
  milestoneId: string;
  title: string;
  goalTitle: string | null;
  dueDate: string | null;
  assignedPt: number;
  todoCount: number;
  unassignedCount: number;
  pricedCount: number;
  items: Row[];
};
type View = {
  groups: Group[];
  loose: Row[];
  totals: {
    assignedPt: number;
    todoCount: number;
    pricedCount: number;
    unassignedCount: number;
    maxPt: number;
  };
};

const STATUS_LABEL: Record<string, string> = {
  unassessed: "進捗未登録",
  not_started: "未着手",
  running: "実行中",
  blocked: "止まっている",
  done: "完了",
  dropped: "やめた",
};

function ptText(value: number | null): string {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function ownerText(row: Row): string {
  if (row.owners.length > 0) return row.owners.map((owner) => owner.displayName).join("・");
  return row.ownerLabel;
}

export function CockpitGoalTreePoints({ projectId }: { projectId: string }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/project/${projectId}/question-tree?view=points`);
      const payload = (await response.json()) as View & { error?: string };
      if (!response.ok) throw new Error(payload.error || "読み込めなかったよ");
      setView(payload);
      // 最初は、まだptを配っていないMSを開いておく。そこが手を入れる場所なので。
      setOpenIds(
        new Set(
          payload.groups
            .filter((group) => group.todoCount > 0 && group.pricedCount < group.todoCount)
            .map((group) => group.milestoneId),
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "読み込めなかったよ");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <section className="bg-white rounded-xl border border-[#e5e5e7] px-4 py-3">
        <p className="text-[12px] text-[#86868b]">TODOのptを読み込めなかったよ（{error}）</p>
      </section>
    );
  }
  if (!view) {
    return (
      <section className="bg-white rounded-xl border border-[#e5e5e7] px-4 py-3">
        <p className="text-[12px] text-[#86868b]">TODOのptを読み込んでいる…</p>
      </section>
    );
  }
  if (view.groups.length === 0 && view.loose.length === 0) {
    return null;
  }

  const scale = Math.max(view.totals.maxPt, 1);

  const renderRow = (row: Row) => (
    <div
      key={row.id}
      className="grid grid-cols-[minmax(0,1fr)_96px_120px_88px_84px] items-center gap-2 px-3 py-[3px] border-t border-[#f0f0f2] text-[12px]"
    >
      <span className="min-w-0 truncate text-[#1d1d1f]" title={row.title}>
        {row.title}
        {row.isUnassigned && (
          <span className="ml-1 text-[10px] text-[#86868b]">未アサイン</span>
        )}
      </span>
      {/* 棒でPJ内の相対的な重さを見せる。数字だけだと大小が目に入らない */}
      <span className="flex items-center gap-1">
        <span className="relative h-[6px] flex-1 rounded-full bg-[#f0f0f2]">
          {row.estimatedPt !== null && row.estimatedPt > 0 && (
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-[#027fdc]"
              style={{ width: `${Math.max((row.estimatedPt / scale) * 100, 4)}%` }}
            />
          )}
        </span>
        <b className="w-[28px] shrink-0 text-right tabular-nums text-[#1d1d1f]">
          {ptText(row.estimatedPt)}
        </b>
      </span>
      <span className="truncate text-[#3c3c43]">{ownerText(row)}</span>
      <span className={`tabular-nums ${row.isOverdue ? "text-[#dc2626]" : "text-[#86868b]"}`}>
        {row.plannedEnd ? row.plannedEnd.slice(2).replace(/-/g, "-") : "期限なし"}
      </span>
      <span className="text-[#86868b]">{STATUS_LABEL[row.status] ?? row.status}</span>
    </div>
  );

  return (
    <section className="bg-white rounded-xl border border-[#e5e5e7]">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 border-b border-[#e5e5e7]">
        <h3 className="text-[13px] font-bold text-[#1d1d1f]">TODOのpt</h3>
        <p className="text-[11px] text-[#86868b]">
          MSごとに大きい順。棒はこのPJの中での相対的な重さ
        </p>
        <span className="ml-auto flex gap-3 text-[11px] text-[#86868b]">
          <span>
            配ったpt <b className="text-[13px] text-[#1d1d1f] tabular-nums">{view.totals.assignedPt}</b>
          </span>
          <span>
            pt入力済み{" "}
            <b className="text-[13px] text-[#1d1d1f] tabular-nums">
              {view.totals.pricedCount}/{view.totals.todoCount}
            </b>
          </span>
          <span>
            未アサイン{" "}
            <b className="text-[13px] text-[#1d1d1f] tabular-nums">{view.totals.unassignedCount}</b>
          </span>
        </span>
      </div>

      {view.groups.map((group) => {
        const isOpen = openIds.has(group.milestoneId);
        return (
          <div key={group.milestoneId} className="border-b border-[#e5e5e7] last:border-b-0">
            <button
              type="button"
              className="w-full flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2 text-left hover:bg-[#fafafa]"
              onClick={() =>
                setOpenIds((current) => {
                  const next = new Set(current);
                  if (next.has(group.milestoneId)) next.delete(group.milestoneId);
                  else next.add(group.milestoneId);
                  return next;
                })
              }
            >
              <span
                className={`text-[10px] text-[#86868b] shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
              >
                ▶
              </span>
              <span className="text-[12px] font-bold text-[#1d1d1f]">{group.title}</span>
              {group.goalTitle && (
                <span className="text-[10px] text-[#86868b] truncate max-w-[280px]">
                  {group.goalTitle}
                </span>
              )}
              <span className="ml-auto flex gap-3 text-[11px] text-[#86868b] tabular-nums">
                <span>
                  <b className="text-[12px] text-[#1d1d1f]">{group.assignedPt}</b> pt
                </span>
                <span>
                  TODO <b className="text-[12px] text-[#1d1d1f]">{group.todoCount}</b>
                </span>
                <span>
                  pt未入力{" "}
                  <b className="text-[12px] text-[#1d1d1f]">
                    {group.todoCount - group.pricedCount}
                  </b>
                </span>
                {group.dueDate && <span>{group.dueDate.slice(2)}</span>}
              </span>
            </button>
            {isOpen && group.items.length > 0 && <div>{group.items.map(renderRow)}</div>}
            {isOpen && group.items.length === 0 && (
              <p className="px-4 py-2 text-[11px] text-[#86868b]">このMSの下にTODOがまだ無い。</p>
            )}
          </div>
        );
      })}

      {view.loose.length > 0 && (
        <div className="border-t border-[#e5e5e7]">
          <div className="px-4 py-2">
            <span className="text-[12px] font-bold text-[#1d1d1f]">MSの下にないTODO</span>
            <span className="ml-2 text-[11px] text-[#86868b]">
              {view.loose.length}件。ptを配る前に、ゴールツリーで置き場所を決める
            </span>
          </div>
          {view.loose.map(renderRow)}
        </div>
      )}
    </section>
  );
}
