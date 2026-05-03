import { createClient } from "@/lib/supabase/server";
import { AdminSettingsClient } from "@/components/admin/AdminSettingsClient";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .order("key");

  if (error) console.error("AdminSettingsPage:", error.message);

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4">
        <h1 className="text-lg font-semibold">Settings</h1>
        <span className="text-sm text-muted-foreground">DB_Settings — {(data ?? []).length} 件</span>
      </div>
      <AdminSettingsClient settings={data ?? []} />
    </div>
  );
}
