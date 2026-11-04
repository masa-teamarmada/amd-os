import { redirect } from "next/navigation";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { CompanyManagementScreen } from "@/components/management-score/CompanyManagementScreen";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function AdminManagementScorePage() {
  const access = await getCurrentMemberAccess();
  if (!access?.isAdmin || access.scope !== "portfolio") redirect("/dashboard");
  return <CompanyManagementScreen view="management" />;
}
