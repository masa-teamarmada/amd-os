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
        どのPJが儲かっていて、どのPJがまさの稼働で回っているかを見る画面。
        会社に残る現金から、まさが投じた時間の対価を引いた額で並べる。
      </p>
      <AdminProjectProfitabilityClient />
    </div>
  );
}
