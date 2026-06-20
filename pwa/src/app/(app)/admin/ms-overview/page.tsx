import { AdminMsOverviewClient } from "@/components/admin/AdminMsOverviewClient";

export const dynamic = "force-dynamic";

export default function AdminMsOverviewPage() {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-lg font-semibold">MS一覧</h1>
        <span className="text-sm text-muted-foreground">Milestone Overview — 全PJ MS設計の一望</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        全 active plan cycle の MS を pt 順で並べ、各 PJ の本契約原資 / 別財布原資 / pt単価 と
        メンバー別 年計 (plannedShare ベース理論値) を一望する。「pt 配分が他 MS と
        比べて妥当か」「メンバー間の序列がおかしくないか」を画面で並べて判断するための設計レビュー画面。
        実消化 (progress) は読まない。設計値そのものを見せる。
      </p>
      <AdminMsOverviewClient />
    </div>
  );
}
