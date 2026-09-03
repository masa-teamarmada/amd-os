/**
 * 議事録欠損台帳 (`meeting_minutes_backfill_ledger`) の照合ロジック。
 *
 * 設計の核: 台帳は writer の自己申告ではなく、DB の実状態から書き直す。
 * 「保存に失敗した」と report に書いても次の run へ渡らなかったのが今回の穴なので、
 * 「候補として出したのに、次の run でもまだ確定版が無い」という観測事実で試行回数を数える。
 *
 * planLedgerReconciliation は純関数。DB も時計も触らないので fixture で検査できる。
 */

export const DEFAULT_EMIT_LIMIT = 3;
export const DEFAULT_MAX_ATTEMPTS = 5;
export const HELD_GRACE_MINUTES = 60;

/** `upcoming:<eventId>` / `upcoming:<eventId>_20260819T070000Z` から event id を取り出す。 */
export function bareEventId(meetingId) {
  const value = String(meetingId || "");
  if (!value.startsWith("upcoming:")) return value;
  return value.slice("upcoming:".length);
}

/** 同じ会議を指す別idを畳むための鍵。Calendarで会議が複製されるとidだけ変わる。 */
function occurrenceKey(projectId, startAt) {
  const time = Date.parse(startAt || "");
  if (!Number.isFinite(time)) return null;
  return `${projectId || "?"}@${Math.round(time / 60000)}`;
}

function isUpcomingRow(row) {
  return String(row.meeting_id || "").startsWith("upcoming:");
}

/**
 * @param {object} input
 * @param {Date}   input.now
 * @param {Array}  input.summaryRows    project_meeting_summaries の行 (upcoming と確定版の両方)
 * @param {Array}  input.ledgerRows     meeting_minutes_backfill_ledger の行
 * @param {number} [input.emitLimit]    1回のrunで候補として出す上限
 * @param {number} [input.maxAttempts]  新規行に入れる試行上限
 * @returns {{inserts: Array, updates: Array, emits: Array, stats: object}}
 */
