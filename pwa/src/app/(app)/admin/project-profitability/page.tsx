import { AdminProjectProfitabilityClient } from "@/components/admin/AdminProjectProfitabilityClient";

export const dynamic = "force-dynamic";

export default function AdminProjectProfitabilityPage() {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-lg font-semibold">PJ別 利益構造</h1>
        <span className="text-sm text-muted-foreground">Project Profitability</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        PJごとに、入ってきたお金・外部メンバーへの支払・会社に残る分・稼働の需要を年単位で並べ、
        「どのPJが儲かっていて、どのPJがまさの持ち出しで回っているか」を数字で判定する画面。
      </p>
      <AdminProjectProfitabilityClient />
    </div>
  );
}
