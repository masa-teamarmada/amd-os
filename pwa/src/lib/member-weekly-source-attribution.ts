/**
 * member-weekly-activities cron の evidence source attribution (誰の行動として扱うか) を純関数化したもの。
 * route.ts と scripts/check_member_weekly_source_attribution.mts の両方から import する。
 */

/** bot が投稿した Slack message は誰の実績にもしない */
export function slackActorId(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta) return null;
  if (typeof meta.bot_id === "string" && meta.bot_id) return null;
  if (meta.subtype === "bot_message") return null;
  const candidate = meta.user ?? meta.user_id ?? meta.actor_slack_id;
  return typeof candidate === "string" && candidate ? candidate : null;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return null;
  return trimmed;
}

/**
 * Drive の raw_metadata から編集者/所有者の email を lowercase・重複なしで抽出する。
 * last_modifying_user_email / lastModifyingUser.emailAddress / owner (文字列) / owners (配列) を見る。
 * 想定外の型 (数値, object不整合等) は安全に無視する。
 */
export function driveActorEmails(meta: Record<string, unknown> | null | undefined): string[] {
  if (!meta) return [];
  const emails = new Set<string>();

  const lastModifyingEmail = normalizeEmail(meta.last_modifying_user_email);
  if (lastModifyingEmail) emails.add(lastModifyingEmail);

  const lastModifyingUser = meta.lastModifyingUser;
  if (lastModifyingUser && typeof lastModifyingUser === "object") {
    const email = normalizeEmail((lastModifyingUser as Record<string, unknown>).emailAddress);
    if (email) emails.add(email);
  }

  const owner = normalizeEmail(meta.owner);
  if (owner) emails.add(owner);

  const owners = meta.owners;
  if (Array.isArray(owners)) {
    for (const entry of owners) {
      if (typeof entry === "string") {
        const email = normalizeEmail(entry);
        if (email) emails.add(email);
        continue;
      }
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        const email = normalizeEmail(record.email) ?? normalizeEmail(record.emailAddress);
        if (email) emails.add(email);
      }
    }
  }

  return Array.from(emails);
}
