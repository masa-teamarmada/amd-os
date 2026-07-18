import { redirect } from "next/navigation";
import { getCurrentMemberAccess, memberHome } from "@/lib/project-workspace";

export default async function Home() {
  const access = await getCurrentMemberAccess();
  if (!access) redirect("/auth/login?next=/");
  redirect(memberHome(access));
}
