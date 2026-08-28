/**
 * 経営チームの機能が「充足」か「空席」かを、人・組織の観測ログから機械的に判定する。
 *
 * 規則はモデル正本 §6.B-2。肩書・名義・意思表明では充足にしない——
 * 誰かが「CEOです」と名乗ったことではなく、その機能の実働の記録があるかだけを見る。
 * だから判定の入力は `project_org_observations` の行だけで、役職の台帳は入力にしない。
 *
 * 正本と数字がずれていないかは `pwa/scripts/check_team_function_contract.mjs` が見張る。
 */

/** `project_org_observations` の1行（画面・API 共通の形）。 */
export interface OrgObservation {
  id: string;
  /** 出来事の日付 `YYYY-MM-DD`。記録した日ではない。 */
  observedOn: string;
  /** 種類15（人の着任・退任・実働）/ 16（異動・定年・卒業）/ 17（体制変化）。 */
  kind: "staffing" | "departure" | "structure";
  personName: string | null;
  /** 八機能の番号。機能に紐づかない体制の話は null。 */
  functionNo: number | null;
  headline: string;
  detail: string | null;
  sourceTag: "document" | "interview" | "third_party" | "public" | "masa";
  sourceRef: string | null;
  effect: string | null;
  direction: "positive" | "negative" | "neutral";
  recordedBy: string;
}

/** 充足の判定条件（§6.B-2）。数字を動かすのはモデルの版更新であって画面の都合ではない。 */
export const FULFILLMENT_RULE = {
  /** 直近性: この月数を超えて実働の記録が途切れたら空席へ戻る。 */
  recencyMonths: 12,
  /** 複数時点: 必要な実働の記録の時点数。 */
  minOccasions: 2,
  /** 複数時点の間隔: 2時点がこの月数以上離れていること。 */
  minGapMonths: 3,
  /** 出所に第三者証言または相手方の記録を要する機能番号（§6.B-2 の4）。 */
  thirdPartyRequiredFunctions: [1] as readonly number[],
  /** 記録薄の判定（§6.C-3 の3）: 直近この月数の記帳がこの件数以下なら、充足の失効判定を保留する。 */
  thinRecordWindowMonths: 6,
  thinRecordMaxCount: 1,
} as const;

export type FunctionState =
  /** 条件をすべて満たしている。 */
  | "fulfilled"
  /** 実働の記録はあるが、複数時点・間隔・出所のどれかが足りない。評価版の確定では空席として扱う。 */
  | "provisional"
  /** 実働の記録が無い（または直近性が切れた）。減点ではなく遅延として計算に入る。 */
  | "vacant"
  /**
   * 記録そのものが薄いので、空席かどうかを判定していない（§6.C-3 の3）。
   * 記録を怠っただけの案件が、実態と無関係に空席・失速扱いになるのを防ぐための状態。
   */
  | "unrecorded";

export interface FunctionJudgement {
  functionNo: number;
  state: FunctionState;
  /** その機能を担っている（と記録から読める）人。 */
  holders: string[];
  /** 判定に使った実働の記録。新しい順。 */
  evidence: OrgObservation[];
  /** 充足へ数えなかった逆向きの観測。画面に注意として出す。 */
  concerns: OrgObservation[];
  /** なぜこの状態なのかの一文。画面にそのまま出す。 */
  reason: string;
}

function monthsBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  let months = (by - ay) * 12 + (bm - am);
  if (bd < ad) months -= 1;
  return months;
}

/**
 * この PJ の記録が薄いか（§6.C-3 の3）。
 *
 * 薄いあいだ、機能の状態は「空席」ではなく「未記帳」にする。
 * 記録の薄さを案件の悪材料と混同しないための切り分けで、正本が明示している。
 */
export function isThinRecord(observations: OrgObservation[], asOf: string): boolean {
  const recent = observations.filter(
    (o) => monthsBetween(o.observedOn, asOf) <= FULFILLMENT_RULE.thinRecordWindowMonths,
  );
  return recent.length <= FULFILLMENT_RULE.thinRecordMaxCount;
}

