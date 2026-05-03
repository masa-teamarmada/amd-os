"use client";

import { useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

interface Member {
  memberId: string;
  codeName: string;
}

interface Project {
  projectId: string;
  projectName: string;
}

interface BillingCycle {
  project_id: string;
  ym: string;
  status: string;
  budget_yen?: number;
}

interface ProjectMembership {
  memberId: string;
  projectId: string;
}

interface Props {
  initialYm: string;
  ymOptions: string[];
  members: Member[];
  projects: Project[];
  payouts: any[];
  billingCycles: BillingCycle[];
  projectMemberships: ProjectMembership[];
}

const BC_STATUS_LABEL: Record<string, string> = {
  not_started: "未着手",
  reported: "報告済",
  budget_confirmed: "予算確定",
  allocation_confirmed: "配賦確定",
  invoice_sent: "請求書送付",
  payment_confirmed: "着金確認",
};

const BC_STATUS_COLOR: Record<string, string> = {
  not_started: "bg-zinc-50 text-zinc-400 border-zinc-200",
  reported: "bg-blue-50 text-blue-600 border-blue-200",
  budget_confirmed: "bg-yellow-50 text-yellow-700 border-yellow-200",
  allocation_confirmed: "bg-orange-50 text-orange-700 border-orange-200",
  invoice_sent: "bg-purple-50 text-purple-700 border-purple-200",
  payment_confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function AdminPayoutsClient({
  initialYm,
  ymOptions,
  members,
  projects,
  payouts: initialPayouts,
  billingCycles: initialBc,
  projectMemberships: initialPm,
}: Props) {
  const [ym, setYm] = useState(initialYm);
  const [payouts, setPayouts] = useState<any[]>(initialPayouts);
  const [billingCycles, setBillingCycles] = useState<BillingCycle[]>(initialBc);
  const [projectMemberships, setProjectMemberships] = useState<ProjectMembership[]>(initialPm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState("");
  // allocation inputs: { [memberId_projectId]: number }
  const [allocInputs, setAllocInputs] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    initialPayouts.forEach((p) => {
      const key = `${p.member_id}_${p.project_id}`;
      init[key] = p.amount_yen ?? p.amount ?? 0;
    });
    return init;
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Reload data when YM changes
  const loadForYm = async (newYm: string) => {
    setLoading(true);
    setHint("");
    const [payoutRes, bcRes, pmRes] = await Promise.all([
      supabase.from("monthly_reward_payout").select("*").eq("ym", newYm),
      supabase.from("billing_cycles").select("project_id, ym, status, budget_yen").eq("ym", newYm),
      supabase.from("project_members").select("member_id, project_id").eq("is_active", true),
    ]);
    const newPayouts = payoutRes.data ?? [];
    const newBc = bcRes.data ?? [];
    const newPm = (pmRes.data ?? []).map((pm: { member_id: string; project_id: string }) => ({
      memberId: pm.member_id,
      projectId: pm.project_id,
    }));
    setPayouts(newPayouts);
    setBillingCycles(newBc);
    setProjectMemberships(newPm);
    // Reset inputs from loaded data
    const init: Record<string, number> = {};
    newPayouts.forEach((p: any) => {
      const key = `${p.member_id}_${p.project_id}`;
      init[key] = p.amount_yen ?? p.amount ?? 0;
    });
    setAllocInputs(init);
    setHint(`${newYm} / ${newBc.length}PJ / ${newPayouts.length}件`);
    setLoading(false);
  };

  const handleYmChange = async (newYm: string) => {
    setYm(newYm);
    await loadForYm(newYm);
  };

  // Set of project IDs that have billing cycles for this YM
  const bcProjectIds = useMemo(
    () => new Set(billingCycles.map((bc) => bc.project_id)),
    [billingCycles]
  );

  // Set of "memberId_projectId" for quick membership lookup
  const membershipSet = useMemo(
    () => new Set(projectMemberships.map((pm) => `${pm.memberId}_${pm.projectId}`)),
    [projectMemberships]
  );

  // Returns projects that belong to this member AND have a billing cycle
  const getMemberProjects = (memberId: string): Project[] =>
    projects.filter(
      (p) => bcProjectIds.has(p.projectId) && membershipSet.has(`${memberId}_${p.projectId}`)
    );

  const getBc = (projectId: string) =>
    billingCycles.find((bc) => bc.project_id === projectId);

  const getAllocInput = (memberId: string, projectId: string) =>
    allocInputs[`${memberId}_${projectId}`] ?? 0;

  const setAllocInput = (memberId: string, projectId: string, value: number) => {
    setAllocInputs((prev) => ({ ...prev, [`${memberId}_${projectId}`]: value }));
  };

  const memberTotal = (memberId: string) =>
    getMemberProjects(memberId).reduce(
      (sum, p) => sum + (getAllocInput(memberId, p.projectId) || 0),
      0
    );

  const grandTotal = members.reduce((sum, m) => sum + memberTotal(m.memberId), 0);

  const saveAll = async () => {
    setSaving(true);
    setHint("保存中…");
    const now = new Date().toISOString();
    const upserts: any[] = [];

    members.forEach((m) => {
      getMemberProjects(m.memberId).forEach((p) => {
        const amount = getAllocInput(m.memberId, p.projectId);
        if (amount > 0) {
          upserts.push({
            member_id: m.memberId,
            project_id: p.projectId,
            ym,
            amount_yen: amount,
            updated_at: now,
          });
        }
      });
    });

    if (upserts.length === 0) {
      setHint("変更なし");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("monthly_reward_payout")
      .upsert(upserts, { onConflict: "member_id,project_id,ym" });

    if (error) {
      setHint(`保存エラー: ${error.message}`);
    } else {
      setHint(`${upserts.length}件 保存しました`);
    }
    setSaving(false);
  };

  const fmtYen = (n: number) => (n > 0 ? `¥${n.toLocaleString("ja-JP")}` : "—");

  // Members who have at least one project with a billing cycle
  const activeMembers = members.filter((m) => getMemberProjects(m.memberId).length > 0);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">対象月</span>
          <select
            value={ym}
            onChange={(e) => handleYmChange(e.target.value)}
            disabled={loading}
            className="border border-border rounded px-2 py-1.5 text-[12px] bg-background font-mono"
          >
            {ymOptions.map((y) => (
              <option key={y} value={y}>
                {y.slice(0, 4)}/{y.slice(4)}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => loadForYm(ym)}
          disabled={loading}
          className="text-[12px] border border-border px-3 py-1.5 rounded mt-4 bg-background hover:bg-muted/40 disabled:opacity-50"
        >
          {loading ? "読込中…" : "更新"}
        </button>
        <button
          onClick={saveAll}
          disabled={saving || loading}
          className="text-[12px] bg-foreground text-background px-4 py-1.5 rounded mt-4 disabled:opacity-50"
        >
          {saving ? "保存中…" : "一括保存"}
        </button>
        {hint && <span className="text-[12px] text-muted-foreground mt-4">{hint}</span>}
        {grandTotal > 0 && (
          <span className="text-[12px] font-medium mt-4 ml-auto">
            合計 {fmtYen(grandTotal)}
          </span>
        )}
      </div>

      {/* Billing Cycles Status Strip */}
      {billingCycles.length > 0 && (
        <div>
          <div className="text-[11px] text-muted-foreground mb-1.5">
            PJ月次ステータス ({ym})
          </div>
          <div className="flex flex-wrap gap-2">
            {billingCycles.map((bc) => {
              const pj = projects.find((p) => p.projectId === bc.project_id);
              const colorClass =
                BC_STATUS_COLOR[bc.status] ?? "bg-zinc-50 text-zinc-500 border-zinc-200";
              return (
                <div
                  key={bc.project_id}
                  className={`text-[10px] px-2 py-1 rounded border ${colorClass}`}
                >
                  <span className="font-medium">{pj?.projectName ?? bc.project_id}</span>
                  <span className="ml-1.5 opacity-75">
                    {BC_STATUS_LABEL[bc.status] ?? bc.status}
                  </span>
                  {bc.budget_yen ? (
                    <span className="ml-1.5">¥{bc.budget_yen.toLocaleString("ja-JP")}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Member Cards */}
      <div className="space-y-3">
        <div className="text-[13px] font-semibold">配賦入力</div>

        {billingCycles.length === 0 ? (
          <div className="border border-border rounded-lg px-4 py-6 text-center text-muted-foreground text-[13px]">
            この月にBillingCycleが登録されていません
          </div>
        ) : activeMembers.length === 0 ? (
          <div className="border border-border rounded-lg px-4 py-6 text-center text-muted-foreground text-[13px]">
            配賦対象メンバーがいません（project_membersのis_active確認）
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeMembers.map((m) => {
              const memberProjects = getMemberProjects(m.memberId);
              const total = memberTotal(m.memberId);
              return (
                <div
                  key={m.memberId}
                  className="border border-border rounded-lg overflow-hidden bg-background"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
                    <span className="text-[13px] font-semibold">{m.codeName}</span>
                    <span className="text-[12px] font-medium text-muted-foreground">
                      {fmtYen(total)}
                    </span>
                  </div>
                  {/* Project Rows */}
                  <div className="divide-y divide-border">
                    {memberProjects.map((p) => {
                      const bc = getBc(p.projectId);
                      return (
                        <div key={p.projectId} className="px-3 py-2 flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-medium truncate">
                              {p.projectName}
                            </div>
                            {bc?.budget_yen ? (
                              <div className="text-[10px] text-muted-foreground">
                                予算 ¥{bc.budget_yen.toLocaleString("ja-JP")}
                              </div>
                            ) : null}
                          </div>
                          <input
                            type="number"
                            value={getAllocInput(m.memberId, p.projectId) || ""}
                            onChange={(e) =>
                              setAllocInput(m.memberId, p.projectId, Number(e.target.value))
                            }
                            placeholder="0"
                            className="w-24 text-right border border-border rounded px-1.5 py-0.5 text-[12px] bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30"
                            min={0}
                            step={1000}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payouts List */}
      {payouts.length > 0 && (
        <div>
          <div className="text-[13px] font-semibold mb-2">支払一覧 ({payouts.length}件)</div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-3 py-2 font-medium">メンバー</th>
                  <th className="text-left px-3 py-2 font-medium">PJ</th>
                  <th className="text-right px-3 py-2 font-medium">金額</th>
                  <th className="text-left px-3 py-2 font-medium">status</th>
                  <th className="text-left px-3 py-2 font-medium hidden md:table-cell">更新日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payouts.map((p, i) => {
                  const member = members.find((m) => m.memberId === p.member_id);
                  const project = projects.find((proj) => proj.projectId === p.project_id);
                  const amount = p.amount_yen ?? p.amount ?? 0;
                  return (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="px-3 py-2">{member?.codeName ?? p.member_id}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {project?.projectName ?? p.project_id}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{fmtYen(amount)}</td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                          {p.status ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                        {p.updated_at?.slice(0, 10) ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
