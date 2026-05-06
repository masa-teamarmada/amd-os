import { AmdScoreList } from "@/components/venture-map/AmdScoreList";
import { fetchAllAmdScoreInputs, fetchActiveAlpha } from "@/lib/amd-score-data";
import { fetchVenturesForMap } from "@/lib/venture-map-data";

export const metadata = {
  title: "AMD Score | Venture Map | AMD OS",
};

export const dynamic = "force-dynamic";

export default async function AmdScoreListPage() {
  const [ventures, inputs, { alpha }] = await Promise.all([
    fetchVenturesForMap(),
    fetchAllAmdScoreInputs(),
    fetchActiveAlpha(),
  ]);

  return <AmdScoreList ventures={ventures} inputs={inputs} alpha={alpha} />;
}
