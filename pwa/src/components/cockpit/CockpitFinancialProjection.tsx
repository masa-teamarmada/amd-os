"use client";

import { Bzm22TimeLedgerSection } from "./Bzm22TimeLedgerSection";
import { CockpitPlMonthlySection } from "./CockpitPlMonthlySection";
import { AnnualProjectionTable } from "./CockpitBusinessPlan";

/**
 * 試算表タブ。月次P/L、BZM 2.2 の時間軸、SX の年次試算を同じ目的の計算面として置く。
 * 資本政策の前提編集はここに混ぜず、資本政策表タブで扱う。
 */
export function CockpitFinancialProjection({ projectId, showSxDetail = false, showTimeLedger = false }: {
  projectId: string;
  showSxDetail?: boolean;
  showTimeLedger?: boolean;
}) {
  return (
    <div className="space-y-5">
      {showTimeLedger && <Bzm22TimeLedgerSection projectId={projectId} />}
      <CockpitPlMonthlySection projectId={projectId} />
      {showSxDetail && <AnnualProjectionTable />}
    </div>
  );
}
