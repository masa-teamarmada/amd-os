"use client";

import { useCallback, useEffect, useState } from "react";

import { loadGoalTreePoints, mutateQuestionTree, peekGoalTreePoints } from "@/lib/question-tree-client";

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
  doneEvidence: string | null;
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
  asOf: string;
  canReviewTaskPt?: boolean;
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
  const [view, setView] = useState<View | null>(() => peekGoalTreePoints<View>(projectId) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewPt, setReviewPt] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      // キャッシュ層を通す。開くたびに往復しない（spec 5-10）
      const payload = await loadGoalTreePoints<View>(projectId);
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

  if (error && !view) {
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

  const submitReview = async (row: Row) => {
    const value = Number(reviewPt);
    if (!Number.isFinite(value) || value < 0 || Math.round(value * 10) / 10 !== value) {
      setError("確定ptは0以上・小数1桁で入力");
      return;
    }
    setReviewBusy(true);
    setError(null);
    try {
      const result = await mutateQuestionTree(projectId, "PATCH", {
        resource: "action_pt_review", action_id: row.id, accepted_pt: value,
      });
      setReviewingId(null);
      setReviewPt("");
      await load();
      if (result.rewardSyncError) setError(`検収は記録したよ。報酬の再計算だけ要確認: ${result.rewardSyncError}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "検収できなかったよ");
    } finally {
      setReviewBusy(false);
    }
  };

  const renderRow = (row: Row) => (
    <div key={row.id} className="border-t border-[#f0f0f2] px-3 py-2 text-[12px]">
      <div className="grid grid-cols-2 items-center gap-x-3 gap-y-1 lg:grid-cols-[minmax(0,1fr)_96px_120px_88px_84px] lg:gap-2">
      <span className="col-span-2 min-w-0 break-words font-medium text-[#1d1d1f] lg:col-span-1 lg:truncate" title={row.title}>
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
      <span className="min-w-0 truncate text-[#3c3c43]">{ownerText(row)}</span>
      <span className={`tabular-nums ${row.isOverdue ? "text-[#dc2626]" : "text-[#86868b]"}`}>
        {row.plannedEnd ? row.plannedEnd.slice(2).replace(/-/g, "-") : "期限なし"}
      </span>
      <span className="text-[#86868b]">{STATUS_LABEL[row.status] ?? row.status}</span>
      </div>
      {projectId === "p21" && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-1 text-[11px] text-[#6e6e73]">
          <span>見積 {ptText(row.estimatedPt)}pt</span>
          <span className={row.acceptedPt != null ? "font-semibold text-emerald-800" : ""}>
            検収 {row.acceptedPt == null ? "待ち" : `${ptText(row.acceptedPt)}pt`}
          </span>
          {row.status === "done" && row.doneEvidence && <span className="max-w-full truncate" title={row.doneEvidence}>証跡: {row.doneEvidence}</span>}
          {view.canReviewTaskPt && view.asOf >= "2026-10-01" && row.status === "done" && row.acceptedPt == null && row.doneEvidence && (
            <button type="button" className="min-h-11 rounded border border-sky-200 bg-sky-50 px-3 font-semibold text-sky-800 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500" onClick={() => { setReviewingId(row.id); setReviewPt(String(row.estimatedPt ?? 0)); }}>
              検収する
            </button>
          )}
        </div>
      )}
      {reviewingId === row.id && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-2 py-2 text-[11px]">
          <label htmlFor={`accepted-pt-${row.id}`} className="font-semibold text-sky-950">確定pt</label>
          <input id={`accepted-pt-${row.id}`} type="number" min="0" step="0.1" value={reviewPt} onChange={(event) => setReviewPt(event.target.value)} className="min-h-11 w-20 rounded border border-sky-300 bg-white px-2 py-1 text-right tabular-nums" />
          <span className="text-sky-900">検収すると担当者の報酬ptに入る</span>
          <button type="button" disabled={reviewBusy} className="min-h-11 rounded bg-sky-700 px-3 py-1 font-semibold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500" onClick={() => void submitReview(row)}>{reviewBusy ? "記録中…" : "確定"}</button>
          <button type="button" disabled={reviewBusy} className="min-h-11 rounded px-3 py-1 text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500" onClick={() => setReviewingId(null)}>やめる</button>
        </div>
      )}
    </div>
  );

  return (
    <section className="bg-white rounded-xl border border-[#e5e5e7]">
      {error && <p role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-900">{error}</p>}
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
