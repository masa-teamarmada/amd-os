import { NextRequest, NextResponse } from "next/server";
import { scheduleGenerationRange, todayJst } from "@/lib/admin-schedule/date";
import { generateSchedule } from "@/lib/admin-schedule/generator";
import { sendScheduleNotifications, sendScheduleNotificationsWhenEnabled } from "@/lib/admin-schedule/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createAdminClient();
  const generation = await generateSchedule(db, scheduleGenerationRange(todayJst()));
  const calendarSync = generation.ok
    ? await db.functions.invoke("admin-schedule-calendar-sync", {
        body: {},
        headers: { "x-admin-schedule-sync-secret": process.env.CRON_SECRET ?? "" },
      })
    : null;
  const notifications = generation.ok
    ? await sendScheduleNotificationsWhenEnabled(() => sendScheduleNotifications(db))
    : null;
  const calendarSyncOk = !calendarSync || (!calendarSync.error && calendarSync.data?.ok === true);
  const ok = generation.ok && calendarSyncOk && (!notifications || notifications.ok);
  return NextResponse.json({ generation, calendarSync, notifications }, { status: ok ? 200 : 500 });
}
