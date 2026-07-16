import { NextRequest, NextResponse } from "next/server";
import { scheduleGenerationRange, todayJst } from "@/lib/admin-schedule/date";
import { generateSchedule } from "@/lib/admin-schedule/generator";
import { sendScheduleNotifications } from "@/lib/admin-schedule/notifications";
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
  const notifications = generation.ok ? await sendScheduleNotifications(db) : null;
  const ok = generation.ok && (!notifications || notifications.ok);
  return NextResponse.json({ generation, notifications }, { status: ok ? 200 : 500 });
}
