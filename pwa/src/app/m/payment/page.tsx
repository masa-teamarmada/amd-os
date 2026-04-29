"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getPaymentPendingList } from "@/lib/supabase/billing-queries";
import { invokeBillingAction } from "@/lib/edge-functions";
import { formatYen } from "@/lib/utils/format";
import type { BillingRow } from "@/types/dashboard";

export default function PaymentConfirmPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  // 特定PJからの遷移
  const targetProject = searchParams.get("project") || "";
  const targetYm = searchParams.get("ym") || "";
  const targetProjectId = searchParams.get("project_id") || "";

  const [pending, setPending] = useState<BillingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserEmail(user?.email || "");

      const data = await getPaymentPendingList(supabase);
      setPending(data);
      setLoading(false);
    };
    load();
  }, []);

  const isKyoko = userEmail === "kyoko@team-armada.jp";

  const handleConfirm = async (b: BillingRow) => {
    if (!isKyoko) {
      alert("入金確認は kyoko@team-armada.jp のみ実行可能です");
      return;
    }

    // project_code → project_id が必要
    // v_billing_dashboard にはproject_idがないので、projectsテーブルから取得
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("project_code", b.project_code)
      .single();

    if (!project) {
      alert("プロジェクトが見つかりません");
      return;
    }

    const key = `${b.project_code}-${b.ym}`;
    setActionLoading(key);

    const result = await invokeBillingAction({
      action: "confirm_payment",
      project_id: project.id,
      ym: b.ym,
    });

    setActionLoading(null);

    if (result.ok) {
      // reload
      const data = await getPaymentPendingList(supabase);
      setPending(data);
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

  return (
    <div className="px-4 py-3">
      <h2 className="text-lg font-bold mb-1">入金確認</h2>
      <p className="text-xs text-gray-400 mb-4">
        請求書送付済み・入金待ちのサイクル
      </p>

      {!isKyoko && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 mb-4">
          入金確認は kyoko@team-armada.jp のみ実行可能です。
          現在のアカウント: {userEmail}
        </div>
      )}

      {pending.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-8">
          入金待ちのサイクルはありません
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((b) => {
            const key = `${b.project_code}-${b.ym}`;
            const isTarget =
              b.project_code === targetProject && b.ym === targetYm;

            return (
              <div
                key={key}
                className={`bg-white rounded-xl border p-4 ${
                  isTarget ? "border-blue-300 ring-1 ring-blue-100" : "border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-bold">
                      {b.project_code}
                    </span>
                    <span className="ml-2 text-xs text-gray-400">
                      {b.ym}
                    </span>
                  </div>
                  <span className="text-sm font-mono">
                    {formatYen(b.budget_total)}
                  </span>
                </div>

                {b.invoice_sent_at && (
                  <p className="text-[11px] text-gray-400 mb-2">
                    請求書送付:{" "}
                    {new Date(b.invoice_sent_at).toLocaleDateString("ja-JP")}
                  </p>
                )}

                {isKyoko && (
                  <button
                    onClick={() => handleConfirm(b)}
                    disabled={actionLoading === key}
                    className="w-full bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-medium active:bg-emerald-700 disabled:opacity-50 mt-1"
                  >
                    {actionLoading === key
                      ? "確認中..."
                      : "入金を確認する"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
