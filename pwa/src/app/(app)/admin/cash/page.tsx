import type { Metadata } from "next";
import { AdminCashClient, type CashTask } from "@/components/admin/cash/AdminCashClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "現金と融資 - AMD OS" } };

const TASK_IDS: CashTask[] = ["accounts", "loans", "simulator"];

function resolveTask(value: string | string[] | undefined): CashTask {
  const candidate = Array.isArray(value) ? value[0] : value;
  return TASK_IDS.includes(candidate as CashTask) ? (candidate as CashTask) : "accounts";
}

export default async function AdminCashPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string | string[] }>;
}) {
  const params = await searchParams;
  return <AdminCashClient initialTask={resolveTask(params.task)} />;
}
