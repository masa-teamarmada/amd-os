/**
 * 事業計画タブ（フェーズマトリクス）のデータの形と読み直し（純関数）。
 *
 * - 全PJで同じ「フェーズマトリクス」を描く。区画・レーン・XRLの並びは src/lib/project-formats.ts の
 *   BUSINESS_PLAN_FORMAT（鍵付き）が正本で、ここは中身の形だけを持つ。
 * - 中身は project_business_plans（migration 464）。PJごとにコードへ書かない
 *   （2026-10-03 まさ「全部統一してないとだめ。OSの大原則」、spec 3-23）。
 * - DB の JSON は人が直すこともあるので、読むときに形を確かめ、壊れた値は捨てるか空にする。
 */

import { BUSINESS_PLAN_FORMAT } from "./project-formats.ts";

export type BusinessPlanLaneKey = (typeof BUSINESS_PLAN_FORMAT.lanes)[number]["key"];
export type XrlKey = (typeof BUSINESS_PLAN_FORMAT.xrl)[number]["key"];
export type XrlTarget = Record<XrlKey, number | null>;

export interface BusinessPlanLanePlan {
  /** このレーンの費用（円）。未確定は null（画面は「再精査中」）。 */
  costYen: number | null;
  activities: string[];
  /** 次のフェーズへの出口条件。 */
  exitGate: string;
  /** このレーンの到達を測るXRL。 */
  xrlKeys: XrlKey[];
}

export interface BusinessPlanPhase {
  id: string;
  label: string;
  /** 期間の表記（例: 2026.07–2027.03）。 */
  period: string;
  openingRound: string;
  /** フェーズ予算（円）。未確定は null。 */
  budgetYen: number | null;
  /** バーンの呼び名。無ければ「固定費バーン上限」。 */
  burnLabel: string | null;
  fundingSource: string;
  /** 月あたりのバーン（円）。未確定は null。 */
  maxFixedBurnMonthlyYen: number | null;
  targetXrl: XrlTarget;
  lanes: Record<BusinessPlanLaneKey, BusinessPlanLanePlan>;
}

export interface ProjectBusinessPlan {
  projectId: string;
  /** フェーズマトリクスの上に出す一文（改定日・再精査中の範囲など）。 */
  matrixNote: string | null;
  /** 出典（どの資料の何版から入れたか）。 */
  sourceNote: string | null;
  phases: BusinessPlanPhase[];
  updatedAt: string | null;
}

export const BUSINESS_PLAN_LANE_KEYS: readonly BusinessPlanLaneKey[] = BUSINESS_PLAN_FORMAT.lanes.map((lane) => lane.key);
export const XRL_KEYS: readonly XrlKey[] = BUSINESS_PLAN_FORMAT.xrl.map((entry) => entry.key);

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isXrlKey(value: unknown): value is XrlKey {
  return typeof value === "string" && (XRL_KEYS as readonly string[]).includes(value);
}

function normalizeLane(raw: unknown): BusinessPlanLanePlan {
  const lane = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    costYen: numberOrNull(lane.costYen),
    activities: Array.isArray(lane.activities) ? lane.activities.map(text).filter(Boolean) : [],
    exitGate: text(lane.exitGate),
    xrlKeys: Array.isArray(lane.xrlKeys) ? lane.xrlKeys.filter(isXrlKey) : [],
  };
}

/** DB の phases_json を画面の形へ。id と見出しの無いフェーズは捨てる。レーンとXRLはフォーマットの全キーを必ず持たせる。 */
export function normalizeBusinessPlanPhases(raw: unknown): BusinessPlanPhase[] {
  if (!Array.isArray(raw)) return [];
  const phases: BusinessPlanPhase[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const phase = entry as Record<string, unknown>;
    const id = text(phase.id);
    const label = text(phase.label);
    if (!id || !label) continue;
    const xrl = (phase.targetXrl && typeof phase.targetXrl === "object" ? phase.targetXrl : {}) as Record<string, unknown>;
    const lanes = (phase.lanes && typeof phase.lanes === "object" ? phase.lanes : {}) as Record<string, unknown>;
    phases.push({
      id,
      label,
      period: text(phase.period),
      openingRound: text(phase.openingRound),
      budgetYen: numberOrNull(phase.budgetYen),
      burnLabel: text(phase.burnLabel) || null,
      fundingSource: text(phase.fundingSource),
      maxFixedBurnMonthlyYen: numberOrNull(phase.maxFixedBurnMonthlyYen),
      targetXrl: Object.fromEntries(XRL_KEYS.map((key) => [key, numberOrNull(xrl[key])])) as XrlTarget,
      lanes: Object.fromEntries(BUSINESS_PLAN_LANE_KEYS.map((key) => [key, normalizeLane(lanes[key])])) as Record<BusinessPlanLaneKey, BusinessPlanLanePlan>,
    });
  }
  return phases;
}

/** 円を「◯億円」「◯万円」で読む。未確定は「再精査中」。 */
export function formatPlanYen(yen: number | null): string {
  if (yen === null) return "再精査中";
  if (Math.abs(yen) >= 100_000_000) {
    const value = yen / 100_000_000;
    return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}億円`;
  }
  return `${Math.round(yen / 10_000).toLocaleString("ja-JP")}万円`;
}
