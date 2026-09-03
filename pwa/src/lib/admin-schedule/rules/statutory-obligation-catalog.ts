/**
 * 会社が負う税・社会保険・法定提出の全目録。
 *
 * カレンダーは「生成できたもの」しか出さないため、生成ルールが無い義務は画面から
 * 静かに消える。2026-09-03、源泉所得税の不納付加算税が郵送で届くまでどこにも
 * 現れなかったのはこの構造による。
 *
 * この目録は「AMDに発生しうる義務の全件」を静的に持ち、実際の生成結果と突き合わせて
 * 各行が「出ている / 事実が足りない / 該当しない / 未実装」のどれかを必ず表示する。
 * 該当するかどうか分からない行も、分からないまま出す。消さない。
 */

export type ObligationCoverage =
  | "generated"      // カレンダーに予定が出ている
  | "needs_fact"     // 生成ルールはあるが、判定に必要な会社の事実が無い
  | "not_applicable" // AMDには該当しないと判定できた
  | "not_implemented"; // 生成ルール自体が無い

export type StatutoryObligationCatalogEntry = {
  key: string;
  title: string;
  payee: string;
  cadence: string;
  kind: "payment" | "filing";
  /** カレンダー上でこの義務に対応する event_kind。1件でもあれば「出ている」 */
  matchEventKinds: string[];
  /** event_kind だけでは区別できない義務を、予定名に必ず含まれる語で絞る */
  matchTitleIncludes?: string[];
  /** 判定・生成に必要な会社の事実。欠けていれば needs_fact */
  requiredFacts: string[];
  /** 生成ルールが無いときに、何をすれば埋まるか */
  note: string;
  officialUrl: string;
};

export const STATUTORY_OBLIGATION_CATALOG_AS_OF = "2026-09-03";

