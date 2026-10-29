import { AdminPayoutsClient } from "@/components/admin/AdminPayoutsClient";
import { loadTargetData } from "@/app/api/admin/payouts/route";
import { defaultPayoutPaymentYm, selectablePayoutPaymentYms } from "@/lib/payout-month-selection";

export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage({ embedded = false, searchParams }: { embedded?: boolean; searchParams?: Promise<{ ym?: string }> } = {}) {
  const requestedYm = (await searchParams)?.ym;
  const now = new Date();
  const currentYm = requestedYm && /^\d{4}(0[1-9]|1[0-2])$/.test(requestedYm) ? requestedYm : defaultPayoutPaymentYm(now);
  const ymOptions = selectablePayoutPaymentYms(currentYm, now);
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