/**
 * 1つの機能の状態を判定する。
 *
 * `asOf` は評価日（`YYYY-MM-DD`）。直近性はこの日から数える。
 *
 * 逆向きの観測（direction='negative'）は充足へ数えない。
 * 正本の充足判定は実働があるかだけを見て質を見ないので、
 * 「対外説明の主体として動いたが相手の判断を悪い方へ動かした」を充足の証拠にすると、
 * 逆効果の実働が機能を埋めたことになってしまう。
 * 負の観測を数値へどう効かせるかはモデル側の宿題で、ここでは画面に出すだけに留める。
 */
export function judgeFunction(
  observations: OrgObservation[],
  functionNo: number,
  asOf: string,
  options?: { thinRecord?: boolean },
): FunctionJudgement {
  const mine = observations
    .filter((o) => o.functionNo === functionNo && o.kind === "staffing")
    .sort((a, b) => b.observedOn.localeCompare(a.observedOn));

  const concerns = mine.filter((o) => o.direction === "negative");
  const withinRecency = mine.filter(
    (o) => o.direction !== "negative" && monthsBetween(o.observedOn, asOf) <= FULFILLMENT_RULE.recencyMonths,
  );

  const needsThirdParty = FULFILLMENT_RULE.thirdPartyRequiredFunctions.includes(functionNo);
  const qualified = needsThirdParty
    ? withinRecency.filter((o) => o.sourceTag === "third_party" || o.sourceTag === "document")
    : withinRecency;

  const holders = Array.from(
    new Set(qualified.map((o) => o.personName).filter((n): n is string => Boolean(n))),
  );

  if (qualified.length === 0) {
    const expired = mine.filter((o) => o.direction !== "negative").length > 0;
    const droppedBySource = needsThirdParty && withinRecency.length > 0;
    // 記録が薄いあいだは空席と決めない（§6.C-3 の3）。判定を保留していることを状態で見せる。
    if (options?.thinRecord) {
      return {
        functionNo,
        state: "unrecorded",
        holders,
        evidence: qualified,
        concerns,
        // 記録薄そのものの説明は表の上に1回だけ出す。行ごとに同じ文を並べない。
        reason: concerns.length > 0 ? "重しの観測だけで、充足を判定できる実働の記録が無い" : "記帳なし",
      };
    }
    const reason = droppedBySource
      ? `直近${FULFILLMENT_RULE.recencyMonths}か月の記録はあるが、この機能は第三者証言か相手方の記録が要る`
      : expired
        ? `実働の記録が直近${FULFILLMENT_RULE.recencyMonths}か月で途切れている`
        : concerns.length > 0
          ? "逆向きの観測だけで、充足へ数える実働の記録が無い"
          : "実働の記録がまだ無い";
    return { functionNo, state: "vacant", holders, evidence: qualified, concerns, reason };
  }

  const newest = qualified[0].observedOn;
  const oldest = qualified[qualified.length - 1].observedOn;
  const gap = monthsBetween(oldest, newest);
  const enoughOccasions = qualified.length >= FULFILLMENT_RULE.minOccasions;
  const enoughGap = gap >= FULFILLMENT_RULE.minGapMonths;

  if (enoughOccasions && enoughGap) {
    return {
      functionNo,
      state: "fulfilled",
      holders,
      evidence: qualified,
      concerns,
      reason: `${qualified.length}件の実働の記録が${gap}か月ぶんに渡っている`,
    };
  }

  return {
    functionNo,
    state: "provisional",
    holders,
    evidence: qualified,
    concerns,
    reason: enoughOccasions
      ? `記録は${qualified.length}件あるが、${FULFILLMENT_RULE.minGapMonths}か月以上あいた2時点になっていない`
      : `実働の記録が${qualified.length}件だけで、評価版の確定では空席として扱う`,
  };
}

export const FUNCTION_STATE_LABEL: Record<FunctionState, string> = {
  fulfilled: "充足",
  provisional: "充足見込み",
  vacant: "空席",
  unrecorded: "未記帳",
};

export const OBSERVATION_KIND_LABEL: Record<OrgObservation["kind"], string> = {
  staffing: "着任・退任・実働",
  departure: "異動・定年・卒業",
  structure: "体制の変化",
};

export const SOURCE_TAG_LABEL: Record<OrgObservation["sourceTag"], string> = {
  document: "文書",
  interview: "面談",
  third_party: "第三者証言",
  public: "公開情報",
  masa: "まさの観察",
};
