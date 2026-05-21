import { AdminPayoutsClient } from "@/components/admin/AdminPayoutsClient";

function getRecentYms(n = 6): string[] {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const result: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    result.push(`${y}${m}`);
  }
  return result;
}

export default async function AdminPayoutsPage() {
  const currentYm = getRecentYms(1)[0];
  const ymOptions = getRecentYms(12);

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-lg font-semibold">Payouts</h1>
        <span className="text-sm text-muted-foreground">支払管理 — {currentYm}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        請求月ベースで報酬確定済みcycleを集約し、支払明細とメンバー別通知額を保存する。
      </p>
      <AdminPayoutsClient initialYm={currentYm} ymOptions={ymOptions} />
    </div>
  );
}
