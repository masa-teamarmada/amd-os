import { CyberspaceView } from "@/components/venture-map/CyberspaceView";
import { fetchAllAmdScoreInputs, fetchActiveAlpha } from "@/lib/amd-score-data";
import { fetchVenturesForMap } from "@/lib/venture-map-data";

export const metadata = {
  title: "Cyberspace | Venture Map | AMD OS",
};

export const dynamic = "force-dynamic";

export default async function CyberspacePage() {
  const [ventures, inputs, { alpha }] = await Promise.all([
    fetchVenturesForMap(),
    fetchAllAmdScoreInputs(),
    fetchActiveAlpha(),
  ]);

  return <CyberspaceView ventures={ventures} inputs={inputs} alpha={alpha} />;
}
