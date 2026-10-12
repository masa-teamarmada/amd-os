import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { amieCardAccess } from "@/lib/project-card-designs-server";
import { ProjectCardDesigns } from "@/components/project-card-designs/ProjectCardDesigns";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "全PJの名刺案 - AMD OS" },
};
export default async function AmieAdminCardDesigns() {
  const member = await amieCardAccess();
  if (!member?.isAdmin) notFound();
  return (
    <main className="mx-auto w-full max-w-7xl p-4 md:p-6">
      <ProjectCardDesigns admin />
    </main>
  );
}
