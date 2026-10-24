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

export default async function AdminPayoutsPage({ embedded = false, searchParams }: { embedded?: boolean; searchParams?: Promise<{ ym?: string }> } = {}) {
  const requestedYm = (await searchParams)?.ym;
  const currentYm = requestedYm && /^\d{4}(0[1-9]|1[0-2])$/.test(requestedYm) ? requestedYm : getRecentYms(1)[0];
  const ymOptions = [...new Set([currentYm, ...getRecentYms(12)])];
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
          全PJのシーズン収支を確認し、今回の支払通知書を作成・送付する。
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-3 mb-1">
            <h1 className="text-lg font-semibold">支払通知書</h1>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            シーズンの月別収支 → 発行前確認 → メンバー別の作成・送付。
          </p>
        </>
      )}
      <AdminPayoutsClient initialYm={currentYm} ymOptions={ymOptions} initialData={initialData} />
    </div>
  );
}
