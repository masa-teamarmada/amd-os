import { CurrentSpsProjectList } from "@/components/sps/CurrentSpsProjectList";
import { fetchCurrentSpsProjectAssessments } from "@/lib/seed-screening-bands";
import { fetchVenturesForMap } from "@/lib/venture-map-data";

export const metadata = {
  title: "AMD Score | Venture Map | AMD OS",
};

export const dynamic = "force-dynamic";

export default async function AmdScoreListPage() {
  const ventures = await fetchVenturesForMap();
  const assessments = await fetchCurrentSpsProjectAssessments(ventures.map((venture) => venture.project_id));

  return <CurrentSpsProjectList ventures={ventures} assessments={Array.from(assessments.values())} />;
}
