import { createClient } from "@/lib/supabase/server";
import { AdminPayoutsClient } from "@/components/admin/AdminPayoutsClient";

function getRecentYms(n = 6): string[] {
  const now = new Date();
  const result: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    result.push(`${y}${m}`);
  }
  return result;
}

export default async function AdminPayoutsPage() {
  const supabase = await createClient();
  const currentYm = getRecentYms(1)[0];

  const [membersRes, projectsRes, payoutRes, bcRes, pmRes] = await Promise.all([
    supabase
      .from("members")
      .select("member_id, code_name, status")
      .eq("status", "active")
      .order("code_name"),
    supabase
      .from("projects")
      .select("project_id, project_name, status")
      .in("status", ["active"])
      .order("project_name"),
    supabase
      .from("monthly_reward_payout")
      .select("*")
      .eq("ym", currentYm),
    supabase
      .from("billing_cycles")
      .select("project_id, ym, status, budget_yen")
      .eq("ym", currentYm),
    supabase
      .from("project_members")
      .select("member_id, project_id")
      .eq("is_active", true),
  ]);

  const ymOptions = getRecentYms(12);

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-lg font-semibold">Payouts</h1>
        <span className="text-sm text-muted-foreground">支払管理 — {currentYm}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        対象月を選んで配賦入力・支払通知書の発行・振込完了チェック。
      </p>
      <AdminPayoutsClient
        initialYm={currentYm}
        ymOptions={ymOptions}
        members={(membersRes.data ?? []).map((m) => ({
          memberId: m.member_id,
          codeName: m.code_name,
        }))}
        projects={(projectsRes.data ?? []).map((p) => ({
          projectId: p.project_id,
          projectName: p.project_name,
        }))}
        payouts={payoutRes.data ?? []}
        billingCycles={bcRes.data ?? []}
        projectMemberships={(pmRes.data ?? []).map((pm) => ({
          memberId: pm.member_id,
          projectId: pm.project_id,
        }))}
      />
    </div>
  );
}
