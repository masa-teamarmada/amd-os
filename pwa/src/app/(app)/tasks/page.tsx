import type { Metadata } from "next";
import { TasksClient } from "@/components/tasks/TasksClient";

export const metadata: Metadata = { title: { absolute: "タスク - AMD OS" } };

export default function TasksPage() {
  return <TasksClient />;
}
