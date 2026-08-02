import { redirect } from "next/navigation";

/**
 * /portfolio-preview — 旧「研究ポートフォリオ構造プレビュー」。
 *
 * 2026-08-02 まさ確定でこのIA (研究機関・シーズを母集団、PJを契約成立後の運用レイヤーとする構造)
 * を /dashboard へ正式採用したため、独立した仮設シェルは撤去した。旧URLを壊さないため
 * /dashboard へ恒久 redirect するだけに残す。/dashboard 側の認証・アクセス制御 ((app) layout +
 * role-based top) がそのまま効く。
 */
export default function PortfolioPreviewRedirectPage() {
  redirect("/dashboard");
}
