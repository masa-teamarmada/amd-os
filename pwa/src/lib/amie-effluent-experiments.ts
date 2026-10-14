import type { TechEntry, TechTopic } from "./project-tech";

export const AMIE_EFFLUENT_KINDS = { actual: "実廃液", simulated: "模擬廃液", reference: "参考試料", unknown: "区分未確認" } as const;
export const AMIE_EFFLUENT_STATES = { completed: "実験完了", running: "試験中", received: "受領済み・結果未確認", not_received: "未受領", unknown: "状態未確認" } as const;
export type AmieEffluentKind = keyof typeof AMIE_EFFLUENT_KINDS;
export type AmieEffluentState = keyof typeof AMIE_EFFLUENT_STATES;
export type AmieEffluentGraph = { path: string; caption: string; source_ref: string };
export type AmieEffluentExperiment = {
  version: 1;
  type_key: string;
  kind: AmieEffluentKind;
  status: AmieEffluentState;
  identity_confirmed: boolean;
  provider: string;
  route: string;
  sampling_point: string;
  received_on: string;
  tested_on: string;
  components: string;
  before: string;
  after: string;
  conditions: string;
  follow_up: string;
  source_entry_ids: string[];
  source_sample_ids: string[];
  source_test_ids: string[];
  graphs: AmieEffluentGraph[];
};
export type AmieEffluentRow = { entry: TechEntry; experiment: AmieEffluentExperiment };
const textFields = ["provider", "route", "sampling_point", "received_on", "tested_on", "components", "before", "after", "conditions", "follow_up"] as const;
const referenceFields = ["source_entry_ids", "source_sample_ids", "source_test_ids"] as const;

/** 新しい種類の表はPJ番号ではなく、トピックの表示指定で選ぶ。 */
export function amieIsEffluentTopic(topic: Pick<TechTopic, "presentation">): boolean {
  return topic.presentation?.kind === "effluent_ledger" && topic.presentation?.version === 1;
}

export function amieReadEffluentExperiment(value: unknown): AmieEffluentExperiment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || typeof v.type_key !== "string" || !v.type_key.trim() || v.type_key.length > 160 ||
      typeof v.kind !== "string" || !Object.hasOwn(AMIE_EFFLUENT_KINDS, v.kind) ||
      typeof v.status !== "string" || !Object.hasOwn(AMIE_EFFLUENT_STATES, v.status) || typeof v.identity_confirmed !== "boolean") return null;
  if (textFields.some(k => v[k] !== undefined && (typeof v[k] !== "string" || (v[k] as string).length > 4000))) return null;
  if (["provider", "components", "before", "after"].some(k => typeof v[k] !== "string")) return null;
  if (referenceFields.some(k => v[k] !== undefined && (!Array.isArray(v[k]) || (v[k] as unknown[]).some(x => typeof x !== "string") || (v[k] as unknown[]).length > 100))) return null;
  const result = { version: 1, type_key: v.type_key.trim(), kind: v.kind, status: v.status, identity_confirmed: v.identity_confirmed } as AmieEffluentExperiment;
  for (const k of textFields) result[k] = typeof v[k] === "string" ? (v[k] as string).trim() : "";
  for (const k of referenceFields) result[k] = Array.isArray(v[k]) ? [...new Set(v[k] as string[])] : [];
  if (v.graphs !== undefined && (!Array.isArray(v.graphs) || v.graphs.length > 12)) return null;
  result.graphs = [];
  for (const graph of (v.graphs ?? []) as unknown[]) {
    if (!graph || typeof graph !== "object" || Array.isArray(graph)) return null;
    const g = graph as Record<string, unknown>;
    if (typeof g.path !== "string" || !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.(png|jpg|webp)$/.test(g.path) || typeof g.caption !== "string" || !g.caption.trim() || g.caption.length > 500 || typeof g.source_ref !== "string" || !g.source_ref.trim() || g.source_ref.length > 4000) return null;
    result.graphs.push({ path: g.path, caption: g.caption.trim(), source_ref: g.source_ref.trim() });
  }
  for (const k of ["received_on", "tested_on"] as const) {
    if (result[k] && (!/^\d{4}-\d{2}-\d{2}$/.test(result[k]) || Number.isNaN(Date.parse(result[k])) || new Date(result[k]).toISOString().slice(0, 10) !== result[k])) return null;
  }
  return result;
}

export function amieValidateEffluentEntry(row: Record<string, unknown>): AmieEffluentExperiment {
  const e = amieReadEffluentExperiment(row.experiment);
  if (!e) throw new Error("廃液の種類・区分・状態の登録形式が不正");
  if (!String(row.row_label ?? "").trim() || !e.provider) throw new Error("廃液名と入手元が必要");
  if (!String(row.source_ref ?? "").trim()) throw new Error("照合した出典が必要");
  if (e.status === "completed" && (!e.after || !String(row.value_text ?? "").trim())) throw new Error("実験完了には処理後の結果と結論が必要");
  if (e.status === "not_received" && e.received_on) throw new Error("受領日がある廃液を未受領にはできない");
  if (e.graphs.some(g => !g.path.startsWith(`${row.project_id}/${row.tech_entry_id}/`))) throw new Error("グラフと廃液の紐付けが不正");
  return e;
}

export function amieEffluentRows(entries: TechEntry[]): AmieEffluentRow[] {
  return entries.flatMap(entry => { const experiment = amieReadEffluentExperiment(entry.experiment); return experiment ? [{ entry, experiment }] : []; });
}

/** 試験回数・株の数ではなく種類を数える。結果だけで種類の同一性を推測しない。 */
export function amieEffluentSummary(rows: AmieEffluentRow[]) {
  const actual = rows.filter(r => r.experiment.kind === "actual");
  const groups = new Map<string, AmieEffluentRow[]>();
  for (const row of actual.filter(r => r.experiment.identity_confirmed)) {
    const group = groups.get(row.experiment.type_key) ?? [];
    group.push(row); groups.set(row.experiment.type_key, group);
  }
  const complete = (r: AmieEffluentRow) => r.experiment.status === "completed" && !!r.experiment.after && !!r.entry.value_text?.trim() && !!r.entry.source_ref?.trim();
  const completed = [...groups.values()].filter(g => g.some(complete));
  const running = [...groups.values()].filter(g => !g.some(complete) && g.some(r => r.experiment.status === "running"));
  const received = [...groups.values()].filter(g => !g.some(complete) && !g.some(r => r.experiment.status === "running") && g.some(r => r.experiment.status === "received"));
  return {
    completed: completed.length, running: running.length, received: received.length, actualTypes: groups.size,
    unresolved: new Set(actual.filter(r => !r.experiment.identity_confirmed).map(r => r.experiment.type_key)).size,
    completedUnresolved: actual.filter(r => !r.experiment.identity_confirmed && complete(r)).length,
    simulatedCompleted: new Set(rows.filter(r => r.experiment.kind === "simulated" && r.experiment.identity_confirmed && complete(r)).map(r => r.experiment.type_key)).size,
    rows: rows.length,
  };
}

export function amieEffluentReportedCount(topic: TechTopic): { minimum: number; reportedOn: string; source: string } | null {
  const v = topic.presentation?.reported_count;
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  return typeof r.minimum === "number" && Number.isSafeInteger(r.minimum) && r.minimum > 0 && typeof r.source === "string" && typeof r.reported_on === "string"
    ? { minimum: r.minimum, reportedOn: r.reported_on, source: r.source } : null;
}
