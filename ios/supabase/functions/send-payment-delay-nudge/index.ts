/**
 * send-payment-delay-nudge
 * 支払い延期リスクのあるPJメンバー全員に AMD OS アプリ通知を積む。
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    const { projectId, ym, missingStepLabels } = await req.json() as {
      projectId: string;
      ym: string;
      missingStepLabels?: string[];
    };

    if (!projectId || !ym) {
      return json({ ok: false, message: "projectId / ym が必要" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return json({ ok: false, message: "SUPABASE_DB_URL が未設定" }, 500);
    }

    const db = createClient(supabaseUrl, serviceKey);
    const sql = postgres(dbUrl, { prepare: false, max: 1 });
    try {
      await ensureNotificationSchema(sql);

      const { data: projects } = await db
        .from("projects")
        .select("project_name")
        .eq("project_id", projectId)
        .limit(1);
      const projectName = projects?.[0]?.project_name ?? projectId;

      const { data: projectMembers, error: memberError } = await db
        .from("project_members")
        .select("member_id")
        .eq("project_id", projectId)
        .eq("is_active", true);
      if (memberError) {
        return json({ ok: false, message: `project_members取得失敗: ${memberError.message}` }, 500);
      }

      const memberIds = (projectMembers ?? []).map((row) => String(row.member_id ?? "")).filter(Boolean);
      if (memberIds.length === 0) {
        return json({ ok: false, message: "対象メンバーがいません" }, 404);
      }

      const { data: members, error: profileError } = await db
        .from("members")
        .select("member_id, code_name")
        .in("member_id", memberIds);
      if (profileError) {
        return json({ ok: false, message: `members取得失敗: ${profileError.message}` }, 500);
      }

      const recipients = (members ?? []).filter((row) => row.member_id);
      if (recipients.length === 0) {
        return json({ ok: false, message: "対象メンバーがいません" }, 404);
      }

      const year = ym.length === 6 ? ym.slice(0, 4) : ym;
      const month = ym.length === 6 ? String(parseInt(ym.slice(4, 6), 10)) : ym;
      const missingText = (missingStepLabels ?? []).filter(Boolean).join(" / ");
      const text = [
        `⚠️ *${projectName}* ${year}年${month}月分の支払い延期リスク`,
        "",
        "このままだと今月このPJの支払いができないので、タスクを完了させてね。",
        missingText ? `未完了: ${missingText}` : "",
      ].filter(Boolean).join("\n");

      const payload = recipients.map((recipient) => ({
        member_id: recipient.member_id,
        notification_type: "payment_delay_nudge",
        title: `${projectName}: 支払い延期リスク`,
        body: missingText
          ? `このままだと今月このPJの支払いができないので、${missingText} を完了させてね。`
          : "このままだと今月このPJの支払いができないので、未完了タスクを完了させてね。",
        project_id: projectId,
        ym,
        payload_json: {
          missingStepLabels: missingStepLabels ?? [],
          projectName,
          text,
        },
      }));

      await sql`
        delete from public.member_app_notifications
        where notification_type = 'payment_delay_nudge'
          and project_id = ${projectId}
          and ym = ${ym}
          and member_id = any(${sql.array(memberIds)})
          and read_at is null
      `;

      for (const item of payload) {
        await sql`
          insert into public.member_app_notifications (
            member_id,
            notification_type,
            title,
            body,
            project_id,
            ym,
            payload_json,
            delivered_at,
            read_at
          ) values (
            ${item.member_id},
            ${item.notification_type},
            ${item.title},
            ${item.body},
            ${item.project_id},
            ${item.ym},
            ${JSON.stringify(item.payload_json)}::jsonb,
            null,
            null
          )
        `;
      }

      const sentCount = payload.length;
      return json({
        ok: sentCount > 0,
        sentCount,
        message: sentCount > 0 ? `${sentCount}人にアプリ通知を送ったよ` : "アプリ通知作成に失敗しました",
      }, sentCount > 0 ? 200 : 500);
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

async function ensureNotificationSchema(sql: postgres.Sql) {
  await sql`create extension if not exists pgcrypto`;
  await sql`
    create table if not exists public.member_app_notifications (
      id uuid primary key default gen_random_uuid(),
      member_id text not null,
      notification_type text not null,
      title text not null,
      body text not null,
      project_id text,
      ym text,
      payload_json jsonb not null default '{}'::jsonb,
      delivered_at timestamptz,
      read_at timestamptz,
      created_at timestamptz not null default timezone('utc', now())
    )
  `;
  await sql`alter table public.member_app_notifications enable row level security`;
  await sql`grant select, update on public.member_app_notifications to authenticated`;
  await sql`
    do $$
    begin
      if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'member_app_notifications'
          and policyname = 'member_app_notifications_select_own'
      ) then
        create policy member_app_notifications_select_own
        on public.member_app_notifications
        for select
        to authenticated
        using (
          member_id = (
            select m.member_id
            from public.members m
            where lower(m.email) = lower(coalesce(auth.jwt()->>'email', ''))
            limit 1
          )
        );
      end if;
    end
    $$
  `;
  await sql`
    do $$
    begin
      if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'member_app_notifications'
          and policyname = 'member_app_notifications_update_own'
      ) then
        create policy member_app_notifications_update_own
        on public.member_app_notifications
        for update
        to authenticated
        using (
          member_id = (
            select m.member_id
            from public.members m
            where lower(m.email) = lower(coalesce(auth.jwt()->>'email', ''))
            limit 1
          )
        )
        with check (
          member_id = (
            select m.member_id
            from public.members m
            where lower(m.email) = lower(coalesce(auth.jwt()->>'email', ''))
            limit 1
          )
        );
      end if;
    end
    $$
  `;
  await sql`
    create index if not exists idx_member_app_notifications_member_created
    on public.member_app_notifications (member_id, created_at desc)
  `;
  await sql`
    create index if not exists idx_member_app_notifications_pending
    on public.member_app_notifications (member_id, delivered_at, read_at)
  `;
}
