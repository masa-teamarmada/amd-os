// コスト試算タブの「試算中の変更」。純関数だけを置く (React も DB も持たない)。
//
// 画面で数字を書き換えても保存しない (まさ 2026-09-13「前提条件やまだ確定できない数値はすべてUI上で変えられるようにして」)。
// 保存値 (DB から読んだ束) はそのまま持ち、書き換えは下書きとして別に持つ。計算は「保存値 + 下書き」で行い、
// 結果には保存値からの差を出す。admin が「この値を保存」を押したときだけ、下書きを API の patch に変えて正本へ書く。
// 入力欄の数字の3桁カンマ (打っている最中の整形とカーソル位置) もここに置く。

// 契約チェック (node で直接読む) からも使うので、相対パスで拡張子つきで読む。
import {
  CO2_FLUE_GAS_CHOICES,
  ITEM_BEARER_SHORT_LABEL,
  TANK_BEARER_LABEL,
  TASK_DRIVER_LABEL,
  TASK_PERFORMER_SHORT_LABEL,
  costItemLabel,
  driverUsesCount,
  type CostItemBearer,
  type CostModelBundle,
  type CostTankBearer,
  type CostTaskDriver,
  type CostTaskPerformer,
} from "./project-cost-model.ts";

export type DraftEntity = "assumption" | "item" | "task" | "model";
export type DraftAssumptionField = "value" | "valueText";
export type DraftItemField = "unitPrice" | "quantity" | "usefulLifeYears" | "bearer";
export type DraftTaskField = "hoursPerOccurrence" | "countDriver" | "countPerYear" | "expensePerOccurrence" | "performer";
export type DraftField = DraftAssumptionField | DraftItemField | DraftTaskField | "targetTotalCostPerUnit";
export type DraftValue = number | string | null;

/** key = `${entity}:${id}:${field}` */
export type CostDraft = Record<string, DraftValue>;

export interface DraftPatch {
  entity: DraftEntity;
  id: string;
  patch: Record<string, number | string | null>;
}

export interface DraftChange {
  key: string;
  entity: DraftEntity;
  id: string;
  field: DraftField;
  /** 何の数字か (前提名・作業名・明細名)。 */
  label: string;
  /** どの欄か (単価・1回の工数 など)。前提は空。 */
  fieldLabel: string;
  unit: string;
  before: DraftValue;
  after: DraftValue;
}

const COLUMN: Record<DraftEntity, Partial<Record<DraftField, string>>> = {
  assumption: { value: "value", valueText: "value_text" },
  item: { unitPrice: "unit_price", quantity: "quantity", usefulLifeYears: "useful_life_years", bearer: "bearer" },
  task: {
    hoursPerOccurrence: "hours_per_occurrence",
    countDriver: "count_driver",
    countPerYear: "count_per_year",
    expensePerOccurrence: "expense_per_occurrence",
    performer: "performer",
  },
  model: { targetTotalCostPerUnit: "target_total_cost_per_m3" },
};

const FIELD_LABEL: Record<DraftField, string> = {
  value: "",
  valueText: "",
  unitPrice: "単価",
  quantity: "数量",
  usefulLifeYears: "耐用年数",
  bearer: "誰が持つか",
  hoursPerOccurrence: "1回の工数",
  countDriver: "年間回数の決め方",
  countPerYear: "年間回数",
  expensePerOccurrence: "1回の経費",
  performer: "誰がやるか",
  targetTotalCostPerUnit: "",
};

/** 空欄に戻せる欄。 */
const NULLABLE: Record<DraftEntity, Set<DraftField>> = {
  assumption: new Set(["value"]),
  item: new Set(["usefulLifeYears"]),
  task: new Set(["hoursPerOccurrence", "countPerYear"]),
  model: new Set(["targetTotalCostPerUnit"]),
};

export function draftKey(entity: DraftEntity, id: string, field: DraftField): string {
  return `${entity}:${id}:${field}`;
}

function parseKey(key: string): { entity: DraftEntity; id: string; field: DraftField } {
  const first = key.indexOf(":");
  const last = key.lastIndexOf(":");
  return { entity: key.slice(0, first) as DraftEntity, id: key.slice(first + 1, last), field: key.slice(last + 1) as DraftField };
}

export function isNullableField(entity: DraftEntity, field: DraftField): boolean {
  return NULLABLE[entity].has(field);
}

/** 保存値。見つからなければ undefined。 */
export function baselineValue(bundle: CostModelBundle, entity: DraftEntity, id: string, field: DraftField): DraftValue | undefined {
  if (entity === "assumption") {
    const a = bundle.assumptions.find((x) => x.costAssumptionId === id);
    return a ? (a[field as DraftAssumptionField] as DraftValue) : undefined;
  }
  if (entity === "item") {
    const item = bundle.items.find((i) => i.costItemId === id);
    return item ? (item[field as DraftItemField] as DraftValue) : undefined;
  }
  if (entity === "task") {
    const task = (bundle.tasks ?? []).find((t) => t.costTaskId === id);
    return task ? (task[field as DraftTaskField] as DraftValue) : undefined;
  }
  return bundle.model.costModelId === id ? bundle.model.targetTotalCostPerUnit : undefined;
}

