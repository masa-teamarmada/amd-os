"use client";

import { CockpitKuteSeeds } from "@/components/cockpit/CockpitKuteSeeds";

export default function SeedsComparisonPage() {
  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 py-6">
      <CockpitKuteSeeds scope="all" detailSurface="internal" />
    </div>
  );
}
