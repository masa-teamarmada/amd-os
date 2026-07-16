import type { RuleDefinition } from "@/lib/admin-schedule/types";

export const OFFICIAL_AS_OF = "2026-07-16";

export const OFFICIAL_RULES: Record<string, RuleDefinition> = {
  corporate_tax_filing: {
    ruleKey: "corporate_tax_filing",
    ruleVersion: "nta-corporate-tax-2026-07-16",
    category: "tax",
    officialRefs: [{
      label: "国税庁：主な国税の納期限（法人税）",
      url: "https://www.nta.go.jp/taxes/nozei/nofu/24200042/noufu_kigen.htm",
      asOf: OFFICIAL_AS_OF,
    }],
    reviewAfter: "2027-04-01",
  },
  corporate_tax_interim: {
    ruleKey: "corporate_tax_interim",
    ruleVersion: "nta-corporate-tax-interim-2026-07-16",
    category: "tax",
    officialRefs: [{
      label: "国税庁：中間申告分の納期限及び振替日",
      url: "https://www.nta.go.jp/taxes/nozei/nofu/24200038/01.htm",
      asOf: OFFICIAL_AS_OF,
    }],
    reviewAfter: "2027-04-01",
  },
  withholding_monthly: {
    ruleKey: "withholding_monthly",
    ruleVersion: "nta-withholding-2505-2026-07-16",
    category: "tax",
    officialRefs: [{
      label: "国税庁：源泉所得税の納付期限と納期の特例",
      url: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2505.htm",
      asOf: OFFICIAL_AS_OF,
    }],
    reviewAfter: "2027-04-01",
  },
  withholding_special: {
    ruleKey: "withholding_special",
    ruleVersion: "nta-withholding-special-2026-07-16",
    category: "tax",
    officialRefs: [{
      label: "国税庁：源泉所得税の納付期限と納期の特例",
      url: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2505.htm",
      asOf: OFFICIAL_AS_OF,
    }],
    reviewAfter: "2027-04-01",
  },
  social_insurance_month_end: {
    ruleKey: "social_insurance_month_end",
    ruleVersion: "nenkin-next-month-end-2026-07-16",
    category: "labor",
    officialRefs: [{
      label: "日本年金機構：厚生年金保険料等の納付",
      url: "https://www.nenkin.go.jp/service/kounen/hokenryo/nofu/nofu.html",
      asOf: OFFICIAL_AS_OF,
    }],
    reviewAfter: "2027-04-01",
  },
  labor_insurance_annual_update: {
    ruleKey: "labor_insurance_annual_update",
    ruleVersion: "mhlw-labor-insurance-2026-07-16",
    category: "labor",
    officialRefs: [{
      label: "厚生労働省：労働保険年度更新に係るお知らせ",
      url: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/hoken/roudouhoken21/index.html",
      asOf: OFFICIAL_AS_OF,
    }],
    reviewAfter: "2027-05-01",
  },
  year_end_adjustment: {
    ruleKey: "year_end_adjustment",
    ruleVersion: "nta-year-end-adjustment-2026-07-16",
    category: "labor",
    officialRefs: [{
      label: "国税庁：年末調整のしかた",
      url: "https://www.nta.go.jp/users/gensen/nencho/index/shikata.htm",
      asOf: OFFICIAL_AS_OF,
    }],
    reviewAfter: "2026-11-01",
  },
};

export function officialRule(ruleKey: string): RuleDefinition | null {
  return OFFICIAL_RULES[ruleKey] ?? null;
}

export function ruleRefs(ruleKey: string): Array<{ label: string; url: string; asOf: string }> {
  return officialRule(ruleKey)?.officialRefs ?? [];
}
