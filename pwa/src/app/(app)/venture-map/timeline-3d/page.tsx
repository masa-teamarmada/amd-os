import Timeline3DView from "@/components/venture-map/Timeline3DView";
import { fetchAllVenturesWithXrl } from "@/lib/venture-map-data";

export const metadata = {
  title: "Timeline 3D | AMD OS",
};

export const dynamic = "force-dynamic";

export default async function Timeline3DPage() {
  // is_public=true の全 SU を取得 (status='active' で絞ると現状 0 件になる、
  // ventures.status は active 以外も含む。フィルタは将来必要になったら復活)
  const data = await fetchAllVenturesWithXrl();

  return (
    <div className="w-full">
      <Timeline3DView data={data} />
    </div>
  );
}
