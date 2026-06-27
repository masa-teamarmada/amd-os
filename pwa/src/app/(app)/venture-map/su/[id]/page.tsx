import { notFound } from "next/navigation";
import Link from "next/link";
import {
  fetchVentureById,
  fetchXrlLog,
  fetchMacroIndexLog,
} from "@/lib/venture-map-data";
import { SuDetailView } from "@/components/venture-map/SuDetailView";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SuDetailPage({ params }: Props) {
  const { id } = await params;
  const [venture, xrlLog, macroLog] = await Promise.all([
    fetchVentureById(id),
    fetchXrlLog(id),
    fetchMacroIndexLog(),
  ]);

  if (!venture) notFound();

  const laneMacro = macroLog.filter((r) => r.lane === venture.lane);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6">
      <div className="mb-4 flex items-center gap-2 text-[12px] text-muted-foreground">
        <Link href="/venture-map" className="hover:underline">Venture Map</Link>
        <span>/</span>
        <span>{venture.project_label}</span>
      </div>
      <SuDetailView venture={venture} xrlLog={xrlLog} macroLog={laneMacro} />
    </div>
  );
}
