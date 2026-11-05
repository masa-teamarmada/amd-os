import type { SupabaseClient } from "@supabase/supabase-js";
import catalog from "./change-history-catalog.json" with { type: "json" };
import { displayFieldValue, historyContext, isOpaqueValue, type ChangeHistoryRow } from "./change-history-presentation";

type Entity = { label: string; key: string[]; context: string[]; references: Record<string, { table: string; key: string }> };
const ENTITIES: Record<string, Entity> = catalog.tables;
type RecordValue = Record<string, unknown>;
const NAME_FIELDS = ["title", "name", "display_name", "member_name", "project_name", "task_name", "item_title", "title_snapshot", "short_name", "code_name", "label", "vendor_name", "partner_name", "researcher_name", "venture_name", "organization_name", "person_name", "subject", "username", "seed_no", "notice_no"];
const CHUNK_SIZE = 100;

function chunks<T>(items: T[]) {
  return Array.from({ length: Math.ceil(items.length / CHUNK_SIZE) }, (_, i) => items.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
}

const INDEX_KEYS = new Map<string, string[][]>();
for (const [table, entity] of Object.entries(ENTITIES)) INDEX_KEYS.set(table, entity.key.length ? [entity.key] : []);
for (const entity of Object.values(ENTITIES)) for (const ref of Object.values(entity.references)) {
  const keys = INDEX_KEYS.get(ref.table) ?? [];
  if (!keys.some((fields) => fields.length === 1 && fields[0] === ref.key)) keys.push([ref.key]);
  INDEX_KEYS.set(ref.table, keys);
}
INDEX_KEYS.get("members")?.push(["member_id"]);
function keysFor(table: string, row: RecordValue) {
  return INDEX_KEYS.get(table)?.find((keys) => keys.length && keys.every((key) => row[key] != null));
}
function keyFor(table: string, row: RecordValue, keys = keysFor(table, row)) {
  return keys ? `${table}:${JSON.stringify(keys.map((key) => [key, row[key]]))}` : null;
}

function nameFor(value: RecordValue) {
  for (const key of NAME_FIELDS) {
    const v = value[key];
    if (typeof v === "string" && v.trim() && !isOpaqueValue(v)) return v.trim();
  }
  return null;
}

/** 対象の名称だけを解決する。差分値や、戻す操作の入力は変更しない。 */
export async function enrichChangeHistory(db: SupabaseClient, rows: ChangeHistoryRow[]) {
  const records = new Map<string, RecordValue>();
  const lookups = new Map<string, RecordValue>();
  const attempted = new Set<string>();
  const enqueue = (table: string, value: RecordValue) => {
    const key = keyFor(table, value);
    if (key && !attempted.has(key)) lookups.set(key, { ...value, __table: table });
  };
  const refsFor = (table: string, value: RecordValue) => {
    for (const [field, ref] of Object.entries(ENTITIES[table]?.references ?? {})) {
      if (value[field] != null && ENTITIES[ref.table]) {
        enqueue(ref.table, { [ref.key]: value[field] });
      }
    }
    // 一部の旧台帳には外部キー制約が無い。
    if (value.project_id) enqueue("projects", { project_id: value.project_id });
    if (value.member_id) enqueue("members", { member_id: value.member_id });
    if (value.server_boss_id) enqueue("server_bosses", { id: value.server_boss_id });
    if (value.game_server_id) enqueue("game_servers", { id: value.game_server_id });
    if (value.boss_id) enqueue("boss_catalog", { id: value.boss_id });
  };
  for (const row of rows) {
    enqueue(row.table_name, row.record_pk);
    for (const value of [row.record_pk, historyContext(row), row.before_values, row.after_values]) refsFor(row.table_name, value);
  }
  // 対象 → 親 → 親の名称をまとめて読む。1000行を1行ずつ問い合わせない。
  for (let depth = 0; depth < 3 && lookups.size; depth++) {
    const byTable = new Map<string, { table: string; keys: string[]; wanted: RecordValue[] }>();
    for (const [key, value] of lookups) {
      attempted.add(key);
      const table = String(value.__table);
      const keys = keysFor(table, value)!;
      const groupKey = `${table}:${keys.join(",")}`;
      const group = byTable.get(groupKey) ?? { table, keys, wanted: [] };
      group.wanted.push(value);
      byTable.set(groupKey, group);
    }
    lookups.clear();
    const jobs = [...byTable.values()].flatMap(({ table, keys, wanted }) => chunks(wanted).map((part) => ({ table, keys, part })));
    for (let offset = 0; offset < jobs.length; offset += 8) {
      await Promise.all(jobs.slice(offset, offset + 8).map(async ({ table, keys, part }) => {
        const entity = ENTITIES[table];
        if (!entity?.key.length || !entity.context.length) return;
        let query = db.from(table).select(entity.context.join(","));
        for (const key of keys) query = query.in(key, [...new Set(part.map((v) => v[key]))]);
        const { data, error } = await query.limit(1000);
        if (error) {
          console.error("[change-history] target names unavailable:", table);
          return;
        }
        for (const record of (data ?? []) as unknown as RecordValue[]) {
          for (const indexKeys of INDEX_KEYS.get(table) ?? []) {
            if (indexKeys.every((key) => record[key] != null)) records.set(keyFor(table, record, indexKeys)!, record);
          }
          refsFor(table, record);
        }
      }));
    }
  }

  const find = (table: string, value: RecordValue) => records.get(keyFor(table, value) ?? "");
  const reference = (table: string, value: RecordValue, field: string) => {
    const ref = ENTITIES[table]?.references[field];
    if (ref) return { table: ref.table, value: find(ref.table, { [ref.key]: value[field] }) };
    const legacy: Record<string, [string, string]> = {
      project_id: ["projects", "project_id"], member_id: ["members", "member_id"],
      server_boss_id: ["server_bosses", "id"], game_server_id: ["game_servers", "id"], boss_id: ["boss_catalog", "id"],
    };
    const target = legacy[field];
    return target ? { table: target[0], value: find(target[0], { [target[1]]: value[field] }) } : null;
  };
  const describe = (table: string, value: RecordValue, depth = 0): string | null => {
    const direct = nameFor(value);
    if (direct) return direct;
    const parts: string[] = [];
    if (depth < 2) {
      for (const field of ["game_server_id", "server_boss_id", "boss_id", "member_id", "project_id", "document_id", "milestone_id", "seed_id", "institution_id"]) {
        if (value[field] == null) continue;
        const ref = reference(table, value, field);
        const label = ref?.value ? describe(ref.table, ref.value, depth + 1) : null;
        if (label && !parts.some((part) => part === label || part.includes(label))) parts.push(label);
      }
    }
    for (const field of ["killed_at", "scheduled_for", "spawn_at", "week_start", "ym"]) {
      if (value[field] != null) parts.push(displayFieldValue(field, value[field]));
    }
    if (value.lead_minutes != null) parts.push(`出現${value.lead_minutes}分前`);
    return parts.length ? parts.join(" / ") : null;
  };

  const actorIds = [...new Set(rows.map((row) => row.actor_id).filter((v): v is string => Boolean(v)))];
  const pinNames = new Map<string, string>();
  for (const part of chunks(actorIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))) {
    const { data } = await db.from("l2m_boss_pin_accounts").select("user_id,username").in("user_id", part);
    for (const actor of data ?? []) if (actor.username) pinNames.set(actor.user_id, actor.username);
  }
  const memberActorIds = actorIds.filter((id) => !isOpaqueValue(id));
  const memberNames = new Map<string, string>();
  for (const part of chunks(memberActorIds)) {
    const { data } = await db.from("members").select("member_id,member_name,code_name").in("member_id", part);
    for (const member of data ?? []) memberNames.set(member.member_id, member.member_name || member.code_name || "氏名未登録");
  }

  return rows.map((row) => {
    const recorded = historyContext(row);
    const snapshot = row.operation === "delete" ? row.before_values : row.after_values;
    const current = find(row.table_name, row.record_pk);
    const recordedName = nameFor(recorded) || nameFor(snapshot);
    const entityLabel = recordedName || (current ? describe(row.table_name, current) : describe(row.table_name, { ...recorded, ...snapshot, ...row.record_pk }));
    const value = { ...current, ...recorded, ...snapshot, ...row.record_pk };
    const project = value.project_id ? find("projects", { project_id: value.project_id }) : null;
    const referenceLabels: Record<string, string> = {};
    for (const side of [row.before_values, row.after_values]) {
      for (const [field, id] of Object.entries(side)) {
        if (id == null || typeof id === "object") continue;
        const ref = reference(row.table_name, side, field);
        const label = ref?.value ? describe(ref.table, ref.value) : null;
        if (label) referenceLabels[`${field}:${String(id)}`] = `${ENTITIES[ref!.table].label}「${label}」`;
      }
    }
    return {
      ...row,
      actor_display_label: pinNames.get(row.actor_id ?? "") || memberNames.get(row.actor_id ?? "") || undefined,
      entity_label: entityLabel,
      entity_label_source: recordedName ? "recorded" as const : current ? "current" as const : "unavailable" as const,
      project_label: project ? `${value.project_id} ${nameFor(project) ?? ""}`.trim() : null,
      reference_labels: referenceLabels,
    };
  });
}
