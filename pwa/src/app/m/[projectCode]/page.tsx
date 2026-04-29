"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getProjectBillingHistory } from "@/lib/supabase/billing-queries";
import { currentYmJST, formatYen } from "@/lib/utils/format";
import { invokeBillingAction } from "@/lib/edge-functions";
import StatusTimeline from "@/components/mobile/StatusTimeline";
import MonthSelector from "@/components/mobile/MonthSelector";

interface TimelineStep {
  label: string;
  status: "completed" | "current" | "pending";
  date?: string | null;
  actor?: string | null;
}

// deno-lint-ignore no-explicit-any
function buildTimeline(cycle: any): TimelineStep[] {
  const s = cycle?.status || "open";
  const stages = [
    { key: "open", label: "予算オープン", dateKey: "created_at" },
    {
      key: "budgeted",
      label: "予算確定",
      dateKey: "budget_confirmed_at",
    },
    {
      key: "invoiced",
      label: "請求書発行",
      dateKey: null, // invoice.issued_at
    },
    { key: "paid", label: "入金確認", dateKey: null }, // payment.confirmed_at
    { key: "closed", label: "クローズ", dateKey: null },
  ];

  const statusOrder = ["open", "budgeted", "invoiced", "paid", "closed"];
  const currentIdx = statusOrder.indexOf(s);

  return stages.map((stage, i) => {
    let status: "completed" | "current" | "pending" = "pending";
    if (i < currentIdx) status = "completed";
    if (i === currentIdx) status = "current";

    let date: string | null = null;
    if (stage.dateKey && cycle) date = cycle[stage.dateKey] || null;
    if (stage.key === "invoiced" && cycle?.invoice)
      date = cycle.invoice.issued_at;
    if (stage.key === "paid" && cycle?.payment)
      date = cycle.payment.confirmed_at;

    return { label: stage.label, status, date };
  });
}

export default function ProjectBillingDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectCode = params.projectCode as string;
  const initialYm = searchParams.get("ym") || currentYmJST();

  const [ym, setYm] = useState(initialYm);
  // deno-lint-ignore no-explicit-any
  const [project, setProject] = useState<any>(null);
  // deno-lint-ignore no-explicit-any
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const supabase = createClient();

  const loadData = async () => {
    setLoading(true);
    const result = await getProjectBillingHistory(supabase, projectCode);
    setProject(result.project);
    setCycles(result.cycles);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [projectCode]);

  const currentCycle = cycles.find((c) => c.ym === ym);
  const timeline = buildTimeline(currentCycle);

  const handleAction = async (action: string) => {
    if (!project || !currentCycle) return;
    setActionLoading(true);
    const result = await invokeBillingAction({
      action,
      project_id: project.id,
      ym,
    });
    setActionLoading(false);

    if (result.ok) {
      await loadData(); // reload
    } else {
      alert(result.error || "エラーが発生しました");
    }
  };

  if (loading) {
    return (
      <div className="text-center text-gray-400 text-sm py-12">
        読み込み中...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center text-gray-400 text-sm py-12">
        プロジェクトが見つかりません
      </div>
    );
  }

  return (
    <div>
      {/* Back + Project header */}
      <div className="px-4 pt-3 pb-2">
        <button
          onClick={() => router.push("/m")}
          className="text-blue-600 text-xs mb-2"
        >
          ← 戻る
        </button>
        <h2 className="text-lg font-bold">
          {project.project_code}{" "}
          <span className="text-sm text-gray-400 font-normal">
            {project.name}
          </span>
        </h2>
        {project.client_name && (
          <p className="text-xs text-gray-400">{project.client_name}</p>
        )}
      </div>

      {/* Month selector */}
      <MonthSelector ym={ym} onChange={setYm} />

      {currentCycle ? (
        <div className="px-4">
          {/* Budget info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-gray-400">予算額</span>
              <span className="text-xl font-bold">
                {formatYen(currentCycle.budget_total)}
              </span>
            </div>
            {currentCycle.budget_reported_amount != null && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">報告額</span>
                <span className="text-sm text-gray-600">
                  {formatYen(currentCycle.budget_reported_amount)}
                </span>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <h3 className="text-xs font-medium text-gray-400 mb-3">
              ステータス
            </h3>
            <StatusTimeline steps={timeline} />
          </div>

          {/* Action buttons */}
          <div className="space-y-2 mb-6">
            {currentCycle.status === "open" && (
              <button
                onClick={() => handleAction("confirm_budget")}
                disabled={actionLoading}
                className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-medium active:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? "処理中..." : "予算を確定する"}
              </button>
            )}

            {currentCycle.status === "budgeted" && (
              <button
                onClick={() =>
                  router.push(
                    `/m/invoice?project=${project.project_code}&ym=${ym}&project_id=${project.id}`
                  )
                }
                className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-medium active:bg-blue-700"
              >
                請求書を作成する
              </button>
            )}

            {currentCycle.status === "invoiced" && (
              <>
                <button
                  onClick={() =>
                    router.push(
                      `/m/payment?project=${project.project_code}&ym=${ym}&project_id=${project.id}`
                    )
                  }
                  className="w-full bg-emerald-600 text-white rounded-xl py-3 text-sm font-medium active:bg-emerald-700"
                >
                  入金を確認する
                </button>
                {currentCycle.invoice?.pdf_url && (
                  <a
                    href={currentCycle.invoice.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full text-center border border-gray-300 text-gray-700 rounded-xl py-3 text-sm font-medium active:bg-gray-50"
                  >
                    請求書PDFを表示
                  </a>
                )}
              </>
            )}

            {currentCycle.status === "paid" && (
              <button
                onClick={() => handleAction("close_cycle")}
                disabled={actionLoading}
                className="w-full bg-gray-800 text-white rounded-xl py-3 text-sm font-medium active:bg-gray-900 disabled:opacity-50"
              >
                {actionLoading ? "処理中..." : "サイクルをクローズ"}
              </button>
            )}

            {currentCycle.status === "closed" && (
              <div className="text-center text-emerald-600 text-sm py-3">
                ✓ このサイクルは完了しています
              </div>
            )}
          </div>

          {/* Invoice info */}
          {currentCycle.invoice && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <h3 className="text-xs font-medium text-gray-400 mb-2">
                請求書情報
              </h3>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>請求書番号</span>
                  <span className="font-mono">
                    {currentCycle.invoice.freee_invoice_no || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>ステータス</span>
                  <span>{currentCycle.invoice.status}</span>
                </div>
                {currentCycle.invoice.sent_at && (
                  <div className="flex justify-between">
                    <span>送付日</span>
                    <span>
                      {new Date(
                        currentCycle.invoice.sent_at
                      ).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Note */}
          {currentCycle.note && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <h3 className="text-xs font-medium text-gray-400 mb-1">
                メモ
              </h3>
              <p className="text-xs text-gray-600">{currentCycle.note}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-gray-400 text-sm py-8">
          この月のビリングサイクルがありません
        </div>
      )}
    </div>
  );
}
