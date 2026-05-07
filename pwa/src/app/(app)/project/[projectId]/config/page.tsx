"use client";

import { useParams } from "next/navigation";
import { ProjectConfigForm } from "@/components/project-config/ProjectConfigForm";

export default function ProjectConfigPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  return (
    <div className="min-h-[calc(100vh-2.75rem)] py-6 px-4 md:px-8">
      <ProjectConfigForm projectId={projectId} />
    </div>
  );
}
