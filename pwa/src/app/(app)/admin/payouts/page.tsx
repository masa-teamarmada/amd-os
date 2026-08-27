import { AdminPayoutsClient } from "@/components/admin/AdminPayoutsClient";
import { loadTargetData } from "@/app/api/admin/payouts/route";

export const dynamic = "force-dynamic";

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

export default async function AdminPayoutsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const currentYm = getRecentYms(1)[0];
  const ymOptions = getRecentYms(12);
  let initialData: Awaited<ReturnType<typeof loadTargetData>> | null = null;

  try {
    initialData = await loadTargetData(currentYm, { includeAgreementGate: false });
  } catch (err) {
    console.error("[admin payouts page initial data]", err);
  }

  return (
    <div>
      {embedded ? (
        <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
          支払月ベースで報酬確定済みcycleを集約 — {currentYm}。支払明細とメンバー別通知額を保存する。
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-3 mb-1">
            <h1 className="text-lg font-semibold">支払通知書</h1>
            <span className="text-sm text-muted-foreground">支払月 {currentYm}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            支払月ベースで報酬確定済みcycleを集約し、支払明細とメンバー別通知額を保存する。
          </p>
        </>
      )}
      <AdminPayoutsClient initialYm={currentYm} ymOptions={ymOptions} initialData={initialData} />
    </div>
  );
}
