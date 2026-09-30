import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// PJごとのDDパッケージの有無（コックピットとワークスペースの「DDパッケージ」タブを出すか）のサーバ側スナップショット。
// spec 5-10 の1層目。dd_packages はPJに1件程度の小さな表なので、表ごと1回読んで5分持つ。同時アクセスは1本へ束ねる。
// パッケージの表題・状態を変えたら invalidateDdPackageSummaryCache() を呼ぶ（/api/admin/dd の update_package）。

const TTL_MS = 5 * 60 * 1000;

export type DdPackageSummaryRow = {
  project_id: string;
  slug: string;
  title: string;
  status: "draft" | "open" | "closed";
};

let snapshot: { byProject: Map<string, DdPackageSummaryRow>; loadedAt: number } | null = null;
let inflight: Promise<Map<string, DdPackageSummaryRow>> | null = null;

async function loadAll(): Promise<Map<string, DdPackageSummaryRow>> {
  const db = createAdminClient();
  const rows: Array<DdPackageSummaryRow & { created_at: string }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("dd_packages")
      .select("project_id,slug,title,status,created_at")
      .order("created_at")
      .range(from, from + 999);
    if (error) throw new Error(`dd package summary: ${error.message}`);
    rows.push(...((data ?? []) as Array<DdPackageSummaryRow & { created_at: string }>));
    if ((data?.length ?? 0) < 1000) break;
  }
  // 管理画面（loadDdAdminState）と同じく、PJで最初に作ったパッケージを使う。
  const byProject = new Map<string, DdPackageSummaryRow>();
  for (const row of rows) {
    if (!byProject.has(row.project_id)) {
      byProject.set(row.project_id, { project_id: row.project_id, slug: row.slug, title: row.title, status: row.status });
    }
  }
  return byProject;
}

export async function getDdPackageSummary(
  projectId: string,
  options?: { fresh?: boolean },
): Promise<DdPackageSummaryRow | null> {
  if (options?.fresh) snapshot = null;
  if (snapshot && Date.now() - snapshot.loadedAt < TTL_MS) return snapshot.byProject.get(projectId) ?? null;
  if (!inflight) {
    inflight = loadAll()
      .then((byProject) => {
        snapshot = { byProject, loadedAt: Date.now() };
        return byProject;
      })
      .finally(() => {
        inflight = null;
      });
  }
  const byProject = await inflight;
  return byProject.get(projectId) ?? null;
}

export function invalidateDdPackageSummaryCache(): void {
  snapshot = null;
}
