import { notFound } from "next/navigation";
import { SxWeeklyControlDashboard } from "@/components/project-workspace/SxWeeklyControlDashboard";
import { PreviewBanner } from "@/app/preview-executive-meeting/PreviewBanner";
import { previewWorkspace } from "../fixtures";
import {previewPageRuntime} from "../fixtures";

export default function ExecutiveWorkspaceLocalPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <>
    <PreviewBanner surface="workspace" />
    <SxWeeklyControlDashboard
      bundle={previewWorkspace}
      access={{ principal: "member", memberId: "preview-member", displayName: "表示確認", scope: "portfolio", isAdmin: false, canCockpit: true }}
      initialRuntime={previewPageRuntime()}
      canExecutiveMeeting
    />
  </>;
}
