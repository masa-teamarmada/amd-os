import { AmdScoreRetrofit } from "@/components/venture-map/AmdScoreRetrofit";
import { fetchAllAmdScoreInputs, fetchActiveAlpha } from "@/lib/amd-score-data";
import { fetchVenturesForMap } from "@/lib/venture-map-data";

export const metadata = {
  title: "AMD Score Retrofit (α 重み調整) | Venture Map | AMD OS",
};

export const dynamic = "force-dynamic";

/**
 * α 重み retrofit ページ。
 *
 * 詳細ページ (/venture-map/amd-score/[projectId]) からのみリンク (タブバーには載せない)。
 * 全 PJ の評価入力を読み込んで、α を変えたときに各 PJ の score がどう動くかを並列に
 * 見ながら慎重に調整するための専用画面。
 */
export default async function AmdScoreRetrofitPage() {
  const [ventures, inputs, { alpha }] = await Promise.all([
    fetchVenturesForMap(),
    fetchAllAmdScoreInputs(),
    fetchActiveAlpha(),
  ]);

  return <AmdScoreRetrofit ventures={ventures} inputs={inputs} initialAlpha={alpha} />;
}
