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
        PJのシーズンごとに、決まっている原資が外部への支払と会社に残る分へどう分かれたかを並べる。
        シーズンで決まっている原資のうち、いくらが外部メンバーへの現金支払として出ていき、いくらが会社に残るか。どのPJが利益を残せているかを判定する画面。
      </p>
      <AdminProjectProfitabilityClient />
    </div>
  );
}
