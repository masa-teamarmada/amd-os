import { redirect } from "next/navigation";
import { GlobalNav } from "@/components/nav/GlobalNav";
import TsukuyomiMascot from "@/components/tsukuyomi/Mascot";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login");
  }

  let userCodeName = "Guest";
  if (user.email) {
    const { data: member } = await supabase
      .from("members")
      .select("code_name")
      .eq("email", user.email)
      .single();
    if (member?.code_name) userCodeName = member.code_name;
  }

  return (
    <>
      <GlobalNav userCodeName={userCodeName} />
      <main className="flex-1">{children}</main>
      <TsukuyomiMascot />
    </>
  );
}
