import type { SupabaseClient } from "@supabase/supabase-js";
import { PROPER_NOUN_CONFIG_KEY, ProperNounValidationError, parseProperNounValue, validateProperNounEntries } from "./project-proper-nouns";

type Context = { params: Promise<{ projectId: string }> };
type WriteAccess = { ok: true; user: { email: string } } | { ok: false; errorResponse: Response };
type Dependencies = {
  readAccess: (projectId: string) => Promise<{ canEdit: boolean } | null>;
  writeAccess: (request: Request, projectId: string) => Promise<WriteAccess>;
  createDb: () => Pick<SupabaseClient, "from">;
};
const headers = { "Cache-Control": "private, no-store" };

export function createProjectProperNounHandlers(deps: Dependencies) {
  async function load(db: Pick<SupabaseClient, "from">, projectId: string) {
    const { data, error } = await db.from("project_config").select("value,updated_at").eq("project_id", projectId).eq("key", PROPER_NOUN_CONFIG_KEY).maybeSingle();
    if (error) throw error;
    const parsed = parseProperNounValue(data ? data.value : null);
    return { ...parsed, updatedAt: data?.updated_at ?? null };
  }
  return {
    async GET(_request: Request, ctx: Context) {
      const { projectId } = await ctx.params;
      const access = await deps.readAccess(projectId);
      if (!access) return Response.json({ ok: false, error: "見つからない" }, { status: 404, headers });
      try {
        const dictionary = await load(deps.createDb(), projectId);
        return Response.json({ ok: true, dictionary: { entries: dictionary.entries, updatedAt: dictionary.updatedAt }, canEdit: access.canEdit }, { headers });
      } catch {
        return Response.json({ ok: false, error: "固有名詞を読み込めません。再読み込みしてください。" }, { status: 500, headers });
      }
    },
    async PATCH(request: Request, ctx: Context) {
      const { projectId } = await ctx.params;
      const access = await deps.writeAccess(request, projectId);
      if (!access.ok) return access.errorResponse;
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object" || !(body.expectedUpdatedAt === null || typeof body.expectedUpdatedAt === "string")) return Response.json({ ok: false, error: "保存内容が不正。再読み込みしてください。" }, { status: 400, headers });
      try {
        const entries = validateProperNounEntries(body.entries);
        const db = deps.createDb();
        const current = await load(db, projectId);
        if (current.updatedAt !== body.expectedUpdatedAt) return Response.json({ ok: false, error: "ほかの人が更新しました。再読み込みしてから保存してください。" }, { status: 409, headers });
        const value = JSON.stringify({ ...current.metadata, version: 1, entries, updated_by: access.user.email });
        const updatedAt = new Date(Math.max(Date.now(), current.updatedAt ? Date.parse(current.updatedAt) + 1 : 0)).toISOString();
        const query = current.updatedAt === null
          ? db.from("project_config").insert({ project_id: projectId, key: PROPER_NOUN_CONFIG_KEY, value, updated_at: updatedAt })
          : db.from("project_config").update({ value, updated_at: updatedAt }).eq("project_id", projectId).eq("key", PROPER_NOUN_CONFIG_KEY).eq("updated_at", current.updatedAt);
        const { data, error } = await query.select("value,updated_at").maybeSingle();
        if (error?.code === "23505" || (!error && !data)) return Response.json({ ok: false, error: "ほかの人が更新しました。再読み込みしてから保存してください。" }, { status: 409, headers });
        if (error) throw error;
        if (!data) throw new Error("保存した内容を読み直せない");
        const saved = parseProperNounValue(data.value);
        return Response.json({ ok: true, dictionary: { entries: saved.entries, updatedAt: data.updated_at }, canEdit: true }, { headers });
      } catch (error) {
        if (error instanceof ProperNounValidationError) return Response.json({ ok: false, error: error.message, row: error.row, field: error.field }, { status: 400, headers });
        return Response.json({ ok: false, error: "固有名詞を保存できません。再度お試しください。" }, { status: 500, headers });
      }
    },
  };
}
