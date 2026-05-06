import Timeline3DView from "@/components/venture-map/Timeline3DView";
import { fetchAllVenturesWithXrl } from "@/lib/venture-map-data";

export const metadata = {
  title: "Timeline 3D | AMD OS",
};

export const dynamic = "force-dynamic";

export default async function Timeline3DPage() {
  const data = await fetchAllVenturesWithXrl({ activeOnly: true });

  return (
    <div className="w-full">
      <Timeline3DView data={data} />
    </div>
  );
}
