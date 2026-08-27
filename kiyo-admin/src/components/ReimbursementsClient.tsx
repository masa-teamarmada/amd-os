"use client";

/**
 * 「01 立替精算」— 一覧を見て、承認 / 却下する。
 *
 * 金額は申請者が入力した実費をそのまま出しているだけ。ここで計算はしない。
 * 承認の判定・状態の進み方・通知は AMD OS 本体が持っている。
 * この画面は本体の /api/reimbursements/decision に取り次いでいるだけ。
 */

import { useCallback, useEffect, useState } from "react";

type Row = {
  reimbursementId: string;
  projectId: string | null;
  projectName: string | null;
  date: string | null;
  description: string | null;
  category: string | null;
  amountYen: number;
  taxRate: number;
  status: string;
  applicant: string | null;
  pmApprovedBy: string | null;
  pmApprovedAt: string | null;
  adminApprovedBy: string | null;
  adminApprovedAt: string | null;
};

type ApiData = {
  ok?: boolean;
  error?: string;
  rows: Row[];
  summary: {
    total: number;
    shown: number;
    countByStatus: Record<string, number>;
    shownAmountYen: number;
  };
};

const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;

const STATUS_LABEL: Record<string, string> = {
  submitted: "申請済み（PM承認待ち）",
  pmApproved: "PM承認済み（きよの承認待ち）",
  pmapproved: "PM承認済み（きよの承認待ち）",
  approved: "承認済み",
  rejected: "却下",
};

const CATEGORY_LABEL: Record<string, string> = {
  transport: "交通費",
  lodging: "宿泊費",
  supplies: "備品",
  meal: "飲食",
  other: "その他",
};

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "すべて" },
  { value: "submitted", label: "PM承認待ち" },
  { value: "pmApproved", label: "きよの承認待ち" },
  { value: "approved", label: "承認済み" },
  { value: "rejected", label: "却下" },
];

/** その状態でできる操作。判定の正本は本体なので、ここは導線を出すだけ。 */
function actionsFor(status: string): Array<{ action: string; label: string; tone: "ok" | "ng" }> {
  const normalized = status.toLowerCase();
  if (normalized === "submitted") {
    return [
      { action: "reimb_approve", label: "PM承認", tone: "ok" },
      { action: "reimb_reject", label: "PM却下", tone: "ng" },
    ];
  }
  if (normalized === "pmapproved") {
    return [
      { action: "reimb_admin_approve", label: "承認", tone: "ok" },
      { action: "reimb_admin_reject", label: "却下", tone: "ng" },
    ];
  }
  return [];
}

export function ReimbursementsClient() {
  const [filter, setFilter] = useState("pmApproved");
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : "";
      const res = await fetch(`/api/kiyo/reimbursements${query}`, { cache: "no-store" });
      const json = (await res.json()) as ApiData;
      if (!res.ok || json.ok === false) {
        setHint(json.error ?? "読み込みに失敗した");
        return;
      }
      setData(json);
      setHint(null);
    } catch (err) {
      setHint(err instanceof Error ? err.message : "読み込みに失敗した");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const decide = async (row: Row, action: string, label: string) => {
    setBusyId(row.reimbursementId);
    setHint(null);
    try {
      const res = await fetch("/api/kiyo/reimbursements/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reimbursementId: row.reimbursementId, action }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        setHint(json.error ?? "更新に失敗した");
        return;
      }
      setHint(`${row.applicant ?? "申請"}の ${yen(row.amountYen)} を「${label}」にした`);
      await load(filter);
    } catch (err) {
      setHint(err instanceof Error ? err.message : "更新に失敗した");
    } finally {
      setBusyId(null);
    }
  };

  const rows = data?.rows ?? [];
  const counts = data?.summary.countByStatus ?? {};

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1">
        {FILTERS.map((item) => {
          const count =
            item.value === ""
              ? data?.summary.total
              : (counts[item.value] ?? counts[item.value.toLowerCase()] ?? 0);
          return (
            <button
              key={item.value || "all"}
              onClick={() => setFilter(item.value)}
              className={
                item.value === filter
                  ? "rounded bg-slate-900 px-3 py-1 text-sm text-white"
                  : "rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
              }
            >
              {item.label}
              {typeof count === "number" && (
                <span className="ml-1 text-[11px] opacity-75">{count}</span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => void load(filter)}
          disabled={loading}
          className="ml-auto rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100 disabled:opacity-50"
        >
          {loading ? "読み込み中..." : "最新に更新"}
        </button>
      </div>

      {hint && (
        <div className="mt-3 rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
          {hint}
        </div>
      )}

      <p className="mt-3 text-xs text-slate-600">
        {rows.length}件 / 合計{" "}
        <span className="font-medium tabular-nums">{yen(data?.summary.shownAmountYen ?? 0)}</span>
      </p>

      <section className="mt-2 overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">申請者 / 日付</th>
              <th className="px-3 py-2 text-left font-medium">PJ / 内容</th>
              <th className="px-3 py-2 text-right font-medium">金額</th>
              <th className="px-3 py-2 text-left font-medium">状態</th>
              <th className="px-3 py-2 text-right font-medium">承認</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  {loading ? "読み込み中..." : "対象の立替はない"}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const actions = actionsFor(row.status);
                return (
                  <tr key={row.reimbursementId} className="align-top">
                    <td className="px-3 py-3">
                      <div className="font-medium">{row.applicant ?? "—"}</div>
                      <div className="text-[11px] text-slate-500">{row.date ?? "—"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm">{row.projectName ?? "—"}</div>
                      <div className="text-[11px] text-slate-600">
                        {CATEGORY_LABEL[row.category ?? ""] ?? row.category ?? ""}
                        {row.description ? ` — ${row.description}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">
                      {yen(row.amountYen)}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <div>{STATUS_LABEL[row.status] ?? STATUS_LABEL[row.status.toLowerCase()] ?? row.status}</div>
                      {row.pmApprovedBy && (
                        <div className="text-[11px] text-slate-500">PM: {row.pmApprovedBy}</div>
                      )}
                      {row.adminApprovedBy && (
                        <div className="text-[11px] text-slate-500">admin: {row.adminApprovedBy}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-end gap-1">
                        {actions.length === 0 ? (
                          <span className="text-[11px] text-slate-400">操作なし</span>
                        ) : (
                          actions.map((item) => (
                            <button
                              key={item.action}
                              onClick={() => void decide(row, item.action, item.label)}
                              disabled={busyId === row.reimbursementId}
                              className={
                                item.tone === "ok"
                                  ? "w-24 rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-40"
                                  : "w-24 rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                              }
                            >
                              {busyId === row.reimbursementId ? "処理中..." : item.label}
                            </button>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        承認すると AMD OS 本体が状態を進めて、必要な通知も本体から出る。
        承認済みの立替は、その支払月の支払通知書に合算される（報酬とは別原資）。
      </p>
    </div>
  );
}
