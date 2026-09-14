// コスト試算（廃液・燃料）の明細1行の計算を、画面に式として出すための形。
// まさ 2026-09-14「そもそも「数量」「単価」って何？単価の単位は/kg-DCWになっていて、これに数量をかけると右の「円/L」になる？ならないよね？」
// 数量 × 単価 は、行の「〜あたり」（1系列の1年・菌体1kg・燃料1L など）の額。右端の額にするには、1系列が1年に作る菌体の量や
// 燃料1Lに要る菌体の量を掛け割りする。その掛け算を行ごとに式で出す。
// 式の数はエンジンと同じ値から取り、契約チェック（check_project_fuel_cost_model.mts）で「式を計算した答え ＝ 右端の額」を確かめる。

export type CalcOp = "×" | "÷";

export interface CalcTerm {
  /** 前の値に掛けるか割るか。前の段から続かない段の先頭の項は null。 */
  op: CalcOp | null;
  value: number;
  unit: string;
  /** 数の名前。数量と単価は入力欄と同じ数なので付けない。 */
  label?: string;
}

export interface CalcSegment {
  /** true なら前の段の答えから始める（先頭の項にも op が付く）。 */
  continues: boolean;
  terms: CalcTerm[];
  result: { value: number; unit: string; label?: string };
}

export interface ItemCalc {
  /** 単価を前提から計算する行の、単価の出し方。単価をそのまま使う行は null。 */
  price: CalcSegment | null;
  segments: CalcSegment[];
  /** 右端の額に入らない理由（菌体の原価を上書きしているときなど）。入るときは null。 */
  excluded: string | null;
}

/** 0 で割ると 0（エンジンの割り算と同じ）。 */
function divide(a: number, b: number): number {
  return b === 0 || !Number.isFinite(b) ? 0 : a / b;
}

export function evaluateCalcSegment(segment: CalcSegment, previous: number | null): number {
  let value = segment.continues ? (previous ?? 0) : 0;
  segment.terms.forEach((term, index) => {
    if (index === 0 && !segment.continues) {
      value = term.value;
      return;
    }
    value = term.op === "÷" ? divide(value, term.value) : value * term.value;
  });
  return value;
}

/** 式の最後の答え。各段は前の段の答えから続く。 */
export function evaluateItemCalc(calc: ItemCalc): number {
  let previous: number | null = null;
  for (const segment of calc.segments) previous = evaluateCalcSegment(segment, previous);
  return previous ?? 0;
}

/** 数量の単位。空欄の行は単価の単位の「円/」の後ろ（円/式 → 式）を使う。 */
export function quantityUnitOf(item: { quantityUnit: string | null; unitPriceUnit: string | null }): string {
  if (item.quantityUnit && item.quantityUnit.trim() !== "") return item.quantityUnit;
  const m = /^円\/(.+)$/.exec(item.unitPriceUnit ?? "");
  return m ? m[1] : "";
}

/** 式の先頭: 数量 × 単価（× 年の回数）。 */
export function quantityPriceTerms(
  item: { quantity: number; quantityUnit: string | null; unitPrice: number; unitPriceUnit: string | null; annualFactor: number },
  unitPrice: number = item.unitPrice,
  priceLabel?: string
): CalcTerm[] {
  const terms: CalcTerm[] = [
    { op: null, value: item.quantity, unit: quantityUnitOf(item) },
    { op: "×", value: unitPrice, unit: item.unitPriceUnit ?? "円", ...(priceLabel ? { label: priceLabel } : {}) },
  ];
  if (item.annualFactor !== 1) terms.push({ op: "×", value: item.annualFactor, unit: "回", label: "年の回数" });
  return terms;
}
