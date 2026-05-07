"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 立替精算ページ。
 * 月次ルーティンの「立替精算確認」タスクをクリックすると遷移する。
 *
 * MVP: 自分の立替リストを read-only で表示 + 承認ステータス確認。
 * iOS の ReimburseListView (439 行) を最小機能で逆移植。
 * 立替の追加・編集・削除は次段で対応。
 */

interface Item {
  reimbursement_id: string;
  project_id: string;
  project_name?: string;
  date: string;
  description: string;
  category: string | null;
  amount: number;
  tax_rate: number | null;
  status: string;
  pm_approved_at: string | null;
  admin_approved_at: string | null;
}

interface ProjectMap { [pid: string]: string; }

export default function ReimbursePage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const email = user?.email?.toLowerCase();
        if (!email) {
          setItems([]);
          return;
        }
        const { data: member } = await supabase
          .from("members")
          .select("member_id")
          .eq("email", email)
          .maybeSingle();
        if (!member?.member_id) {
          setItems([]);
          return;
        }
        const { data } = await supabase
          .from("reimbursements")
          .select("reimbursement_id, project_id, date, description, category, amount, tax_rate, status, pm_approved_at, admin_approved_at")
          .eq("member_id", member.member_id)
          .order("date", { ascending: false });
        const rows = (data ?? []) as Item[];
        const pjIds = Array.from(new Set(rows.map((r) => r.project_id))).filter(Boolean);
        let pjMap: ProjectMap = {};
        if (pjIds.length > 0) {
          const { data: pjs } = await supabase
            .from("projects")
            .select("project_id, project_name")
            .in("project_id", pjIds);
          pjMap = Object.fromEntries((pjs ?? []).map((p) => [p.project_id, p.project_name]));
        }
        setItems(rows.map((r) => ({ ...r, project_name: pjMap[r.project_id] || r.project_id })));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-lg font-semibold">立替精算</h1>
        <a href="/admin/billing" className="text-xs text-muted-foreground hover:underline">
          admin で承認 →
        </a>
      </div>

      {items === null && <p className="text-sm text-muted-foreground">読み込み中...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {items && items.length === 0 && (
        <p className="text-sm text-muted-foreground py-12 text-center">
          自分が登録した立替はまだありません
        </p>
      )}

      {items && items.length > 0 && (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium w-24">日付</th>
                <th className="px-3 py-2 font-medium w-40">PJ</th>
                <th className="px-3 py-2 font-medium w-24">区分</th>
                <th className="px-3 py-2 font-medium">内容</th>
                <th className="px-3 py-2 font-medium text-right w-24">金額</th>
                <th className="px-3 py-2 font-medium w-32">承認</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.reimbursement_id} className="border-t border-border">
                  <td className="px-3 py-2 text-muted-foreground">{item.date.slice(0, 10)}</td>
                  <td className="px-3 py-2 truncate max-w-[160px]" title={item.project_name}>{item.project_name}</td>
                  <td className="px-3 py-2">
                    {item.category && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{item.category}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 truncate" title={item.description}>{item.description}</td>
                  <td className="px-3 py-2 text-right font-mono">¥{Math.round(item.amount).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded ${item.pm_approved_at ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                        {item.pm_approved_at ? "✓PM" : "PM"}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded ${item.admin_approved_at ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                        {item.admin_approved_at ? "✓admin" : "admin"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-3">
        立替の追加・編集はモバイルアプリで行ってください (PWA 移植は次段で対応)。
      </p>
    </div>
  );
}