export const STATUTORY_OBLIGATION_CATALOG: StatutoryObligationCatalogEntry[] = [
  // ── 国税（税務署） ──────────────────────────────────
  {
    key: "corporate_tax_final",
    title: "法人税・地方法人税（確定申告と納付）",
    payee: "税務署",
    cadence: "事業年度終了から2か月以内",
    kind: "payment",
    matchEventKinds: ["corporate_tax_filing"],
    requiredFacts: ["fiscal_year_end_month"],
    note: "月次試算の税額予測から生成する。予測が0円の年は行そのものが作られない。",
    officialUrl: "https://www.nta.go.jp/taxes/nozei/nofu/24200042/noufu_kigen.htm",
  },
  {
    key: "corporate_tax_interim",
    title: "法人税・地方法人税（中間申告と納付）",
    payee: "税務署",
    cadence: "事業年度開始から8か月目の末日",
    kind: "payment",
    matchEventKinds: ["corporate_tax_interim"],
    requiredFacts: ["previous_corporate_tax_yen", "corporate_tax_interim_required"],
    note: "前期の法人税額が10万円を超えると必要。前期額を取得できないので、必要かどうかを判定できていない。",
    officialUrl: "https://www.nta.go.jp/taxes/nozei/nofu/24200038/01.htm",
  },
  {
    key: "consumption_tax_final",
    title: "消費税・地方消費税（確定申告と納付）",
    payee: "税務署",
    cadence: "事業年度終了から2か月以内",
    kind: "payment",
    matchEventKinds: ["tax_payment"],
    matchTitleIncludes: ["消費税", "確定"],
    requiredFacts: ["fiscal_year_end_month"],
    note: "月次試算の税額予測から生成する。",
    officialUrl: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6609.htm",
  },
  {
    key: "consumption_tax_interim",
    title: "消費税・地方消費税（中間申告と納付）",
    payee: "税務署",
    cadence: "前年の税額に応じた回数。AMDは年1回",
    kind: "payment",
    matchEventKinds: ["tax_payment"],
    matchTitleIncludes: ["消費税", "中間"],
    requiredFacts: ["consumption_tax_filing_mode"],
    note: "前年確定額の約2分の1で生成している。申告区分そのものは未取得。",
    officialUrl: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6609.htm",
  },
  {
    key: "withholding_income_tax",
    title: "源泉所得税・復興特別所得税（納期の特例）",
    payee: "税務署",
    cadence: "1-6月分は7月10日、7-12月分は翌年1月20日",
    kind: "payment",
    matchEventKinds: ["withholding_tax_payment"],
    requiredFacts: ["withholding_payment_mode"],
    note: "freeeの給与仕訳から月別に合算する。",
    officialUrl: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2505.htm",
  },
  {
    key: "tax_penalty",
    title: "加算税・延滞税",
    payee: "税務署",
    cadence: "納付が遅れたとき。賦課決定通知で確定",
    kind: "payment",
    matchEventKinds: ["tax_penalty_payment"],
    requiredFacts: [],
    note: "未納が続いている法定納付には見込みを出す。届いた通知書は支払義務へ登録するとここに並ぶ。",
    officialUrl: "https://www.nta.go.jp/taxes/nozei/entaizei/keisan/entai_wariai.htm",
  },
  {
    key: "hotei_chosho",
    title: "法定調書合計表・源泉徴収票の提出",
    payee: "税務署",
    cadence: "毎年1月31日",
    kind: "filing",
    matchEventKinds: ["hotei_chosho_filing"],
    requiredFacts: [],
    note: "生成ルールが無い。支払調書の対象を判定する仕組みから作る必要がある。",
    officialUrl: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/hotei/7400.htm",
  },
  {
    key: "year_end_adjustment",
    title: "年末調整の社内工程",
    payee: "（社内）",
    cadence: "毎年12月の給与処理まで",
    kind: "filing",
    matchEventKinds: ["year_end_adjustment"],
    requiredFacts: ["payroll_closing_day", "payroll_payment_day", "year_end_adjustment_deadline_ymd"],
    note: "給与の締日と支給日が未取得のため、社内の締切を逆算できていない。",
    officialUrl: "https://www.nta.go.jp/users/gensen/nencho/index/shikata.htm",
  },
  {
    key: "stamp_duty",
    title: "印紙税",
    payee: "税務署（収入印紙）",
    cadence: "課税文書を作成したとき",
    kind: "payment",
    matchEventKinds: ["stamp_duty"],
    requiredFacts: ["stamp_duty_taxable_documents"],
    note: "契約書ごとに発生するため期日を持たない。契約台帳から課税文書を判定する仕組みが無い。",
    officialUrl: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7140.htm",
  },

  // ── 地方税（茨城県） ────────────────────────────────
  {
    key: "prefectural_corporate_tax",
    title: "法人県民税・法人事業税・特別法人事業税（確定）",
    payee: "茨城県（土浦県税事務所）",
    cadence: "事業年度終了から2か月以内",
    kind: "payment",
    matchEventKinds: ["prefectural_corporate_tax_filing"],
    requiredFacts: ["fiscal_year_end_month"],
    note: "納付先が税務署とは別で、納付書も別。いまは法人税等1件に合算していて、県への納付が独立していない。均等割は赤字でも発生する。",
    officialUrl: "https://www.pref.ibaraki.jp/somu/zeimu/kikaku/faq/hojinnizei/top.html",
  },
  {
    key: "prefectural_corporate_tax_interim",
    title: "法人県民税・法人事業税（中間）",
    payee: "茨城県（土浦県税事務所）",
    cadence: "事業年度開始から8か月目の末日",
    kind: "payment",
    matchEventKinds: ["prefectural_corporate_tax_interim"],
    requiredFacts: ["previous_corporate_tax_yen"],
    note: "法人税の中間申告をする年は県税も中間納付が要る。前期額が未取得のため判定できていない。",
    officialUrl: "https://www.pref.ibaraki.jp/somu/zeimu/kikaku/faq/hojinnizei/top.html",
  },

  // ── 地方税（つくば市） ──────────────────────────────
  {
    key: "municipal_corporate_tax",
    title: "法人市民税（均等割・法人税割／確定）",
    payee: "つくば市",
    cadence: "事業年度終了から2か月以内",
    kind: "payment",
    matchEventKinds: ["municipal_corporate_tax_filing"],
    requiredFacts: ["fiscal_year_end_month"],
    note: "納付先が税務署・県とは別。均等割は赤字でも発生する。いまは法人税等1件に合算している。",
    officialUrl: "https://www.city.tsukuba.lg.jp/soshikikarasagasu/zaimubushiminzeika/gyomuannai/3/1/1003131.html",
  },
  {
    key: "municipal_corporate_tax_interim",
    title: "法人市民税（中間）",
    payee: "つくば市",
    cadence: "事業年度開始から8か月目の末日",
    kind: "payment",
    matchEventKinds: ["municipal_corporate_tax_interim"],
    requiredFacts: ["previous_corporate_tax_yen"],
    note: "法人税の中間申告をする年は市民税も中間納付が要る。",
    officialUrl: "https://www.city.tsukuba.lg.jp/soshikikarasagasu/zaimubushiminzeika/gyomuannai/3/1/1003131.html",
  },
  {
    key: "depreciable_assets_filing",
    title: "償却資産の申告",
    payee: "つくば市（資産税課）",
    cadence: "毎年1月31日（休日なら翌開庁日）",
    kind: "filing",
    matchEventKinds: ["depreciable_assets_filing"],
    requiredFacts: ["depreciable_assets_held"],
    note: "資産を持っていれば課税額に関わらず申告義務がある。無申告は10万円以下の過料。課税されるのは課税標準150万円以上のときだけ。freeeの固定資産台帳から保有を判定する仕組みが無い。",
    officialUrl: "https://www.city.tsukuba.lg.jp/soshikikarasagasu/zaimubushisanzeika/gyomuannai/2/1/1001069.html",
  },
  {
    key: "fixed_assets_tax",
    title: "固定資産税・都市計画税（土地・家屋）",
    payee: "つくば市（資産税課）",
    cadence: "年4期（納税通知書で通知）",
    kind: "payment",
    matchEventKinds: ["fixed_assets_tax"],
    requiredFacts: ["real_estate_held"],
    note: "土地・家屋を保有していれば毎年課税される。保有の有無がOSに無い。",
    officialUrl: "https://www.city.tsukuba.lg.jp/kurashi/zeikin/shisan/1001046.html",
  },
  {
    key: "vehicle_tax",
    title: "自動車税・軽自動車税（種別割）",
    payee: "茨城県 / つくば市",
    cadence: "毎年5月（納税通知書で通知）",
    kind: "payment",
    matchEventKinds: ["vehicle_tax"],
    requiredFacts: ["vehicles_held"],
    note: "社用車を保有していれば毎年課税される。保有の有無がOSに無い。",
    officialUrl: "https://www.pref.ibaraki.jp/somu/zeimu/kikaku/faq/top.html",
  },

  // ── 住民税 ──────────────────────────────────────
  {
    key: "resident_tax_special_collection",
    title: "住民税（特別徴収の毎月納付）",
    payee: "各従業員の居住市区町村",
    cadence: "給与から天引きした月の翌月10日",
    kind: "payment",
    matchEventKinds: ["resident_tax_payment"],
    requiredFacts: ["resident_tax_special_collection_enrollment"],
    note: "freeeの給与仕訳に住民税が出てこないため、予定が1件も作られていない。特別徴収をしているかどうかがOSに無い。",
    officialUrl: "https://www.city.tsukuba.lg.jp/soshikikarasagasu/zaimubushiminzeika/gyomuannai/4/2/kozinshiminzei/1001030.html",
  },

  // ── 社会保険（年金事務所） ────────────────────────
  {
    key: "social_insurance_monthly",
    title: "健康保険・厚生年金保険料・子ども子育て拠出金",
    payee: "日本年金機構",
    cadence: "対象月の翌月末",
    kind: "payment",
    matchEventKinds: ["social_insurance_payment"],
    requiredFacts: ["social_insurance_enrollment"],
    note: "納入告知額をfreeeの給与仕訳から合算する。",
    officialUrl: "https://www.nenkin.go.jp/service/kounen/hokenryo/nofu/nofu.html",
  },
  {
    key: "social_insurance_penalty",
    title: "社会保険料の延滞金",
    payee: "日本年金機構",
    cadence: "納付が遅れたとき",
    kind: "payment",
    matchEventKinds: ["social_insurance_penalty_payment"],
    requiredFacts: [],
    note: "未納が続いている保険料には見込みを出す。督促状が届いたら支払義務へ登録する。",
    officialUrl: "https://www.nenkin.go.jp/service/kounen/hokenryo/nofu/20141219-02.html",
  },
  {
    key: "santei_kiso",
    title: "算定基礎届の提出（定時決定）",
    payee: "日本年金機構",
    cadence: "毎年7月1日から7月10日",
    kind: "filing",
    matchEventKinds: ["santei_kiso_filing"],
    requiredFacts: ["social_insurance_enrollment"],
    note: "生成ルールが無い。4〜6月の報酬から標準報酬月額を決め直す届出で、9月分の保険料から反映される。",
    officialUrl: "https://www.nenkin.go.jp/service/kounen/hokenryo/hoshu/20121017.html",
  },
  {
    key: "bonus_payment_report",
    title: "賞与支払届",
    payee: "日本年金機構",
    cadence: "賞与を支払った日から5日以内",
    kind: "filing",
    matchEventKinds: ["bonus_payment_report"],
    requiredFacts: ["bonus_payments"],
    note: "賞与を支払う場合だけ発生する。支払予定がOSに無い。",
    officialUrl: "https://www.nenkin.go.jp/service/kounen/hokenryo/hoshu/20120926-01.html",
  },

  // ── 労働保険（労働局） ──────────────────────────
  {
    key: "labor_insurance_annual",
    title: "労働保険料（年度更新の申告と納付）",
    payee: "労働局・労働基準監督署",
    cadence: "毎年6月1日から7月10日",
    kind: "payment",
    matchEventKinds: ["labor_insurance_annual_update"],
    requiredFacts: ["labor_insurance_enrollment"],
    note: "前年の納付実績から見積もる。年度ごとの公表期限を取得できない年は生成不能になる。",
    officialUrl: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/hoken/roudouhoken21/index.html",
  },
  {
    key: "labor_insurance_penalty",
    title: "労働保険料の延滞金",
    payee: "労働局",
    cadence: "督促状の指定期限を過ぎたとき",
    kind: "payment",
    matchEventKinds: ["labor_insurance_penalty_payment"],
    requiredFacts: [],
    note: "延滞金の割合の一次情報を持っていないため見込みを出さない。督促状が届いたら支払義務へ登録する。",
    officialUrl: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/hoken/roudouhoken21/index.html",
  },
];

