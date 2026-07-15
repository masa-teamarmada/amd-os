import { MaterialsKnowledgeView } from "@/components/knowledge-map/MaterialsKnowledgeView";
import { fetchKnowledgeMapData } from "@/lib/knowledge-map-data";

export const metadata = {
  title: "AMD Materials | AMD OS",
};

export const dynamic = "force-dynamic";

export default async function KnowledgeMapPage() {
  const data = await fetchKnowledgeMapData();
  return <MaterialsKnowledgeView knowledgeData={data} />;
}
