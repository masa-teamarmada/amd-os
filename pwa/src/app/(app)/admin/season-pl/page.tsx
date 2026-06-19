import { AdminSeasonPlClient } from "@/components/admin/AdminSeasonPlClient";

export const dynamic = "force-dynamic";

export default function AdminSeasonPlPage() {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-lg font-semibold">シーズン予実表</h1>
        <span className="text-sm text-muted-foreground">Season Budget vs Actual</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        1 PJ × 1 シーズン (plan cycle) ごとに、請求額・バッファ内訳・メンバー原資・AMD
        マージン・pt 比メンバー予実を集約し、「入金と配分が閉じているか」を全 PJ で検算する。
        pt 単価過大・未割当 pt・原資≠Σ月 cap・役員 stock 非収束を一目で検知するための安全網。
      </p>
      <AdminSeasonPlClient />
    </div>
  );
}