export function planLedgerReconciliation({
  now,
  summaryRows,
  ledgerRows,
  emitLimit = DEFAULT_EMIT_LIMIT,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}) {
  const nowMs = now.getTime();
  const heldBefore = nowMs - HELD_GRACE_MINUTES * 60 * 1000;

  // 確定版の索引。event id と、同一会議を指す (PJ, 開始時刻) の両方で引けるようにする。
  const confirmedByEventId = new Set();
  const confirmedByOccurrence = new Set();
  for (const row of summaryRows) {
    if (isUpcomingRow(row)) continue;
    if (row.calendar_event_id) confirmedByEventId.add(String(row.calendar_event_id));
    if (row.meeting_id) confirmedByEventId.add(String(row.meeting_id));
    const key = occurrenceKey(row.project_id, row.meeting_start_at);
    if (key) confirmedByOccurrence.add(key);
  }

  const hasConfirmed = (eventId, projectId, startAt) => {
    if (eventId && confirmedByEventId.has(String(eventId))) return true;
    const key = occurrenceKey(projectId, startAt);
    return Boolean(key && confirmedByOccurrence.has(key));
  };

  // 開催済みなのに確定版が無い予定カード。これが検出の入口。
  // 「既存行があるものだけ」という旧救済レーンの条件をここでは使わない。
  const missingScheduled = [];
  for (const row of summaryRows) {
    if (!isUpcomingRow(row)) continue;
    const startMs = Date.parse(row.meeting_start_at || "");
    if (!Number.isFinite(startMs) || startMs >= heldBefore) continue;
    const eventId = String(row.calendar_event_id || bareEventId(row.meeting_id) || "");
    if (!eventId) continue;
    if (hasConfirmed(eventId, row.project_id, row.meeting_start_at)) continue;
    missingScheduled.push({
      calendar_event_id: eventId,
      project_id: row.project_id ?? null,
      title: row.title,
      meeting_start_at: row.meeting_start_at,
    });
  }

  const ledgerByEventId = new Map(ledgerRows.map((row) => [String(row.calendar_event_id), row]));
  const nowIso = now.toISOString();

  const inserts = [];
  const seen = new Set();
  for (const item of missingScheduled) {
    if (seen.has(item.calendar_event_id)) continue;
    seen.add(item.calendar_event_id);
    if (ledgerByEventId.has(item.calendar_event_id)) continue;
    inserts.push({
      ...item,
      status: "pending",
      attempt_count: 0,
      max_attempts: maxAttempts,
      first_detected_at: nowIso,
      detected_by: "h1_candidate_gate",
    });
  }

  const updates = [];
  for (const row of ledgerRows) {
    const eventId = String(row.calendar_event_id);
    const recovered = hasConfirmed(eventId, row.project_id, row.meeting_start_at);

    if (recovered) {
      // 手動backfillでも自動runでも、確定版が出来た時点で追跡を終える。
      if (row.status !== "recovered") {
        updates.push({ calendar_event_id: eventId, status: "recovered", last_outcome: "confirmed_row_present", last_error: null });
      }
      continue;
    }

    // 終了した会議だけを扱う。まだ開催前の予定は台帳に入らない。
    if (row.status !== "pending") continue;

    // 前回のrunで候補として出したのに、まだ確定版が無い = 1回失敗したという観測。
    const emittedAt = Date.parse(row.last_emitted_at || "");
    const attemptedAt = Date.parse(row.last_attempt_at || "");
    const consumed = Number.isFinite(emittedAt) && (!Number.isFinite(attemptedAt) || attemptedAt < emittedAt);
    if (!consumed) continue;

    const attempts = (Number(row.attempt_count) || 0) + 1;
    const limit = Number(row.max_attempts) || maxAttempts;
    updates.push({
      calendar_event_id: eventId,
      attempt_count: attempts,
      last_attempt_at: nowIso,
      status: attempts >= limit ? "abandoned" : "pending",
      last_outcome: attempts >= limit ? "give_up_after_max_attempts" : "still_missing_after_attempt",
    });
  }

  // 更新後の姿で候補を選ぶ。今回 abandoned になった行は出さない。
  const updateByEventId = new Map(updates.map((u) => [u.calendar_event_id, u]));
  const candidates = [];
  for (const row of [...ledgerRows, ...inserts]) {
    const eventId = String(row.calendar_event_id);
    const patch = updateByEventId.get(eventId) ?? {};
    const status = patch.status ?? row.status ?? "pending";
    if (status !== "pending") continue;
    const attempts = patch.attempt_count ?? Number(row.attempt_count) ?? 0;
    const limit = Number(row.max_attempts) || maxAttempts;
    if (attempts >= limit) continue;
    candidates.push({
      calendar_event_id: eventId,
      project_id: row.project_id ?? null,
      title: row.title,
      meeting_start_at: row.meeting_start_at,
      attempt_count: attempts,
      max_attempts: limit,
      reason: "backfill_ledger_pending",
    });
  }

  // 試行の少ないものを先に、その中では新しい会議を先に。
  // 元データ (ノーション、メール、ドライブ) は古くなるほど失われるため。
  candidates.sort((a, b) => (
    a.attempt_count - b.attempt_count
    || String(b.meeting_start_at).localeCompare(String(a.meeting_start_at))
  ));
  const emits = candidates.slice(0, emitLimit);

  return {
    inserts,
    updates,
    emits,
    stats: {
      missing_scheduled: missingScheduled.length,
      ledger_rows: ledgerRows.length,
      inserted: inserts.length,
      recovered: updates.filter((u) => u.status === "recovered").length,
      attempted: updates.filter((u) => u.last_outcome === "still_missing_after_attempt").length,
      abandoned: updates.filter((u) => u.status === "abandoned").length,
      pending_total: candidates.length,
      emitted: emits.length,
    },
  };
}

/** 台帳の読み書き。gate と check の両方から使う。 */
export async function readLedgerRows(db, { statuses } = {}) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = db.from("meeting_minutes_backfill_ledger").select("*").range(from, from + pageSize - 1);
    if (statuses?.length) query = query.in("status", statuses);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export async function applyLedgerPlan(db, plan, { now }) {
  if (plan.inserts.length) {
    const { error } = await db.from("meeting_minutes_backfill_ledger").upsert(plan.inserts, { onConflict: "calendar_event_id" });
    if (error) throw error;
  }
  for (const update of plan.updates) {
    const { calendar_event_id: eventId, ...patch } = update;
    const { error } = await db.from("meeting_minutes_backfill_ledger").update(patch).eq("calendar_event_id", eventId);
    if (error) throw error;
  }
  if (plan.emits.length) {
    const { error } = await db
      .from("meeting_minutes_backfill_ledger")
      .update({ last_emitted_at: now.toISOString() })
      .in("calendar_event_id", plan.emits.map((e) => e.calendar_event_id));
    if (error) throw error;
  }
}
