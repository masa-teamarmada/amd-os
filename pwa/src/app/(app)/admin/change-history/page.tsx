import type { Metadata } from "next";
import { AdminChangeHistoryClient } from "@/components/admin/AdminChangeHistoryClient";

export const metadata: Metadata = { title: { absolute: "データ変更履歴 - AMD OS" } };

export default function AdminChangeHistoryPage() {
  return <AdminChangeHistoryClient />;
}
