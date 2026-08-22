import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * /model — モデル版数台帳セクションは admin (= members.is_admin) 限定。
 * /spec (設計書) と同じ考え方: 確定していないモデル・提案中の概念も並ぶため、
 * まさ・実装者以外には出さない。
 */
export default async function ModelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

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

  return <>{children}</>;
}