/** 値として受け付けるか。数字は有限で、前提の値以外は0以上。空欄は空欄に戻せる欄だけ。 */
export function isValidDraftValue(entity: DraftEntity, field: DraftField, value: DraftValue): boolean {
  if (field === "countDriver") return typeof value === "string" && value in TASK_DRIVER_LABEL;
  if (field === "performer") return typeof value === "string" && value in TASK_PERFORMER_SHORT_LABEL;
  if (field === "bearer") return typeof value === "string" && value in ITEM_BEARER_SHORT_LABEL;
  if (field === "valueText") return typeof value === "string" && value.trim() !== "";
  if (value === null) return isNullableField(entity, field);
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  return entity === "assumption" ? true : value >= 0;
}

/** 下書きに1つ書き込む。保存値と同じに戻したら下書きから消す。 */
export function setDraftValue(
  draft: CostDraft,
  bundle: CostModelBundle,
  entity: DraftEntity,
  id: string,
  field: DraftField,
  value: DraftValue
): CostDraft {
  const key = draftKey(entity, id, field);
  const next = { ...draft };
  const base = baselineValue(bundle, entity, id, field);
  if (base === undefined || !isValidDraftValue(entity, field, value)) return draft;
  if (base === value) delete next[key];
  else next[key] = value;
  return next;
}

/** 保存値に下書きを重ねた束。計算と表示はこれで行う。 */
export function applyDraft(bundle: CostModelBundle, draft: CostDraft): CostModelBundle {
  const keys = Object.keys(draft);
  if (keys.length === 0) return bundle;
  const by = (entity: DraftEntity) => {
    const m = new Map<string, Record<string, DraftValue>>();
    for (const key of keys) {
      const k = parseKey(key);
      if (k.entity !== entity) continue;
      const cur = m.get(k.id) ?? {};
      cur[k.field] = draft[key];
      m.set(k.id, cur);
    }
    return m;
  };
  const a = by("assumption");
  const i = by("item");
  const t = by("task");
  const m = by("model");
  const modelPatch = m.get(bundle.model.costModelId);
  return {
    ...bundle,
    model: modelPatch ? { ...bundle.model, ...(modelPatch as object) } : bundle.model,
    assumptions: a.size === 0 ? bundle.assumptions : bundle.assumptions.map((x) => (a.has(x.costAssumptionId) ? { ...x, ...(a.get(x.costAssumptionId) as object) } : x)),
    items: i.size === 0 ? bundle.items : bundle.items.map((x) => (i.has(x.costItemId) ? { ...x, ...(i.get(x.costItemId) as object) } : x)),
    tasks: t.size === 0 ? bundle.tasks : (bundle.tasks ?? []).map((x) => (t.has(x.costTaskId) ? { ...x, ...(t.get(x.costTaskId) as object) } : x)),
  };
}

function unitOf(bundle: CostModelBundle, entity: DraftEntity, id: string, field: DraftField): string {
  const unit = bundle.model.unitBasisLabel || "m³";
  if (entity === "assumption") return field === "valueText" ? "" : bundle.assumptions.find((a) => a.costAssumptionId === id)?.unit ?? "";
  if (entity === "model") return `円/${unit}`;
  if (entity === "item") {
    const item = bundle.items.find((x) => x.costItemId === id);
    if (field === "unitPrice") return item?.unitPriceUnit ?? "円";
    if (field === "quantity") return item?.quantityUnit ?? "";
    return "年";
  }
  if (field === "hoursPerOccurrence") return "時間";
  if (field === "countPerYear") return "回/年";
  if (field === "expensePerOccurrence") return "円";
  return "";
}

function labelOf(bundle: CostModelBundle, entity: DraftEntity, id: string): string {
  if (entity === "assumption") return bundle.assumptions.find((a) => a.costAssumptionId === id)?.label ?? id;
  if (entity === "item") {
    const item = bundle.items.find((x) => x.costItemId === id);
    return item ? costItemLabel(item) : id;
  }
  if (entity === "task") return (bundle.tasks ?? []).find((x) => x.costTaskId === id)?.label ?? id;
  return "総コスト目標";
}

/** 下書きの一覧 (保存値と違うものだけ)。並びは 前提 → 作業 → 明細 → 目標。 */
export function listDraftChanges(bundle: CostModelBundle, draft: CostDraft): DraftChange[] {
  const order: Record<DraftEntity, number> = { assumption: 0, task: 1, item: 2, model: 3 };
  const changes: DraftChange[] = [];
  for (const key of Object.keys(draft)) {
    const { entity, id, field } = parseKey(key);
    const before = baselineValue(bundle, entity, id, field);
    if (before === undefined || before === draft[key]) continue;
    changes.push({
      key,
      entity,
      id,
      field,
      label: labelOf(bundle, entity, id),
      fieldLabel: FIELD_LABEL[field],
      unit: unitOf(bundle, entity, id, field),
      before,
      after: draft[key],
    });
  }
  return changes.sort((x, y) => order[x.entity] - order[y.entity] || x.label.localeCompare(y.label, "ja"));
}

