import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    redirect("/auth/login");
  }

  const { data: member } = await supabase
    .from("members")
    .select("is_admin")
    .eq("email", user.email.toLowerCase())
    .single();

  if (!member?.is_admin) {
    redirect("/dashboard");
  }

  return <div className="min-h-screen min-w-0 p-6">{children}</div>;
}
