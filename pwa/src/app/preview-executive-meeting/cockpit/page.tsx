import { notFound } from "next/navigation";
import { CockpitView } from "@/components/cockpit/CockpitView";
import { PreviewBanner } from "@/app/preview-executive-meeting/PreviewBanner";
import { previewCockpit } from "../fixtures";
import {previewPageRuntime} from "../fixtures";

export default function ExecutiveCockpitLocalPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main className="min-h-screen bg-background">
    <PreviewBanner surface="cockpit" />
    <CockpitView cockpit={previewCockpit} tasks={[]} activeTab="executive-meeting" canExecutiveMeeting initialRuntime={previewPageRuntime()} />
  </main>;
}
