import { VcInvestmentLedger } from "@/components/vc/VcInvestmentLedger";
import { VcSectionNav } from "@/components/vc/VcSectionNav";

export default function VcInvestmentsPage() {
  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 py-6">
      <header className="mb-4 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">VC 投資履歴</h1>
          <p className="mt-1 max-w-4xl text-xs leading-relaxed text-muted-foreground">
            どのVCが、いつ、どのSUへ、いくら出資したかを参加単位で比較する台帳。
            VC個別の出資額とラウンド総額は別項目で、収集候補は確認済み情報と分けて表示する。
          </p>
        </div>
        <VcSectionNav />
      </header>
      <VcInvestmentLedger />
    </div>
  );
}
