import { parsePayload, type Project } from "./payload.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-tally-sync-key",
};

type SyncDatabase = {
  rpc(name: string, args: {
    p_member_id: string;
    p_window_start: string;
    p_window_end: string;
    p_projects: Project[];
  }): PromiseLike<{ error: { code?: string } | null }>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

export async function handleTallySync(request: Request, dependencies: {
  syncKey: string;
  database: () => SyncDatabase;
}) {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "POSTだけ使える" }, 405);
  if (!dependencies.syncKey || request.headers.get("x-tally-sync-key") !== dependencies.syncKey) return json({ ok: false, error: "認証に失敗" }, 401);
  const payload = parsePayload(await request.json().catch(() => null));
  if (!payload) return json({ ok: false, error: "同期内容が不正" }, 400);

  try {
    // One RPC is one transaction: settings, changed weeks, and scoped removals
    // either all commit or all roll back, including the existing audit triggers.
    const { error } = await dependencies.database().rpc("amie_sync_tally_effort", {
      p_member_id: payload.memberID,
      p_window_start: payload.windowStart,
      p_window_end: payload.windowEnd,
      p_projects: payload.projects,
    });
    if (error) {
      const invalid = ["22023", "22007", "22008", "22P02", "23503"].includes(error.code ?? "");
      return json({ ok: false, error: invalid ? "PJまたは同期内容を確認できない" : "同期内容を保存できない" }, invalid ? 400 : 500);
    }
    return json({ ok: true, projectCount: payload.projects.length, weekCount: payload.projects.reduce((sum, project) => sum + project.weeklyEffort.length, 0) });
  } catch {
    return json({ ok: false, error: "同期内容を保存できない" }, 500);
  }
}
