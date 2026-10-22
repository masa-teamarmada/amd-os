import { notFound } from "next/navigation";
import { SxWeeklyControlDashboard } from "@/components/project-workspace/SxWeeklyControlDashboard";
import { PreviewBanner } from "../PreviewBanner";
import { previewWorkspace } from "../fixtures";

export default function ExecutiveWorkspaceLocalPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <>
    <PreviewBanner surface="workspace" />
    <SxWeeklyControlDashboard
      bundle={previewWorkspace}
      access={{ principal: "member", memberId: "preview-member", displayName: "表示確認", scope: "portfolio", isAdmin: false, canCockpit: true }}
      canExecutiveMeeting
    />
  </>;
}
