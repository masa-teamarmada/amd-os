import postgres from "npm:postgres@3.4.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json() as { email?: string };
    if (!email) {
      return json({ ok: false, message: "email が必要" }, 400);
    }

    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return json({ ok: false, message: "SUPABASE_DB_URL が未設定" }, 500);
    }

    const sql = postgres(dbUrl, { prepare: false, max: 1 });
    try {
      const members = await sql<{ member_id: string }[]>`
        select member_id
        from public.members
        where lower(email) = lower(${email})
        limit 1
      `;
      const memberId = members[0]?.member_id;
      if (!memberId) {
        return json({ ok: true, notifications: [] });
      }

      const notifications = await sql<{
        id: string
        notification_type: string
        title: string
        body: string
        project_id: string | null
        ym: string | null
        created_at: string
      }[]>`
        select
          id::text,
          notification_type,
          title,
          body,
          project_id,
          ym,
          created_at::text
        from public.member_app_notifications
        where member_id = ${memberId}
          and delivered_at is null
        order by created_at asc
      `;

      if (notifications.length > 0) {
        await sql`
          update public.member_app_notifications
          set delivered_at = timezone('utc', now())
          where member_id = ${memberId}
            and delivered_at is null
        `;
      }

      return json({ ok: true, notifications });
    } finally {
      await sql.end({ timeout: 5 });
    }
  } catch (e) {
    return json({ ok: false, message: String((e as Error).message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
