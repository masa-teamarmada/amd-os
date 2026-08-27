"use client";

/**
 * 支払通知書のビューワー / 承認画面。
 *
 * 【原則】この画面は金額を計算しない。
 * 出ている数字はすべて AMD OS 本体が確定させて保存した値をそのまま表示している。
 * できるのは「見る」と「送付済みにする / 取り消す」の2つだけ。
 *
 * 計算・PDF生成・支払データの確定は本体（/admin/payouts と日次処理）の責務。
 * ここに発行ボタンや再計算ボタンを戻さないこと。金額が本体とズレて事故になる。
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { shiftYm, ymLabel } from "@/lib/ym";

type NoticeRow = {
  memberId: string;
  memberName: string;
  codeName: string | null;
  email: string | null;
  rewardYen: number;
  reimbursementYen: number;
  payableYen: number;
  noticeNo: string | null;
  pdfUrl: string | null;
  sentAt: string | null;
  lastGeneratedAt: string | null;
};

type PayoutData = {
  ok?: boolean;
  error?: string;
  ym: string;
  rows: NoticeRow[];
  summary: {
    memberCount: number;
    sentCount: number;
    pdfMissingCount: number;
    totalPayableYen: number;
  };
};

const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;

export function PayoutNoticeClient({
  initialYm,
  userLabel,
  embedded = false,
}: {
  initialYm: string;
  userLabel?: string;
  /** きよページのタブに埋め込むとき true。自前の見出しを出さない。 */
  embedded?: boolean;
}) {
  const [ym, setYm] = useState(initialYm);
  const [data, setData] = useState<PayoutData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async (targetYm: string) => {
    setLoading(true);
    setHint("読み込み中...");
    try {
      const res = await fetch(`/api/payouts?ym=${encodeURIComponent(targetYm)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as PayoutData;
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
    void load(initialYm);
  }, [initialYm, load]);

  const goYm = (next: string) => {
    setYm(next);
    void load(next);
  };

  /** 承認操作。送付済みフラグだけを動かす。金額には触らない。 */
  const toggleSent = async (row: NoticeRow) => {
    setBusyMemberId(row.memberId);
    setHint(null);
    try {
      const res = await fetch("/api/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_notice",
          ym: data?.ym ?? ym,
          memberId: row.memberId,
          sent: !row.sentAt,
        }),
      });
      const json = (await res.json()) as PayoutData;
      if (!res.ok || json.ok === false) {
        setHint(json.error ?? "更新に失敗した");
        return;
      }
      setData(json);
      setHint(`${row.memberName} を${row.sentAt ? "未送付に戻した" : "送付済みにした"}`);
    } catch (err) {
      setHint(err instanceof Error ? err.message : "更新に失敗した");
    } finally {
      setBusyMemberId(null);
    }
  };

  const rows = data?.rows ?? [];
  const summary = data?.summary;

  const Wrapper = embedded ? "div" : "main";

  return (
    <Wrapper className={embedded ? "" : "mx-auto max-w-5xl px-4 py-6"}>
      <header
        className={
          embedded
            ? "flex flex-wrap items-center justify-end gap-3"
            : "flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4"
        }
      >
        {!embedded && (
          <div>
            <Link href="/" className="text-xs text-slate-500 hover:underline">
              ← きよあどみ
            </Link>
            <h1 className="text-xl font-semibold">支払通知書</h1>
            <p className="text-xs text-slate-500">{userLabel}</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => goYm(shiftYm(ym, -1))}
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100"
          >
            ←
          </button>
          <input
            value={ym}
            onChange={(e) => setYm(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load(ym);
            }}
            className="w-24 rounded border border-slate-300 px-2 py-1 text-center text-sm tabular-nums"
            placeholder="YYYYMM"
          />
          <button
            onClick={() => goYm(shiftYm(ym, 1))}
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100"
          >
            →
          </button>
          <button
            onClick={() => void load(ym)}
            disabled={loading}
            className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
          >
            読み込み
          </button>
        </div>
      </header>

      <div className="mt-4 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-900">
        この画面は <strong>AMD OS 本体が確定させた金額を見るだけ</strong>。ここでは計算も発行もしない。
        金額と通知書PDFは本体が毎晩つくる（PDF 深夜2時 / 報酬 深夜3時5分）。
        できるのは中身を確認して<strong>送付済みにする</strong>ことだけ。
      </div>

      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryBox label="支払月" value={ymLabel(data?.ym ?? ym)} sub="稼働月ではない" />
        <SummaryBox
          label="対象メンバー"
          value={`${summary?.memberCount ?? 0}人`}
          sub={`送付済 ${summary?.sentCount ?? 0}人`}
        />
        <SummaryBox
          label="支払額 合計"
          value={yen(summary?.totalPayableYen ?? 0)}
          sub="報酬＋立替"
        />
        <SummaryBox
          label="PDF未作成"
          value={`${summary?.pdfMissingCount ?? 0}件`}
          sub={summary?.pdfMissingCount ? "本体の作成待ち" : "すべて作成済み"}
        />
      </section>

      {hint && (
        <div className="mt-3 rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
          {hint}
        </div>
      )}

      <section className="mt-4 overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">メンバー</th>
              <th className="px-3 py-2 text-right font-medium">報酬</th>
              <th className="px-3 py-2 text-right font-medium">立替</th>
              <th className="px-3 py-2 text-right font-medium">支払額</th>
              <th className="px-3 py-2 text-left font-medium">通知書</th>
              <th className="px-3 py-2 text-right font-medium">承認</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  {loading
                    ? "読み込み中..."
                    : `${ymLabel(ym)} の支払通知書はまだ無い（本体で確定させると出てくる）`}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.memberId} className="align-top">
                  <td className="px-3 py-3">
                    <div className="font-medium">{row.memberName}</div>
                    {row.email && <div className="text-[11px] text-slate-500">{row.email}</div>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                    {yen(row.rewardYen)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                    {row.reimbursementYen > 0 ? yen(row.reimbursementYen) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums">
                    {yen(row.payableYen)}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {row.noticeNo ? (
                      <div className="font-mono text-[11px]">{row.noticeNo}</div>
                    ) : (
                      <div className="text-slate-400">番号なし</div>
                    )}
                    {row.pdfUrl ? (
                      <a
                        href={row.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-600 underline"
                      >
                        PDFを開く
                      </a>
                    ) : (
                      <div className="text-[11px] text-amber-700">PDF未作成（本体の作成待ち）</div>
                    )}
                    {row.sentAt && (
                      <div className="mt-1">
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800">
                          送付済
                        </span>
                        <span className="ml-1 text-[10px] text-slate-500">
                          {new Date(row.sentAt).toLocaleString("ja-JP")}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={() => void toggleSent(row)}
                        disabled={busyMemberId === row.memberId || !row.pdfUrl}
                        title={row.pdfUrl ? "" : "PDFができてから送付済みにできる"}
                        className="w-24 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-40"
                      >
                        {busyMemberId === row.memberId
                          ? "処理中..."
                          : row.sentAt
                            ? "送付取消"
                            : "送付済みに"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
        支払月は稼働月ではない。表示している金額は本体が <code>payout_notices</code> に確定させた値。
        報酬（<code>total_yen</code>）と立替精算（<code>reimbursement_yen</code>）は別原資なので、
        支払額はその合計。誰を対象にするか・いくらにするかを決めるのは本体
        （<code>/admin/payouts</code>）で、この画面からは変えられない。
        仕様の正本は <code>pwa/manual/31-admin-payouts-reward-notice-spec.md</code>。
      </p>
    </Wrapper>
  );
}

function SummaryBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}
