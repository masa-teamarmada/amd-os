import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSettingsClient } from "@/components/admin/AdminSettingsClient";
import { OperationsSettingsClient } from "@/components/settings/OperationsSettingsClient";
import { cronOperations, l2Datasets, rawDataSources } from "@/lib/operations-catalog";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase() ?? "";
  if (!email) notFound();

  const { data: member } = await supabase
    .from("members")
    .select("is_admin")
    .eq("email", email)
    .maybeSingle();
  if (!member?.is_admin) notFound();

  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .order("key");

  if (error) console.error("AdminSettingsPage:", error.message);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-baseline gap-3 mb-4">
          <h1 className="text-lg font-semibold">Operations Settings</h1>
          <span className="text-sm text-muted-foreground">Raw / L2 / Cron Control</span>
        </div>
        <OperationsSettingsClient
          rawDataSources={rawDataSources}
          l2Datasets={l2Datasets}
          cronOperations={cronOperations}
        />
      </div>

      <div>
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="text-lg font-semibold">DB Settings</h2>
          <span className="text-sm text-muted-foreground">DB_Settings — {(data ?? []).length} 件</span>
        </div>
        <AdminSettingsClient settings={data ?? []} />
      </div>
    </div>
  );
}
