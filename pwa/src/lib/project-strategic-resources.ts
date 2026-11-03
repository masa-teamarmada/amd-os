/** PJの戦略余力試算。円は各評価時点の名目額。本文の登録版を3スペースで共有する。 */
export const STRATEGIC_RESOURCES_CONFIG_KEY = 'strategic_resources_v1';
export type ResourcePoint = {
  date: string; kind: string; cash: number; businessValue: number; total: number; probability: number;
  funding: number; spending: number; revenue: number; unwind: number; informationGain: number; costRelief: number;
  evidenceId?: string;
};
export type ResourceScenario = {strength: number; licenseYen: number; points: ResourcePoint[]};
export type ResourceEvidence = {id: string; date: string; name: string; condition: string; effect: string; likelihoodRatio: number};
export type StrategicResources = {
  version: 1; asOf: string; revision: string; title: string; scenario: string; discountRate: number;
  developmentAchievement: number; assumptions: string[]; sources: string[];
  cases: ResourceScenario[]; baseline: ResourceScenario[]; evidence: ResourceEvidence[];
};
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('試算の形式が不正');
  return value as Record<string, unknown>;
};
const number = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e15) throw Error('試算の数値が不正');
  return value;
};
const text = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 3000) throw Error('試算の文字列が不正');
  return value;
};
const date = (value: unknown) => {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result))) throw Error('試算の日付が不正');
  return result;
};
const array = (value: unknown, max = 600): unknown[] => {
  if (!Array.isArray(value) || value.length > max) throw Error('試算の一覧が不正');
  return value;
};
function scenario(value: unknown): ResourceScenario {
  const raw = object(value);
  const points = array(raw.points).map(value => {
    const row = object(value);
    const point: ResourcePoint = {date: date(row.date), kind: text(row.kind), cash: number(row.cash), businessValue: number(row.businessValue), total: number(row.total), probability: number(row.probability), funding: number(row.funding), spending: number(row.spending), revenue: number(row.revenue), unwind: number(row.unwind), informationGain: number(row.informationGain), costRelief: number(row.costRelief)};
    if (row.evidenceId !== undefined) point.evidenceId = text(row.evidenceId);
    if (Math.abs(point.cash + point.businessValue - point.total) > 1 || point.probability < 0 || point.probability > 1) throw Error('試算の内訳が不整合');
    return point;
  });
  if (!points.length || points.some((p, i) => i > 0 && p.date < points[i - 1].date)) throw Error('試算の時間軸が不正');
  return {strength: number(raw.strength), licenseYen: number(raw.licenseYen), points};
}
/** 明示した表示項目だけを通し、別の設定値や個人情報をレスポンスへ混ぜない。 */
export function parseStrategicResources(value: unknown): StrategicResources | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = object(typeof value === 'string' ? JSON.parse(value) : value);
  if (raw.version !== 1) throw Error('試算の版が未対応');
  const cases = array(raw.cases, 30).map(scenario), baseline = array(raw.baseline, 10).map(scenario);
  if (!cases.length || !baseline.length) throw Error('試算のケースが未登録');
  const licenses = [...new Set(cases.map(c => c.licenseYen))];
  const strengths = [...new Set(cases.map(c => c.strength))];
  const keys = cases.map(c => `${c.strength}:${c.licenseYen}`);
  if (!strengths.includes(1) || strengths.some(s => ![.5, 1, 1.5].includes(s)) || new Set(keys).size !== keys.length || licenses.some(v => v < 0)) throw Error('試算の比較条件が不正');
  if (strengths.some(s => licenses.some(v => !cases.some(c => c.strength === s && c.licenseYen === v))) || baseline.length !== licenses.length || licenses.some(v => !baseline.some(c => c.licenseYen === v && c.strength === baseline[0].strength))) throw Error('試算の比較条件が不足');
  const timeline = cases[0].points.map(p => p.date + ':' + p.kind).join('|');
  if (cases.some(c => c.points.map(p => p.date + ':' + p.kind).join('|') !== timeline)) throw Error('ケースの時間軸が不一致');
  const discountRate = number(raw.discountRate), developmentAchievement = number(raw.developmentAchievement);
  if (discountRate < 0 || discountRate > 1 || developmentAchievement < 0 || developmentAchievement > 1) throw Error('試算の率が不正');
  return {version: 1, asOf: date(raw.asOf), revision: text(raw.revision), title: text(raw.title), scenario: text(raw.scenario), discountRate, developmentAchievement, assumptions: array(raw.assumptions, 50).map(text), sources: array(raw.sources, 50).map(text), cases, baseline, evidence: array(raw.evidence, 100).map(value => {
    const e = object(value); return {id: text(e.id), date: date(e.date), name: text(e.name), condition: text(e.condition), effect: text(e.effect), likelihoodRatio: number(e.likelihoodRatio)};
  })};
}
/** 利用対価の中間ケースは2条件の金額内訳を平均する。確率と日付は共通。 */
export function strategicResourcePoints(cases: ResourceScenario[], strength: number, license: number | 'mid'): ResourcePoint[] {
  const matches = cases.filter(c => c.strength === strength && (license === 'mid' || c.licenseYen === license));
  if (!matches.length) throw Error('試算の条件が未登録');
  return matches[0].points.map((point, i) => {
    const result = {...point};
    for (const key of ['cash', 'businessValue', 'total', 'probability', 'funding', 'spending', 'revenue', 'unwind', 'informationGain', 'costRelief'] as const)
      result[key] = matches.reduce((sum, c) => sum + c.points[i][key], 0) / matches.length;
    return result;
  });
}
