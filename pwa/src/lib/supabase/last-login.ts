import { createClient } from "@supabase/supabase-js";

export const LAST_LOGIN_TOUCH_COOKIE = "amd_os_last_login_touch";
export const API_ACTIVITY_HEADER = "x-amd-os-api-activity";
const LAST_LOGIN_TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export function shouldTouchLastLogin(value?: string, now = Date.now()) {
  const lastTouched = Number(value || 0);
  return !Number.isFinite(lastTouched) || now - lastTouched > LAST_LOGIN_TOUCH_INTERVAL_MS;
}

export function lastLoginCookieOptions() {
  return { path: "/", maxAge: LAST_LOGIN_TOUCH_INTERVAL_MS / 1000, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };
}

// Call only with an email returned by authoritative getUser validation.
// The same members UPDATE preserves existing display/order and audit triggers.
export async function touchLastLogin(email: string) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return;
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
  const { error } = await service.from("members").update({ last_login_at: new Date().toISOString() }).eq("email", email.toLowerCase());
  if (error) console.warn("[auth] failed to touch members.last_login_at:", error.message);
}
