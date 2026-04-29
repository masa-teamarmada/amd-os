"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { invokeReimburse } from "@/lib/edge-functions";

const CATEGORY_LABELS: Record<string, string> = {
  transport: "🚃 交通費",
  lodging: "🏨 宿泊",
  supplies: "📦 消耗品",
  meal: "🍽 会議費",
  other: "📋 その他",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  submitted: { label: "申請中", color: "bg-gray-100 text-gray-600" },
  pm_approved: { label: "PM承認済", color: "bg-blue-100 text-blue-700" },
  approved: { label: "承認済", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "却下", color: "bg-red-100 text-red-700" },
  paid: { label: "支払済", color: "bg-gray-100 text-gray-500" },
};

interface Project {
  id: string;
  project_code: string;
  name: string;
}

interface Reimbursement {
  id: string;
  project_id: string;
  date: string;
  category: string;
  amount: number;
  tax_rate: number;
  description: string;
  transport_mode?: string;
  transport_from?: string;
  transport_to?: string;
  transport_trip?: string;
  status: string;
  created_by: string;
  pm_approved_at?: string;
  admin_approved_at?: string;
  billed_ym?: string;
  members?: { code_name: string };
}

export default function ReimburseListPage() {
  const router = useRouter();
  const supabase = createClient();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedPj, setSelectedPj] = useState("");
  const [items, setItems] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || "");
      setUserId(user?.id || "");

      const { data } = await supabase
        .from("projects")
        .select("id, project_code, name")
        .eq("status", "active")
        .order("project_code");
      setProjects(data ?? []);
      if (data?.length) {
        setSelectedPj(data[0].id);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedPj) return;
    loadItems();
  }, [selectedPj]);

  const loadItems = async () => {
    setLoading(true);
    const res = await invokeReimburse({
      action: "list",
      project_id: selectedPj,
    });
    setLoading(false);
    if (res.ok && res.data) {
      // deno-lint-ignore no-explicit-any
      setItems((res.data as any).items ?? []);
    }
  };

  const handleApprove = async (id: string, type: "pm_approve" | "admin_approve") => {
    setActionLoading(id);
    await invokeReimburse({ action: type, id });
    setActionLoading(null);
    await loadItems();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    setActionLoading(id);
    await invokeReimburse({ action: "delete", id });
    setActionLoading(null);
    await loadItems();
  };

  const isAdmin = userEmail === "kyoko@team-armada.jp" || userEmail === "masa@team-armada.jp";

  // グループ分け: 要対応 / 承認済み / その他
  const needsAction = items.filter((r) => {
    if (r.status === "submitted") return true; // PM承認待ち
    if (r.status === "pm_approved" && isAdmin) return true; // Admin承認待ち
    return false;
  });
  const approved = items.filter((r) => r.status === "approved" && !r.billed_ym);
  const others = items.filter(
    (r) => !needsAction.includes(r) && !approved.includes(r)
  );

  const renderItem = (r: Reimbursement) => {
    const st = STATUS_LABELS[r.status] || STATUS_LABELS.submitted;
    const canPmApprove = r.status === "submitted" || r.status === "pm_approved";
    const canAdminApprove = isAdmin && (r.status === "pm_approved" || r.status === "approved");
    const canDelete = r.status === "submitted" && r.created_by === userId;
    const isActing = actionLoading === r.id;

    return (
      <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs">{CATEGORY_LABELS[r.category] || r.category}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${st.color}`}>
                {st.label}
              </span>
            </div>
            <p className="text-sm text-gray-900 truncate">{r.description}</p>
            {r.category === "transport" && r.transport_from && (
              <p className="text-[11px] text-gray-400">
                {r.transport_from}→{r.transport_to}
                {r.transport_trip === "round" ? "（往復）" : ""}
              </p>
            )}
          </div>
          <div className="text-right shrink-0 ml-2">
            <div className="text-sm font-mono font-bold">
              ¥{r.amount.toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-400">
              {new Date(r.date).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
            </div>
          </div>
        </div>

        {r.members && (
          <div className="text-[10px] text-gray-400 mb-1.5">
            申請者: {r.members.code_name || "—"}
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex gap-1.5">
          {canPmApprove && (
            <button
              onClick={() => handleApprove(r.id, "pm_approve")}
              disabled={isActing}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium ${
                r.status === "pm_approved"
                  ? "bg-gray-100 text-gray-500"
                  : "bg-blue-600 text-white"
              } disabled:opacity-50`}
            >
              {r.status === "pm_approved" ? "PM承認取消" : "PM承認"}
            </button>
          )}
          {canAdminApprove && (
            <button
              onClick={() => handleApprove(r.id, "admin_approve")}
              disabled={isActing}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium ${
                r.status === "approved"
                  ? "bg-gray-100 text-gray-500"
                  : "bg-emerald-600 text-white"
              } disabled:opacity-50`}
            >
              {r.status === "approved" ? "Admin承認取消" : "Admin承認"}
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => handleDelete(r.id)}
              disabled={isActing}
              className="px-3 py-1.5 rounded-lg text-[11px] text-red-500 border border-red-200 disabled:opacity-50"
            >
              削除
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">立替一覧</h2>
        <button
          onClick={() => router.push("/m/reimburse")}
          className="text-xs text-blue-600"
        >
          + 新規申請
        </button>
      </div>

      {/* PJ選択 */}
      <select
        value={selectedPj}
        onChange={(e) => setSelectedPj(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white mb-4"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.project_code} — {p.name}
          </option>
        ))}
      </select>

      {loading ? (
        <div className="text-center text-gray-400 text-sm py-8">読み込み中...</div>
      ) : items.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-8">
          立替申請がありません
        </div>
      ) : (
        <>
          {/* 要対応 */}
          {needsAction.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-medium text-amber-600 mb-2">
                要対応 ({needsAction.length})
              </h3>
              {needsAction.map(renderItem)}
            </div>
          )}

          {/* 承認済み（未請求） */}
          {approved.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-medium text-emerald-600 mb-2">
                承認済み・未請求 ({approved.length})
                <span className="text-gray-400 ml-2">
                  合計 ¥{approved.reduce((s, r) => s + r.amount, 0).toLocaleString()}
                </span>
              </h3>
              {approved.map(renderItem)}
            </div>
          )}

          {/* その他 */}
          {others.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-400 mb-2">
                その他 ({others.length})
              </h3>
              {others.map(renderItem)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
