import type { Metadata } from "next";
import { AdminWeeklyMatrix } from "@/components/admin/AdminWeeklyMatrix";

export const metadata: Metadata = { title: { absolute: "Admin 週次活動 - AMD OS" } };

export default function AdminWeeklyPage() {
  return <AdminWeeklyMatrix />;
}
