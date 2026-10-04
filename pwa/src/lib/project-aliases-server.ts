import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * PJの別名（project_knowledge の category='alias'、status='active' の entity_name）。
 *
 * 会議の予定・活動・メールをPJへ振り分けるとき、PJ名・会社名と並べて使う。
 * PJ番号ごとの別名の表をコードに持たない（2026-10-04 まさ「どれか特定のPJだけの処理は実装しないで。
 * 特定のPJだけの特例を入れたらシステムにならない」、spec 3-23 §6）。別名を足すときは台帳に行を足す。
 *
 * 参照系（変わるのは週単位以下）なので、サーバのプロセス内に10分持つ（spec 5-10）。
 */
const TTL_MS = 10 * 60 * 1000;

let cached: { at: number; value: Map<string, string[]> } | null = null;
let inflight: Promise<Map<string, string[]>> | null = null;

export async function loadProjectAliases(db: SupabaseClient): Promise<Map<string, string[]>> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await db
      .from("project_knowledge")
      .select("project_id,entity_name")
      .eq("category", "alias")
      .eq("status", "active");
    if (error) throw new Error(`project aliases: ${error.message}`);
    const value = new Map<string, string[]>();
    for (const row of (data ?? []) as Array<{ project_id: string | null; entity_name: string | null }>) {
      const projectId = String(row.project_id || "").trim();
      const alias = String(row.entity_name || "").trim();
      if (!projectId || !alias) continue;
      value.set(projectId, [...(value.get(projectId) ?? []), alias]);
    }
    cached = { at: Date.now(), value };
    return value;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** 別名の台帳を書き換えたあとに呼ぶ。 */
export function invalidateProjectAliases(): void {
  cached = null;
}
