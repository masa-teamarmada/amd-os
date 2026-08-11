import Link from "next/link";
import { FolderOpen } from "lucide-react";
import type {
  SharedProjectControlPublication,
  ViewerLens,
} from "@/lib/shared-project-control";
import { SharedProjectControlDeck } from "./SharedProjectControlDeck";

type VisiblePublication = Exclude<SharedProjectControlPublication, null>;

export function ExternalProjectWorkspaceDashboard({
  projectId,
  publication,
  lens,
}: {
  projectId: string;
  publication: VisiblePublication;
  lens: ViewerLens;
}) {
  const snapshot = publication.state === "published" ? publication.snapshot : null;

  return (
    <main className="mx-auto min-w-0 max-w-[1480px] px-3 py-4 sm:px-5 lg:px-8 lg:py-7">
      <SharedProjectControlDeck
        snapshot={snapshot}
        lens={lens}
        state={snapshot ? "ready" : "unpublished"}
      />

      <Link
        href={`/project/${encodeURIComponent(projectId)}/workspace/files`}
        className="mt-4 flex min-h-20 items-center justify-between gap-4 rounded-lg border border-[#cbd5e1] bg-white p-5 transition-colors hover:bg-[#f8fafc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1677ff]"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#eaf3ff] text-[#075cad]"><FolderOpen className="h-5 w-5" aria-hidden /></span>
          <span className="min-w-0"><span className="block text-[13px] font-semibold text-[#172033]">PJ資料室</span><span className="mt-1 block text-[11px] text-[#64748b]">このPJで共有されている資料を確認する</span></span>
        </span>
        <span className="shrink-0 text-[12px] font-semibold text-[#075cad]">開く →</span>
      </Link>
    </main>
  );
}
