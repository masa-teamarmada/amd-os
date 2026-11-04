/** 左右の軸は別の縮尺を保ち、ゼロを常に同じ高さへ置く。 */
export function symmetricCashAxis(values: Array<number | null | undefined>) {
  const largest = Math.max(1, ...values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)).map(Math.abs));
  const unit = 10 ** Math.floor(Math.log10(largest));
  const limit = Math.ceil(largest * 1.1 / unit) * unit;
  return { min: -limit, max: limit };
}

export function cashExpenseParts(row: {cashOutflow: number; memberCashPayment?: number; operatingCashPayment?: number; socialInsuranceCashPayment?: number; loanPayment: number; ctaxPayment: number; corpTaxPayment: number; obligationDetails?: Array<{category:string; cashflowTreatment:string; amountYen:number|null}>}) {
  const additionalTax = (row.obligationDetails ?? []).filter((item) => item.category === "tax" && item.cashflowTreatment === "additive").reduce((sum,item) => sum + (item.amountYen ?? 0),0);
  const known = [row.memberCashPayment ?? 0, row.operatingCashPayment ?? 0, row.socialInsuranceCashPayment ?? 0, row.loanPayment, Math.max(0,row.ctaxPayment) + Math.max(0,row.corpTaxPayment) + additionalTax].map((value) => Math.max(0, value));
  const total = known.reduce((a,b) => a+b,0);
  // 過去の支払月調整で内訳と総額が逆転する行は、内訳を捏造せず支払総額だけを示す。
  if (total > row.cashOutflow) return [0,0,0,0,0,row.cashOutflow];
  return [...known, Math.max(0,row.cashOutflow-total)];
}
