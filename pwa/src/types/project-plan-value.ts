/**
 * 事業計画・実績の月次試算表から求めた、その PJ 単体の年度別付加価値。
 * サーバ側の算出は src/lib/project-plan-value.ts。クライアントはこの DTO 型だけを import する
 * (lib 側は "server-only" のため直接 import しない)。
 */

export interface ProjectPlanValueYear {
  fy: number;
  fy_label: string;
  months: number;
  /** その年度の全月が現在以前なら実績、全月が現在より後なら計画、跨いでいれば混在 */
  kind: "actual" | "plan" | "mixed";
  revenue_yen: number;
  operating_income_yen: number;
  personnel_yen: number;
  /** 月次試算表に列が無い減価償却・租税公課を落とした粗い付加価値 = 営業利益 + 人件費 */
  value_added_yen: number;
}

export interface ProjectPlanValueCheck {
  project_id: string;
  has_data: boolean;
  years: ProjectPlanValueYear[];
  /** 12 ヶ月揃った年度のうち付加価値が最大の年度。立ち上がり後の定常値の代理に使う。 */
  peak: ProjectPlanValueYear | null;
  /** 12 ヶ月揃った年度で付加価値がプラスになるものが 1 つも無い */
  never_positive: boolean;
  /** 売上の入力が全期間ゼロ (費用だけの計画)。この場合は突き合わせを出さない。 */
  revenue_all_zero: boolean;
}