export type ResolvedObligationCatalogEntry = StatutoryObligationCatalogEntry & {
  coverage: ObligationCoverage;
  occurrenceCount: number;
  nextDueOn: string | null;
  missingFacts: string[];
};

type CatalogOccurrence = {
  event_kind: string;
  title: string;
  due_on: string | null;
  lifecycle_status: string;
};

/**
 * 目録の各行が、いま実際にカレンダーへ出ているかを突き合わせる。
 * 出ていない行は、足りない事実の名前を添えて残す。行を落とさない。
 */
export function resolveObligationCatalog(
  occurrences: readonly CatalogOccurrence[],
  knownFactKeys: ReadonlySet<string>,
  today: string,
  entries: readonly StatutoryObligationCatalogEntry[] = STATUTORY_OBLIGATION_CATALOG
): ResolvedObligationCatalogEntry[] {
  return entries.map((entry) => {
    // 生成不能（needs_source）は「出ている」に数えない。日付を作れていない予定は、
    // 画面には残るが義務を追えている状態ではない。
    const matched = occurrences.filter(
      (row) => entry.matchEventKinds.includes(row.event_kind)
        && row.lifecycle_status !== "cancelled"
        && row.lifecycle_status !== "needs_source"
        && (entry.matchTitleIncludes ?? []).every((word) => row.title.includes(word))
    );
    const upcoming = matched
      .map((row) => row.due_on)
      .filter((value): value is string => value != null && value >= today)
      .sort();
    const missingFacts = entry.requiredFacts.filter((fact) => !knownFactKeys.has(fact));
    const coverage: ObligationCoverage = matched.length > 0
      ? "generated"
      : missingFacts.length > 0
        ? "needs_fact"
        : "not_implemented";
    return {
      ...entry,
      coverage,
      occurrenceCount: matched.length,
      nextDueOn: upcoming[0] ?? null,
      missingFacts,
    };
  });
}
