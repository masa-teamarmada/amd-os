"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getBillingDashboard } from "@/lib/supabase/billing-queries";
import { currentYmJST, currentDayJST, formatYen } from "@/lib/utils/format";
import MonthSelector from "@/components/mobile/MonthSelector";
import type { BillingRow } from "@/types/dashboard";

// ─── アクションアイテム型 ───

interface BillingAction {
  severity: "urgent" | "warning" | "info";
  project_code: string;
  project_name: string;
  message: string;
  action_label: string;
  href: string;
}

const SEVERITY_STYLES = {
  urgent: {
    border: "border-l-red-500",
    bg: "bg-red-50",
    badge: "bg-red-100 text-red-700",
    dot: "bg-red-500",
  },
  warning: {
    border: "border-l-amber-500",
    bg: "bg-amber-50",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
  info: {
    border: "border-l-blue-500",
    bg: "bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
  },
};

// ─── ステータスからアクション自動検出 ───

function deriveBillingActions(
  billing: BillingRow[],
  ym: string
): BillingAction[] {
  const actions: BillingAction[] = [];
  const day = currentDayJST();

  for (const b of billing) {
    const pj = b.project_code;
    const pjName = b.project_name;

    // open → 予算確定が必要
    if (b.status === "open") {
      actions.push({
        severity: day > 10 ? "urgent" : "warning",
        project_code: pj,
        project_name: pjName,
        message:
          day > 10
            ? `予算が未確定（${day}日目）`
            : "予算確定を待っています",
        action_label: "予算を確定",
        href: `/m/${pj}?ym=${ym}`,
      });
    }

    // budgeted → 請求書作成
    if (b.status === "budgeted") {
      actions.push({
        severity: day > 15 ? "urgent" : "warning",
        project_code: pj,
        project_name: pjName,
        message:
          day > 15
            ? `請求書が未作成（${day}日目）`
            : "請求書を作成できます",
        action_label: "請求書作成",
        href: `/m/invoice?project=${pj}&ym=${ym}`,
      });
    }

    // invoiced → 入金確認 or 送付
    if (b.status === "invoiced") {
      if (!b.invoice_sent_at) {
        actions.push({
          severity: "warning",
          project_code: pj,
          project_name: pjName,
          message: "請求書が未送付です",
          action_label: "送付する",
          href: `/m/${pj}?ym=${ym}`,
        });
      } else {
        actions.push({
          severity: "info",
          project_code: pj,
          project_name: pjName,
          message: "入金確認を待っています",
          action_label: "入金確認",
          href: `/m/payment?project=${pj}&ym=${ym}`,
        });
      }
    }

    // paid → クローズ可能
    if (b.status === "paid") {
      actions.push({
        severity: "info",
        project_code: pj,
        project_name: pjName,
        message: "入金確認済み。クローズできます",
        action_label: "クローズ",
        href: `/m/${pj}?ym=${ym}`,
      });
    }
  }

  // ソート: urgent → warning → info
  const order = { urgent: 0, warning: 1, info: 2 };
  return actions.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ─── パイプラインドット ───

const STAGES = ["open", "budgeted", "invoiced", "paid", "closed"] as const;

function PipelineDots({ status }: { status: string }) {
  const currentIdx = STAGES.indexOf(status as (typeof STAGES)[number]);
  return (
    <div className="flex items-center gap-0.5">
      {STAGES.map((s, i) => (
        <div
          key={s}
          className={`w-2 h-2 rounded-full ${
            i < currentIdx
              ? "bg-emerald-500"
              : i === currentIdx
              ? "bg-blue-500"
              : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

// ─── メインコンポーネント ───

export default function BillingHomePage() {
  const [ym, setYm] = useState(currentYmJST());
  const [billing, setBilling] = useState<BillingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    setLoading(true);
    getBillingDashboard(supabase, ym).then((data) => {
      setBilling(data);
      setLoading(false);
    });
  }, [ym]);

  const actions = deriveBillingActions(billing, ym);
  const completedCount = billing.filter(
    (b) => b.status === "closed"
  ).length;
  const totalBudget = billing.reduce((s, b) => s + (b.budget_total ?? 0), 0);

  if (loading) {
    return (
      <div className="text-center text-gray-400 text-sm py-12">
        読み込み中...
      </div>
    );
  }

  return (
    <div>
      {/* Month selector */}
      <MonthSelector ym={ym} onChange={setYm} />

      {/* KPI strip */}
      <div className="flex items-center justify-between px-4 mb-4">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-2xl font-bold">{billing.length}</span>
            <span className="text-xs text-gray-400 ml-1">PJ</span>
          </div>
          <div className="h-6 w-px bg-gray-200" />
          <div>
            <span className="text-2xl font-bold text-emerald-600">
              {completedCount}
            </span>
            <span className="text-xs text-gray-400 ml-1">完了</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold font-mono text-blue-600">
            {formatYen(totalBudget)}
          </div>
          <div className="text-[10px] text-gray-400">Pipeline</div>
        </div>
      </div>

      {/* ─── やること ─── */}
      {actions.length > 0 && (
        <div className="px-4 mb-5">
          <h3 className="text-xs font-medium text-gray-500 mb-2">
            やること
            <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {actions.filter((a) => a.severity === "urgent").length || actions.length}
            </span>
          </h3>
          <div className="space-y-2">
            {actions.map((a, i) => {
              const style = SEVERITY_STYLES[a.severity];
              return (
                <button
                  key={`${a.project_code}-${i}`}
                  onClick={() => router.push(a.href)}
                  className={`w-full text-left rounded-xl border border-gray-200 border-l-4 ${style.border} p-3 active:bg-gray-50 transition-colors`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                      <span className="text-sm font-bold">{a.project_code}</span>
                      <span className="text-[11px] text-gray-400">
                        {a.project_name}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${style.badge}`}
                    >
                      {a.action_label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 pl-3.5">{a.message}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 全PJステータス ─── */}
      <div className="px-4">
        <h3 className="text-xs font-medium text-gray-500 mb-2">
          全PJステータス
        </h3>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {billing.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-6">
              この月のデータはありません
            </div>
          ) : (
            billing.map((b) => (
              <button
                key={`${b.project_code}-${b.ym}`}
                onClick={() => router.push(`/m/${b.project_code}?ym=${ym}`)}
                className="w-full flex items-center justify-between px-3 py-2.5 active:bg-gray-50 text-left"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-bold w-10">
                    {b.project_code}
                  </span>
                  <PipelineDots status={b.status} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-500">
                    {formatYen(b.budget_total)}
                  </span>
                  {b.status === "closed" && (
                    <span className="text-[10px] text-emerald-600">完了</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 全完了メッセージ */}
      {billing.length > 0 &&
        actions.length === 0 &&
        completedCount === billing.length && (
          <div className="px-4 mt-4">
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <span className="text-2xl">✓</span>
              <p className="text-sm text-emerald-700 mt-1">
                {ym.replace("-", "年")}月のBilling全完了
              </p>
            </div>
          </div>
        )}
    </div>
  );
}
