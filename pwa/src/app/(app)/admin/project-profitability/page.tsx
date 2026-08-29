import { AdminProjectProfitabilityClient } from "@/components/admin/AdminProjectProfitabilityClient";

export const dynamic = "force-dynamic";

export default function AdminProjectProfitabilityPage() {
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-3">
        <h1 className="text-lg font-semibold">PJ別 利益構造</h1>
        <span className="text-sm text-muted-foreground">Project Profitability</span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        PJごとに、配分枠のうちいくらが外部メンバーへの現金支払として出ていき、いくらが会社に残ったかを年単位で並べる。
        どのPJが現金を残せていて、どのPJで稼働が枠を超えているかを判定する画面。
      </p>
      <AdminProjectProfitabilityClient />
    </div>
  );
}