/**
 * 数字の整数部に3桁ごとのカンマを入れる (まさ 2026-09-14「桁の大きい数字は必ず３桁ごとにカンマ入れて」)。
 * 打ちかけの「1.」「-」「0.50」はそのまま残す。数字として読めない文字列は触らない。
 */
export function groupDigits(raw: string): string {
  const m = /^(-?)(\d*)(\.\d*)?$/.exec(raw.replace(/,/g, ""));
  if (!m) return raw;
  const [, sign, intPart, frac = ""] = m;
  return `${sign}${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${frac}`;
}

/** 数字と「円」の間で折り返さないための見えない語結合子 (U+2060)。 */
export const YEN_JOINER = "\u2060";

/**
 * 金額はカンマ区切りの円で出す。億・万に丸めない (まさ 2026-09-14「カンマ区切りにそろえて」)。
 * 1円未満は四捨五入。数字と「円」の間に YEN_JOINER を挟み、行の折り返しで「円」だけが次の行へ落ちないようにする。
 */
export function formatYen(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${groupDigits(String(Math.round(value)))}${YEN_JOINER}円`;
}

const FULL_WIDTH_SIGN: Record<string, string> = { "．": ".", "，": ",", "－": "-" };
/** 全角の数字・小数点・カンマ・マイナスを半角にする。文字数は変わらない。 */
export const toHalfWidth = (raw: string) =>
  raw.replace(/[０-９．，－]/g, (c) => FULL_WIDTH_SIGN[c] ?? String.fromCharCode(c.charCodeAt(0) - 0xfee0));

/** カンマを入れ直したあとのカーソル位置。カーソルより左にあった数字の数を保つ。 */
export function caretAfterGrouping(before: string, caret: number, after: string): number {
  const keep = before.slice(0, caret).replace(/,/g, "").length;
  if (keep === 0) return 0;
  let seen = 0;
  for (let i = 0; i < after.length; i++) {
    if (after[i] !== ",") seen++;
    if (seen === keep) return i + 1;
  }
  return after.length;
}

/** 年間回数の決め方を表示用の文字にする。 */
export function formatDraftValue(field: DraftField, value: DraftValue): string {
  if (value === null) return "空欄";
  if (field === "countDriver") return TASK_DRIVER_LABEL[value as CostTaskDriver] ?? String(value);
  if (field === "performer") return TASK_PERFORMER_SHORT_LABEL[value as CostTaskPerformer] ?? String(value);
  if (field === "bearer") return ITEM_BEARER_SHORT_LABEL[value as CostItemBearer] ?? String(value);
  if (field === "valueText") return TANK_BEARER_LABEL[value as CostTankBearer] ?? CO2_FLUE_GAS_CHOICES.find((c) => c.value === value)?.label ?? String(value);
  if (typeof value === "number") return value.toLocaleString("ja-JP", { maximumFractionDigits: 6 });
  return String(value);
}

/**
 * 下書きを API の patch に変える。keys を渡すとその分だけ。
 * 同じ行の欄は1本の patch にまとめる。作業を「固定の回数」に変えるときは年間回数も一緒に送る (DB の制約を満たすため)。
 */
export function draftToPatches(bundle: CostModelBundle, draft: CostDraft, keys?: string[]): DraftPatch[] {
  const target = new Set(keys ?? Object.keys(draft));
  const merged = new Map<string, DraftPatch>();
  const applied = applyDraft(bundle, draft);
  for (const key of Object.keys(draft)) {
    if (!target.has(key)) continue;
    const { entity, id, field } = parseKey(key);
    const column = COLUMN[entity][field];
    if (!column) continue;
    const mapKey = `${entity}:${id}`;
    const p = merged.get(mapKey) ?? { entity, id, patch: {} };
    p.patch[column] = draft[key];
    // 回数を行に入れる決め方 (固定の回数・培養設備の系列ごと) へ変えるときは、DB の制約を満たすため年間回数も送る。
    if (entity === "task" && field === "countDriver" && driverUsesCount(draft[key] as CostTaskDriver)) {
      const task = (applied.tasks ?? []).find((t) => t.costTaskId === id);
      if (task) p.patch.count_per_year = task.countPerYear ?? 0;
    }
    merged.set(mapKey, p);
  }
  return [...merged.values()];
}

/** 保存し終えた下書きを消す。 */
export function dropDraftKeys(draft: CostDraft, keys: string[]): CostDraft {
  const next = { ...draft };
  for (const k of keys) delete next[k];
  return next;
}

/** 読み直した保存値と同じになった下書き、行が消えた下書きを落とす。 */
export function pruneDraft(bundle: CostModelBundle, draft: CostDraft): CostDraft {
  const next: CostDraft = {};
  for (const [key, value] of Object.entries(draft)) {
    const { entity, id, field } = parseKey(key);
    const base = baselineValue(bundle, entity, id, field);
    if (base !== undefined && base !== value) next[key] = value;
  }
  return next;
}
