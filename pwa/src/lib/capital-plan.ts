// Multi-round cap table planning engine: pure types and functions.
// No protect-holder concept: every event field and allocation is a user-editable
// input; derived values (shares, percentages, prices) can be explicitly overridden.

export type ValueSource = 'input' | 'calculated' | 'imported' | 'confirmed' | 'override';

export interface EditableValue {
  value: number;
  source: ValueSource;
  /** Present when source === 'override': the value the engine would have derived. */
  calculatedValue?: number;
  note?: string;
}

export function editableValue(value: number, source: ValueSource = 'input'): EditableValue {
  return { value, source };
}

export function overrideValue(calculatedValue: number, overrideTo: number, note?: string): EditableValue {
  return { value: overrideTo, source: 'override', calculatedValue, note };
}

export function resolvedValue(v: EditableValue | undefined | null): number {
  return v ? v.value : 0;
}

export type HolderKind = 'founder' | 'employee' | 'investor' | 'esop_pool' | 'advisor' | 'other';

export interface Holder {
  id: string;
  name: string;
  kind: HolderKind;
  note?: string;
}

export type ShareClass = 'common' | 'preferred' | 'option' | 'convertible' | 'warrant';

export type CapitalEventType =
  | 'incorporation'
  | 'equity_issue'
  | 'option_pool'
  | 'convertible_issue'
  | 'convertible_conversion'
  | 'secondary'
  | 'share_split'
  | 'ipo';

/** One holder's allocation within a single event. Every field is user-editable. */
export interface EventAllocation {
  id: string;
  holderId: string;
  shareClass: ShareClass;
  /** Shares issued to / removed from (secondary sale, negative) this holder in this event. */
  shares: EditableValue;
  /** Cash or consideration amount paid by/received for this allocation, if applicable. */
  amount?: EditableValue;
  /** Price per share used for this allocation, if applicable. */
  pricePerShare?: EditableValue;
  /** Editable allocation target: desired post-round fully diluted ownership % (0..1) for 'ownership_target' basis events. */
  targetOwnershipPercentage?: EditableValue;
  note?: string;
}

/**
 * Which inputs drive the calculated fields of a financing event when replayed
 * through deriveCapitalPlan. 'manual' leaves per-allocation shares/amount/price
 * as authored, but event-level summary fields (primaryRaise, newShares,
 * postMoneyValuation) are still recomputed from those allocations.
 */
export type CalculationBasis =
  | 'valuation_and_investment'
  | 'price_and_shares'
  | 'ownership_target'
  | 'manual';

export type CapitalEventStatus = 'confirmed' | 'planned';

export interface CapitalEvent {
  id: string;
  type: CapitalEventType;
  label: string;
  /** Sequential order key; lower runs first. User-editable to reorder rounds. */
  order: number;
  date?: string;
  /** Whether this event has already closed ('confirmed') or is a forward-looking scenario ('planned'). Absent is treated as confirmed. */
  status?: CapitalEventStatus;
  /** Pre-money valuation for this round, if applicable (equity_issue, convertible_conversion). */
  preMoneyValuation?: EditableValue;
  /** Post-money valuation; derivable but user-overridable. */
  postMoneyValuation?: EditableValue;
  /** Price per share applied when not set per-allocation. */
  pricePerShare?: EditableValue;
  /** Split ratio numerator/denominator for share_split events (e.g. 2-for-1 => ratio 2). */
  splitRatio?: EditableValue;
  /** Option pool size (shares) to create/expand for option_pool events. */
  poolSize?: EditableValue;
  /** Convertible instrument terms, when type is convertible_issue/convertible_conversion. */
  conversionCap?: EditableValue;
  conversionDiscount?: EditableValue;
  /**
   * Which inputs drive this event's calculated fields when replayed through
   * deriveCapitalPlan. Absent or 'manual' leaves allocation-level fields as
   * authored, but event-level summary fields are still recomputed from them
   * (see deriveEvent).
   */
  calculationBasis?: CalculationBasis;
  /** Editable event total: sum of new-money cash raised in this event (primary allocations). */
  primaryRaise?: EditableValue;
  /** Editable event total: total new shares issued in this event. */
  newShares?: EditableValue;
  allocations: EventAllocation[];
  note?: string;
}

export interface CapitalPlan {
  id: string;
  name: string;
  holders: Holder[];
  events: CapitalEvent[];
}

// ---------------------------------------------------------------------------
// Round snapshots: per-round holder issued & fully diluted shares/percentages
// ---------------------------------------------------------------------------

export interface HolderRoundStanding {
  holderId: string;
  /** Shares issued and outstanding for this holder as of this event (excludes unexercised options). */
  issuedShares: number;
  /** Issued + this holder's share of unexercised option pool / unconverted convertibles allocated to them. */
  fullyDilutedShares: number;
  issuedPercentage: number;
  fullyDilutedPercentage: number;
}

export interface RoundSnapshot {
  eventId: string;
  eventLabel: string;
  eventType: CapitalEventType;
  order: number;
  totalIssuedShares: number;
  totalFullyDilutedShares: number;
  holders: HolderRoundStanding[];
}

function sortedEvents(plan: CapitalPlan): CapitalEvent[] {
  return [...plan.events].sort((a, b) => a.order - b.order);
}

function isDilutiveClass(shareClass: ShareClass): boolean {
  return shareClass === 'option' || shareClass === 'convertible' || shareClass === 'warrant';
}

/**
 * Recalculates per-round standings by replaying events in order.
 * Downstream rounds always recompute from cumulative state; nothing is cached
 * across calls, so editing any upstream event field changes all later rounds.
 */
export function recalculateCapTable(plan: CapitalPlan): RoundSnapshot[] {
  const events = sortedEvents(plan);
  const issued = new Map<string, number>();
  const diluted = new Map<string, number>();
  const snapshots: RoundSnapshot[] = [];

  for (const event of events) {
    if (event.type === 'share_split') {
      const ratio = resolvedValue(event.splitRatio) || 1;
      for (const [holderId, shares] of issued) issued.set(holderId, shares * ratio);
      for (const [holderId, shares] of diluted) diluted.set(holderId, shares * ratio);
    }

    for (const alloc of event.allocations) {
      const delta = resolvedValue(alloc.shares);
      if (!isDilutiveClass(alloc.shareClass)) {
        issued.set(alloc.holderId, (issued.get(alloc.holderId) ?? 0) + delta);
      }
      diluted.set(alloc.holderId, (diluted.get(alloc.holderId) ?? 0) + delta);
    }

    const totalIssued = sumMap(issued);
    const totalDiluted = sumMap(diluted);
    const holderIds = new Set<string>([...issued.keys(), ...diluted.keys()]);

    const holders: HolderRoundStanding[] = [...holderIds].map((holderId) => {
      const holderIssued = issued.get(holderId) ?? 0;
      const holderDiluted = diluted.get(holderId) ?? 0;
      return {
        holderId,
        issuedShares: holderIssued,
        fullyDilutedShares: holderDiluted,
        issuedPercentage: totalIssued > 0 ? holderIssued / totalIssued : 0,
        fullyDilutedPercentage: totalDiluted > 0 ? holderDiluted / totalDiluted : 0,
      };
    });

    snapshots.push({
      eventId: event.id,
      eventLabel: event.label,
      eventType: event.type,
      order: event.order,
      totalIssuedShares: totalIssued,
      totalFullyDilutedShares: totalDiluted,
      holders,
    });
  }

  return snapshots;
}

function sumMap(m: Map<string, number>): number {
  let total = 0;
  for (const v of m.values()) total += v;
  return total;
}

export function latestSnapshot(snapshots: RoundSnapshot[]): RoundSnapshot | undefined {
  return snapshots[snapshots.length - 1];
}

export function holderStandingAt(snapshot: RoundSnapshot | undefined, holderId: string): HolderRoundStanding | undefined {
  return snapshot?.holders.find((h) => h.holderId === holderId);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  eventId?: string;
  holderId?: string;
}

export function validateCapitalPlan(plan: CapitalPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const holderIds = new Set(plan.holders.map((h) => h.id));
  const events = sortedEvents(plan);

  const YEN_TOLERANCE = 1;
  const SHARE_TOLERANCE = 0; // 株式数は1株のズレも許容しない
  const PCT_TOLERANCE = 0.0001; // 0.01 percentage points, expressed as a 0..1 fraction

  const convertibleBalance = new Map<string, number>();
  const orderSeen = new Map<number, string>();
  for (const event of events) {
    if (orderSeen.has(event.order)) {
      issues.push({
        severity: 'error',
        code: 'duplicate_order',
        message: `イベント順序 ${event.order} が "${orderSeen.get(event.order)}" と "${event.label}" の両方で使われています。`,
        eventId: event.id,
      });
    } else {
      orderSeen.set(event.order, event.label);
    }

    let secondaryNet = 0;
    for (const alloc of event.allocations) {
      if (!holderIds.has(alloc.holderId)) {
        issues.push({
          severity: 'error',
          code: 'unknown_holder',
          message: `"${event.label}" の割当が未知の株主ID「${alloc.holderId}」を参照しています。`,
          eventId: event.id,
          holderId: alloc.holderId,
        });
      }
      const shares = resolvedValue(alloc.shares);
      if (shares === 0) {
        issues.push({
          severity: 'warning',
          code: 'zero_shares',
          message: `"${event.label}" の株主「${alloc.holderId}」への割当株数が0です。`,
          eventId: event.id,
          holderId: alloc.holderId,
        });
      }
      if (!Number.isInteger(shares)) {
        issues.push({
          severity: 'error',
          code: 'fractional_shares',
          message: `"${event.label}" の株主「${alloc.holderId}」への割当株数（${shares}）が整数ではありません。株式数は整数である必要があります。`,
          eventId: event.id,
          holderId: alloc.holderId,
        });
      }

      const isAllowedNegativeShares =
        event.type === 'secondary' || (event.type === 'convertible_conversion' && alloc.shareClass === 'convertible');
      if (shares < 0 && !isAllowedNegativeShares) {
        issues.push({
          severity: 'error',
          code: 'negative_shares_not_allowed',
          message: `"${event.label}" の株主「${alloc.holderId}」への割当株数（${shares}）が負の数です。譲渡（セカンダリ）イベントの譲渡人、またはコンバーティブル転換イベントでの転換社債等の消込以外ではマイナスの株数は認められません。`,
          eventId: event.id,
          holderId: alloc.holderId,
        });
      }

      if (alloc.amount != null && event.type !== 'secondary' && resolvedValue(alloc.amount) < 0) {
        issues.push({
          severity: 'error',
          code: 'negative_allocation_amount',
          message: `"${event.label}" の株主「${alloc.holderId}」の金額（${resolvedValue(alloc.amount)}円）が負の数です。譲渡（セカンダリ）イベント以外でマイナスの金額は認められません。`,
          eventId: event.id,
          holderId: alloc.holderId,
        });
      }

      if (alloc.shareClass === 'convertible') {
        const holderBalance = convertibleBalance.get(alloc.holderId) ?? 0;
        if (shares < 0 && Math.abs(shares) - holderBalance > SHARE_TOLERANCE) {
          issues.push({
            severity: 'error',
            code: 'convertible_consumption_exceeds_balance',
            message: `"${event.label}" の株主「${alloc.holderId}」がこれまでの保有残高（${holderBalance}）を超えるコンバーティブル（${Math.abs(shares)}）を消込しようとしています。`,
            eventId: event.id,
            holderId: alloc.holderId,
          });
        }
        convertibleBalance.set(alloc.holderId, holderBalance + shares);
      }

      if (event.type === 'secondary') secondaryNet += shares;
    }

    if (event.type === 'secondary' && Math.abs(secondaryNet) > 0) {
      issues.push({
        severity: 'error',
        code: 'secondary_net_not_zero',
        message: `譲渡（セカンダリ）イベント "${event.label}" の株式移動合計が0になっていません（合計: ${secondaryNet}）。譲渡人のマイナスと譲受人のプラスが一致している必要があります。`,
        eventId: event.id,
      });
    }

    if (event.type === 'equity_issue' || event.type === 'ipo' || event.type === 'convertible_conversion') {
      if (event.allocations.length === 0) {
        issues.push({
          severity: 'error',
          code: 'empty_equity_issue',
          message: `増資イベント "${event.label}" に割当がありません。`,
          eventId: event.id,
        });
      }
      const pre = event.preMoneyValuation;
      const post = event.postMoneyValuation;
      if (pre && post && resolvedValue(post) < resolvedValue(pre)) {
        issues.push({
          severity: 'warning',
          code: 'post_below_pre',
          message: `"${event.label}" のポストマネー評価額（${resolvedValue(post)}）がプレマネー評価額（${resolvedValue(pre)}）を下回っています。`,
          eventId: event.id,
        });
      }
      if (pre && event.type !== 'convertible_conversion') {
        const raise = event.allocations
          .filter((a) => a.amount != null)
          .reduce((sum, a) => sum + resolvedValue(a.amount), 0);
        const expectedPost = resolvedValue(pre) + raise;
        if (post && Math.abs(resolvedValue(post) - expectedPost) > YEN_TOLERANCE) {
          issues.push({
            severity: 'error',
            code: 'post_money_mismatch',
            message: `"${event.label}" のポストマネー評価額（${resolvedValue(post)}円）が「プレマネー + 調達額」（${expectedPost}円）と一致しません（許容誤差 ${YEN_TOLERANCE}円）。`,
            eventId: event.id,
          });
        }
      }
    }

    if (event.type === 'share_split' && resolvedValue(event.splitRatio) <= 0) {
      issues.push({
        severity: 'error',
        code: 'invalid_split_ratio',
        message: `株式分割 "${event.label}" の分割比率が0以下です。`,
        eventId: event.id,
      });
    }

    if (event.type === 'convertible_conversion') {
      if (event.primaryRaise && Math.abs(resolvedValue(event.primaryRaise)) > YEN_TOLERANCE) {
        issues.push({
          severity: 'error',
          code: 'convertible_conversion_primary_raise_nonzero',
          message: `"${event.label}" はコンバーティブル転換イベントのため、primaryRaise（${resolvedValue(event.primaryRaise)}円）は新規の現金調達として計上できません。0にしてください。`,
          eventId: event.id,
        });
      }
    } else if (event.primaryRaise) {
      const cashSum = event.allocations.reduce((sum, a) => sum + (a.amount ? resolvedValue(a.amount) : 0), 0);
      if (Math.abs(resolvedValue(event.primaryRaise) - cashSum) > YEN_TOLERANCE) {
        issues.push({
          severity: 'error',
          code: 'primary_raise_mismatch',
          message: `"${event.label}" のprimaryRaise（${resolvedValue(event.primaryRaise)}円）が割当の現金合計（${cashSum}円）と一致しません。`,
          eventId: event.id,
        });
      }
    }

    if (event.newShares) {
      const expectedIssuedShares =
        event.type === 'secondary'
          ? 0
          : event.allocations.reduce((sum, a) => {
              if (isDilutiveClass(a.shareClass)) return sum;
              const s = resolvedValue(a.shares);
              return s > 0 ? sum + s : sum;
            }, 0);
      if (Math.abs(resolvedValue(event.newShares) - expectedIssuedShares) > SHARE_TOLERANCE) {
        const message =
          event.type === 'secondary'
            ? `"${event.label}" のnewShares（${resolvedValue(event.newShares)}）は譲渡（セカンダリ）イベントのため0である必要があります。譲受人への株式移動は新規発行として計上しないでください。`
            : `"${event.label}" のnewShares（${resolvedValue(event.newShares)}）が新規発行株式数合計（${expectedIssuedShares}）と一致しません（オプション・コンバーティブル・ワラント割当はFDのみのため新規発行株式数には含めません）。`;
        issues.push({
          severity: 'error',
          code: 'new_shares_mismatch',
          message,
          eventId: event.id,
        });
      }
    }

    for (const alloc of event.allocations) {
      const effectivePrice = alloc.pricePerShare
        ? resolvedValue(alloc.pricePerShare)
        : event.pricePerShare
          ? resolvedValue(event.pricePerShare)
          : undefined;
      if (alloc.amount && effectivePrice != null && effectivePrice > 0) {
        const shares = resolvedValue(alloc.shares);
        const expectedAmount = shares * effectivePrice;
        const tolerance = Math.max(YEN_TOLERANCE, effectivePrice); // 整数株丸めによる1株分の誤差まで許容
        if (Math.abs(resolvedValue(alloc.amount) - expectedAmount) > tolerance) {
          issues.push({
            severity: 'error',
            code: 'allocation_amount_price_mismatch',
            message: `"${event.label}" の株主「${alloc.holderId}」の金額（${resolvedValue(alloc.amount)}円）が株数×価格（${expectedAmount}円、許容誤差 ${tolerance}円）と一致しません。`,
            eventId: event.id,
            holderId: alloc.holderId,
          });
        }
      }
    }

    // derive後にサーバー側で凍結する際、株価の上書きがderive時点の算出値と乖離したまま
    // 残っていると、メイン画面（algo算出値ベース）と投資家詳細（override値ベース）で
    // 表示される株価が食い違う（例: 一覧が40,000円、投資家詳細が30,000円）。
    // valuation_and_investment / ownership_target は株価がevent/allocationの派生出力
    // なので、override後に基準となるinputが変わってcalculatedValueが更新されたら検出する。
    if (event.calculationBasis === 'valuation_and_investment' || event.calculationBasis === 'ownership_target') {
      if (
        event.pricePerShare &&
        event.pricePerShare.source === 'override' &&
        event.pricePerShare.calculatedValue != null &&
        Math.abs(event.pricePerShare.value - event.pricePerShare.calculatedValue) > YEN_TOLERANCE
      ) {
        issues.push({
          severity: 'error',
          code: 'derived_event_price_override_mismatch',
          message: `"${event.label}" の株価の上書き値（${event.pricePerShare.value}円）が、現在の入力から再算出した株価（${event.pricePerShare.calculatedValue}円）と一致しません（許容誤差 ${YEN_TOLERANCE}円）。このまま凍結すると、一覧表示と算出値が食い違ったまま固定されます。上書き値を再算出値に合わせるか、上書きを取り消してください。`,
          eventId: event.id,
        });
      }

      for (const alloc of event.allocations) {
        if (
          alloc.pricePerShare &&
          alloc.pricePerShare.source === 'override' &&
          alloc.pricePerShare.calculatedValue != null &&
          Math.abs(alloc.pricePerShare.value - alloc.pricePerShare.calculatedValue) > YEN_TOLERANCE
        ) {
          issues.push({
            severity: 'error',
            code: 'derived_allocation_price_override_mismatch',
            message: `"${event.label}" の株主「${alloc.holderId}」の株価の上書き値（${alloc.pricePerShare.value}円）が、現在の入力から再算出した株価（${alloc.pricePerShare.calculatedValue}円）と一致しません（許容誤差 ${YEN_TOLERANCE}円）。このまま凍結すると、投資家詳細と算出値が食い違ったまま固定されます。上書き値を再算出値に合わせるか、上書きを取り消してください。`,
            eventId: event.id,
            holderId: alloc.holderId,
          });
        }
      }
    }

    // price_and_shares はイベント単価のみを唯一のdriverとし、割当ごとに別の単価を
    // 持たせない一本化ルール（EventEditorの1株価格セルもevent.pricePerShareのみを
    // 編集させる）。それでも生成AI/レガシーAPIドキュメントの取り込みやraw importで
    // allocation.pricePerShareが個別に設定され、event.pricePerShareと乖離したまま
    // 残るケースがある（VC提出時の矛盾: イベント単価と割当単価が食い違う）。
    // deriveEvent はallocation側の単価が入っていればそちらを優先してしまうため、
    // 検証で明示的にブロックしないと矛盾した書類がそのまま提出可能になる。
    if (event.calculationBasis === 'price_and_shares' && event.pricePerShare) {
      const eventPrice = resolvedValue(event.pricePerShare);
      for (const alloc of event.allocations) {
        if (
          alloc.pricePerShare &&
          Math.abs(resolvedValue(alloc.pricePerShare) - eventPrice) > YEN_TOLERANCE
        ) {
          issues.push({
            severity: 'error',
            code: 'price_basis_allocation_price_mismatch',
            message: `"${event.label}" は単価×株数方式のため株価はイベント単価（${eventPrice}円）で統一する必要がありますが、株主「${alloc.holderId}」の割当単価（${resolvedValue(alloc.pricePerShare)}円）がそれと一致しません（許容誤差 ${YEN_TOLERANCE}円）。別の単価で発行する場合はイベントを分けてください。`,
            eventId: event.id,
            holderId: alloc.holderId,
          });
        }
      }
    }

    if (event.type === 'option_pool' && event.poolSize) {
      const optionSum = event.allocations
        .filter((a) => a.shareClass === 'option')
        .reduce((sum, a) => sum + resolvedValue(a.shares), 0);
      if (Math.abs(resolvedValue(event.poolSize) - optionSum) > SHARE_TOLERANCE) {
        issues.push({
          severity: 'error',
          code: 'option_pool_size_mismatch',
          message: `"${event.label}" のオプションプールサイズ（${resolvedValue(event.poolSize)}）がオプション割当合計（${optionSum}）と一致しません。`,
          eventId: event.id,
        });
      }
    }

    if (event.type === 'convertible_issue') {
      for (const alloc of event.allocations) {
        const shares = resolvedValue(alloc.shares);
        if (alloc.shareClass !== 'convertible') {
          issues.push({
            severity: 'error',
            code: 'convertible_issue_invalid_class',
            message: `"${event.label}" の株主「${alloc.holderId}」への割当のshareClassが「${alloc.shareClass}」です。コンバーティブル発行イベントの割当はshareClass「convertible」である必要があります。`,
            eventId: event.id,
            holderId: alloc.holderId,
          });
        } else if (shares <= 0) {
          issues.push({
            severity: 'error',
            code: 'convertible_issue_non_positive_units',
            message: `"${event.label}" の株主「${alloc.holderId}」へのコンバーティブル発行数（${shares}）は正の数である必要があります。`,
            eventId: event.id,
            holderId: alloc.holderId,
          });
        }
      }
    }

    if (event.type === 'convertible_conversion') {
      if (event.calculationBasis && event.calculationBasis !== 'manual') {
        issues.push({
          severity: 'error',
          code: 'convertible_conversion_non_manual_basis',
          message: `"${event.label}" はコンバーティブル転換イベントのため、calculationBasisはmanual（または未設定）である必要があります。現在の設定「${event.calculationBasis}」のままderiveを実行すると、増資イベント向けの評価額・株価算出ロジックが転換の消込・発行に誤って適用されます。株数・金額をすべて手動入力し、calculationBasisをmanualにしてください。`,
          eventId: event.id,
        });
      }
      const hasConvertibleConsumption = event.allocations.some(
        (a) => a.shareClass === 'convertible' && resolvedValue(a.shares) < 0,
      );
      if (!hasConvertibleConsumption) {
        issues.push({
          severity: 'error',
          code: 'convertible_conversion_missing_consumption',
          message: `"${event.label}" にコンバーティブルを消込む（マイナスの）割当がありません。転換イベントは既存のコンバーティブル残高を消込む必要があります。`,
          eventId: event.id,
        });
      }
      const hasIssuedNonDilutive = event.allocations.some(
        (a) => !isDilutiveClass(a.shareClass) && resolvedValue(a.shares) > 0,
      );
      if (!hasIssuedNonDilutive) {
        issues.push({
          severity: 'error',
          code: 'convertible_conversion_missing_issuance',
          message: `"${event.label}" に転換後の株式（普通株式・優先株式等）への正の割当がありません。`,
          eventId: event.id,
        });
      }
    }

    if (event.type === 'secondary') {
      const sellerAmount = event.allocations
        .filter((a) => resolvedValue(a.shares) < 0)
        .reduce((sum, a) => sum + Math.abs(resolvedValue(a.amount)), 0);
      const buyerAmount = event.allocations
        .filter((a) => resolvedValue(a.shares) > 0)
        .reduce((sum, a) => sum + Math.abs(resolvedValue(a.amount)), 0);
      if (Math.abs(sellerAmount - buyerAmount) > YEN_TOLERANCE) {
        issues.push({
          severity: 'error',
          code: 'secondary_amount_mismatch',
          message: `"${event.label}" の譲渡人受取額（${sellerAmount}円）と譲受人支払額（${buyerAmount}円）が一致しません。`,
          eventId: event.id,
        });
      }
    }
  }

  const snapshots = recalculateCapTable(plan);
  for (const snap of snapshots) {
    let issuedSum = 0;
    let dilutedSum = 0;
    let issuedPctSum = 0;
    let dilutedPctSum = 0;
    for (const h of snap.holders) {
      if (h.issuedShares < 0) {
        issues.push({
          severity: 'error',
          code: 'negative_issued_shares',
          message: `株主「${h.holderId}」の発行済株式数がイベント "${snap.eventLabel}" 後にマイナス（${h.issuedShares}）になっています。`,
          eventId: snap.eventId,
          holderId: h.holderId,
        });
      }
      if (h.fullyDilutedShares < 0) {
        issues.push({
          severity: 'error',
          code: 'negative_diluted_shares',
          message: `株主「${h.holderId}」の完全希薄化後株式数がイベント "${snap.eventLabel}" 後にマイナスになっています。`,
          eventId: snap.eventId,
          holderId: h.holderId,
        });
      }
      if (!Number.isInteger(h.issuedShares)) {
        issues.push({
          severity: 'error',
          code: 'non_integer_issued_shares',
          message: `株主「${h.holderId}」の発行済株式数（${h.issuedShares}）が整数ではありません（イベント "${snap.eventLabel}"）。`,
          eventId: snap.eventId,
          holderId: h.holderId,
        });
      }
      if (!Number.isInteger(h.fullyDilutedShares)) {
        issues.push({
          severity: 'error',
          code: 'non_integer_diluted_shares',
          message: `株主「${h.holderId}」の完全希薄化後株式数（${h.fullyDilutedShares}）が整数ではありません（イベント "${snap.eventLabel}"）。`,
          eventId: snap.eventId,
          holderId: h.holderId,
        });
      }
      issuedSum += h.issuedShares;
      dilutedSum += h.fullyDilutedShares;
      issuedPctSum += h.issuedPercentage;
      dilutedPctSum += h.fullyDilutedPercentage;
    }

    if (snap.totalIssuedShares !== issuedSum) {
      issues.push({
        severity: 'error',
        code: 'issued_shares_sum_mismatch',
        message: `イベント "${snap.eventLabel}" の発行済株式数合計（${snap.totalIssuedShares}）が株主別合計（${issuedSum}）と一致しません。`,
        eventId: snap.eventId,
      });
    }

    if (snap.totalIssuedShares > 0 && Math.abs(issuedPctSum - 1) > PCT_TOLERANCE) {
      issues.push({
        severity: 'error',
        code: 'issued_percentage_sum_mismatch',
        message: `イベント "${snap.eventLabel}" の発行済株式比率の合計が100%になっていません（合計 ${(issuedPctSum * 100).toFixed(4)}%）。`,
        eventId: snap.eventId,
      });
    }
    if (snap.totalFullyDilutedShares > 0 && Math.abs(dilutedPctSum - 1) > PCT_TOLERANCE) {
      issues.push({
        severity: 'error',
        code: 'diluted_percentage_sum_mismatch',
        message: `イベント "${snap.eventLabel}" の完全希薄化後比率の合計が100%になっていません（合計 ${(dilutedPctSum * 100).toFixed(4)}%）。`,
        eventId: snap.eventId,
      });
    }
  }

  return issues;
}

export function hasBlockingErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}

// ---------------------------------------------------------------------------
// Reverse solvers
// ---------------------------------------------------------------------------

/**
 * Solve for required new-money investment amount given a target post-round
 * fully diluted ownership percentage for the investor, at a given pre-money
 * valuation. Standard formula: investment = targetPct * preMoney / (1 - targetPct).
 */
export function solveInvestmentForTargetOwnership(params: {
  preMoneyValuation: number;
  targetOwnershipPercentage: number; // 0..1, post-round fully diluted
}): number {
  const { preMoneyValuation, targetOwnershipPercentage } = params;
  if (targetOwnershipPercentage <= 0 || targetOwnershipPercentage >= 1) {
    throw new Error('目標保有比率は0より大きく1未満で指定してください。');
  }
  if (preMoneyValuation < 0) {
    throw new Error('プレマネー評価額は0以上で指定してください。');
  }
  return (targetOwnershipPercentage * preMoneyValuation) / (1 - targetOwnershipPercentage);
}

/**
 * Solve for the pre-money valuation implied by a fixed investment amount and
 * a target post-round fully diluted ownership percentage for the investor.
 * postMoney = investment / targetPct; preMoney = postMoney - investment.
 */
export function solvePreMoneyForTargetOwnership(params: {
  investmentAmount: number;
  targetOwnershipPercentage: number; // 0..1, post-round fully diluted
}): number {
  const { investmentAmount, targetOwnershipPercentage } = params;
  if (targetOwnershipPercentage <= 0 || targetOwnershipPercentage >= 1) {
    throw new Error('目標保有比率は0より大きく1未満で指定してください。');
  }
  if (investmentAmount < 0) {
    throw new Error('投資金額は0以上で指定してください。');
  }
  const postMoney = investmentAmount / targetOwnershipPercentage;
  return postMoney - investmentAmount;
}

/**
 * Given pre-money valuation and total pre-round fully diluted shares, derive
 * the price per share to be used for a new equity issue.
 */
export function priceFromPreMoney(preMoneyValuation: number, preRoundFullyDilutedShares: number): number {
  if (preRoundFullyDilutedShares <= 0) {
    throw new Error('ラウンド前の完全希薄化後株式数は正の数である必要があります。');
  }
  return preMoneyValuation / preRoundFullyDilutedShares;
}

/**
 * Given investment amount and price per share, derive the number of new
 * shares to allocate to the investor.
 */
export function sharesFromInvestment(investmentAmount: number, pricePerShare: number): number {
  if (pricePerShare <= 0) {
    throw new Error('1株あたり価格は正の数である必要があります。');
  }
  return investmentAmount / pricePerShare;
}

// ---------------------------------------------------------------------------
// Visible share rounding disclosure
// ---------------------------------------------------------------------------

export interface ShareRoundingDisclosure {
  rawShares: number;
  roundedShares: number;
  /** roundedShares - rawShares; the amount the visible integer share count deviates from the exact calculation. */
  roundingDelta: number;
}

/** Rounds a raw (fractional) share count to the nearest whole share for display, and discloses the delta. */
export function discloseShareRounding(rawShares: number): ShareRoundingDisclosure {
  const roundedShares = Math.round(rawShares);
  return { rawShares, roundedShares, roundingDelta: roundedShares - rawShares };
}

// ---------------------------------------------------------------------------
// Derivation engine: replay events in order, materializing calculated fields
// ---------------------------------------------------------------------------

/**
 * Materializes a TRUE DERIVED OUTPUT field: a value that is always fully
 * determined by the event's other inputs under the active calculationBasis
 * (e.g. allocation price/shares solved from amount, or an event summary
 * total rolled up from allocations). Such a field can never legitimately
 * stay stale just because it was once imported/confirmed/typed as input —
 * only an explicit override should survive a derive. So: if the current
 * source is 'override', the authored value is kept but its calculatedValue
 * is refreshed (drift from the current calculation stays visible via
 * collectSourceOverrides). For every other source — input, imported,
 * confirmed, calculated, or absent — the field is replaced with the fresh
 * calculated value and source 'calculated'.
 */
function materializeOutputField(current: EditableValue | undefined, calculatedValue: number): EditableValue {
  if (current && current.source === 'override') {
    return { ...current, calculatedValue };
  }
  return editableValue(calculatedValue, 'calculated');
}

/** Sum of positive, non-dilutive (issued) allocation shares: the "new shares" total for a manual-basis event. */
function manualNewShares(event: CapitalEvent): number {
  return event.allocations.reduce((sum, a) => {
    if (isDilutiveClass(a.shareClass)) return sum;
    const shares = resolvedValue(a.shares);
    return shares > 0 ? sum + shares : sum;
  }, 0);
}

/** Sum of allocation cash amounts: the "primary raise" total for a manual-basis event. */
function manualPrimaryRaise(event: CapitalEvent): number {
  return event.allocations.reduce((sum, a) => sum + (a.amount ? resolvedValue(a.amount) : 0), 0);
}

function deriveEvent(event: CapitalEvent, preRoundFd: number, preRoundHoldings: Map<string, number>): CapitalEvent {
  const basis = event.calculationBasis;
  if (!basis || basis === 'manual') {
    // Nothing drives allocation-level fields (shares/amount/pricePerShare are
    // authored as-is), but the event-level summary fields are still
    // recomputed from those allocations so editing a per-holder amount/share
    // propagates to the summary and to validation instead of leaving a stale,
    // manually-typed total behind.
    if (event.type === 'equity_issue' || event.type === 'ipo') {
      const newShares = manualNewShares(event);
      const primaryRaise = manualPrimaryRaise(event);
      const derived: CapitalEvent = {
        ...event,
        newShares: materializeOutputField(event.newShares, newShares),
        primaryRaise: materializeOutputField(event.primaryRaise, primaryRaise),
      };
      if (event.preMoneyValuation) {
        const postMoney = resolvedValue(event.preMoneyValuation) + primaryRaise;
        derived.postMoneyValuation = materializeOutputField(event.postMoneyValuation, postMoney);
      }
      return derived;
    }

    if (event.type === 'convertible_conversion') {
      return {
        ...event,
        newShares: materializeOutputField(event.newShares, manualNewShares(event)),
        // Conversions never raise new cash; lifecycle validation (not derive)
        // is responsible for checking that the consumed convertible balance
        // matches the holder's outstanding balance.
        primaryRaise: materializeOutputField(event.primaryRaise, 0),
      };
    }

    if (event.type === 'incorporation') {
      return {
        ...event,
        newShares: materializeOutputField(event.newShares, manualNewShares(event)),
      };
    }

    // option_pool (driven by poolSize, not issued newShares), secondary,
    // share_split, convertible_issue: left as authored.
    return event;
  }

  if (event.type === 'convertible_conversion') {
    throw new Error(
      `"${event.label}": コンバーティブル転換イベント（convertible_conversion）はcalculationBasisをmanual（または未設定）にする必要があります。現在の設定「${basis}」では、増資イベント向けの評価額・株価算出ロジックが転換の消込・発行に誤って適用され、現金調達額（primaryRaise）やnewSharesにコンバーティブルの消込（マイナスの株数）が誤って合算・混入するおそれがあります。`,
    );
  }

  const allocations = event.allocations.map((a) => ({ ...a }));

  if (basis === 'valuation_and_investment') {
    const preMoney = resolvedValue(event.preMoneyValuation);
    const price = preRoundFd > 0 ? preMoney / preRoundFd : 0;
    if (price <= 0) {
      throw new Error(`"${event.label}": プレマネー評価額とラウンド前完全希薄化後株式数から算出した価格が0以下です。`);
    }
    let primaryRaise = 0;
    let totalNewShares = 0;
    for (const alloc of allocations) {
      const amount = resolvedValue(alloc.amount);
      const roundedShares = discloseShareRounding(amount / price).roundedShares;
      alloc.shares = materializeOutputField(alloc.shares, roundedShares);
      alloc.pricePerShare = materializeOutputField(alloc.pricePerShare, price);
      totalNewShares += resolvedValue(alloc.shares);
      primaryRaise += amount;
    }
    const postMoney = preMoney + primaryRaise;
    return {
      ...event,
      allocations,
      pricePerShare: materializeOutputField(event.pricePerShare, price),
      newShares: materializeOutputField(event.newShares, totalNewShares),
      primaryRaise: materializeOutputField(event.primaryRaise, primaryRaise),
      postMoneyValuation: materializeOutputField(event.postMoneyValuation, postMoney),
    };
  }

  if (basis === 'price_and_shares') {
    const eventPrice = event.pricePerShare ? resolvedValue(event.pricePerShare) : undefined;
    let primaryRaise = 0;
    let totalNewShares = 0;
    let firstAllocPrice: number | undefined;
    for (const alloc of allocations) {
      const allocPrice = alloc.pricePerShare ? resolvedValue(alloc.pricePerShare) : eventPrice;
      if (allocPrice == null || allocPrice <= 0) {
        throw new Error(`"${event.label}": 割当「${alloc.holderId}」の価格が指定されていません。`);
      }
      firstAllocPrice ??= allocPrice;
      const shares = resolvedValue(alloc.shares);
      const amount = shares * allocPrice;
      alloc.amount = materializeOutputField(alloc.amount, amount);
      totalNewShares += shares;
      primaryRaise += amount;
    }
    const price = eventPrice ?? firstAllocPrice ?? 0;
    const preMoney = price * preRoundFd;
    const postMoney = preMoney + primaryRaise;
    return {
      ...event,
      allocations,
      newShares: materializeOutputField(event.newShares, totalNewShares),
      primaryRaise: materializeOutputField(event.primaryRaise, primaryRaise),
      preMoneyValuation: materializeOutputField(event.preMoneyValuation, preMoney),
      postMoneyValuation: materializeOutputField(event.postMoneyValuation, postMoney),
    };
  }

  if (basis === 'ownership_target') {
    const preMoney = resolvedValue(event.preMoneyValuation);
    const price = preRoundFd > 0 ? preMoney / preRoundFd : 0;
    if (price <= 0) {
      throw new Error(`"${event.label}": プレマネー評価額とラウンド前完全希薄化後株式数から算出した価格が0以下です。`);
    }

    // Aggregate target ownership % by holder (simultaneous solve). A holder with
    // more than one target row in the same event is rejected as ambiguous rather
    // than silently summed/overwritten.
    const targetByHolder = new Map<string, number>();
    for (const a of allocations) {
      if (a.targetOwnershipPercentage == null) continue;
      if (targetByHolder.has(a.holderId)) {
        throw new Error(
          `"${event.label}": 株主「${a.holderId}」に対する目標保有比率の割当が複数行あり、一意に解決できません。`,
        );
      }
      targetByHolder.set(a.holderId, resolvedValue(a.targetOwnershipPercentage));
    }

    const totalTarget = [...targetByHolder.values()].reduce((sum, t) => sum + t, 0);
    if (!Number.isFinite(totalTarget) || totalTarget >= 1) {
      throw new Error(
        `"${event.label}": 目標保有比率の合計（${(totalTarget * 100).toFixed(2)}%）が100%以上で、達成不可能な組み合わせです。`,
      );
    }

    // Allocations without a target are fixed same-round allocations: their shares
    // are authored inputs, not solved, but they still count toward post-round FD
    // shares and toward a target holder's own post-round total if they also have
    // a fixed row in this same event.
    let fixedNewShares = 0;
    let fixedPrimaryRaise = 0;
    const ownFixedByHolder = new Map<string, number>();
    for (const a of allocations) {
      if (a.targetOwnershipPercentage != null) continue;
      const shares = resolvedValue(a.shares);
      fixedNewShares += shares;
      fixedPrimaryRaise += a.amount ? resolvedValue(a.amount) : 0;
      ownFixedByHolder.set(a.holderId, (ownFixedByHolder.get(a.holderId) ?? 0) + shares);
    }

    // Target means each holder's TOTAL post-round fully diluted ownership,
    // including pre-round holdings and any fixed same-round allocations to them.
    // Solve postRoundFd from: postRoundFd = preRoundFd + fixedNewShares
    //   + sum_h(target_h * postRoundFd - preH_h - ownFixed_h)
    let sumPreHoldingsTarget = 0;
    let sumOwnFixedTarget = 0;
    for (const holderId of targetByHolder.keys()) {
      sumPreHoldingsTarget += preRoundHoldings.get(holderId) ?? 0;
      sumOwnFixedTarget += ownFixedByHolder.get(holderId) ?? 0;
    }

    const postRoundFd =
      (preRoundFd + fixedNewShares - sumPreHoldingsTarget - sumOwnFixedTarget) / (1 - totalTarget);
    if (!Number.isFinite(postRoundFd) || postRoundFd < 0) {
      throw new Error(`"${event.label}": 目標保有比率からラウンド後完全希薄化後株式数を算出できませんでした。`);
    }

    let primaryRaise = fixedPrimaryRaise;
    let totalNewShares = fixedNewShares;
    for (const alloc of allocations) {
      if (alloc.targetOwnershipPercentage == null) continue;
      const target = targetByHolder.get(alloc.holderId)!;
      const preH = preRoundHoldings.get(alloc.holderId) ?? 0;
      const ownFixed = ownFixedByHolder.get(alloc.holderId) ?? 0;
      const rawShares = target * postRoundFd - preH - ownFixed;
      if (!Number.isFinite(rawShares) || rawShares < 0) {
        throw new Error(
          `"${event.label}": 株主「${alloc.holderId}」の目標保有比率から算出した新規発行株式数が負またはNaNになりました（既存保有・同ラウンド確定割当を含めると達成不可能です）。`,
        );
      }
      const roundedShares = discloseShareRounding(rawShares).roundedShares;
      alloc.shares = materializeOutputField(alloc.shares, roundedShares);
      const amount = roundedShares * price;
      alloc.amount = materializeOutputField(alloc.amount, amount);
      alloc.pricePerShare = materializeOutputField(alloc.pricePerShare, price);
      totalNewShares += roundedShares;
      primaryRaise += amount;
    }
    const postMoney = preMoney + primaryRaise;
    return {
      ...event,
      allocations,
      pricePerShare: materializeOutputField(event.pricePerShare, price),
      newShares: materializeOutputField(event.newShares, totalNewShares),
      primaryRaise: materializeOutputField(event.primaryRaise, primaryRaise),
      postMoneyValuation: materializeOutputField(event.postMoneyValuation, postMoney),
    };
  }

  return event;
}

/**
 * Replays a plan's events in order, materializing every true derived output
 * field (allocation/event fields fully determined by the event's other
 * inputs under its calculationBasis) with a fresh calculated value,
 * regardless of whether its prior source was input/imported/confirmed/
 * calculated/absent — only an explicit override survives, with its
 * calculatedValue refreshed. Downstream events see the derived (not
 * authored) upstream share totals, so editing one round's inputs propagates
 * through all later rounds without manually rebuilding them.
 */
export function deriveCapitalPlan(plan: CapitalPlan): CapitalPlan {
  const events = sortedEvents(plan);
  const issued = new Map<string, number>();
  const diluted = new Map<string, number>();
  const derivedEvents: CapitalEvent[] = [];

  for (const event of events) {
    if (event.type === 'share_split') {
      const ratio = resolvedValue(event.splitRatio) || 1;
      for (const [holderId, shares] of issued) issued.set(holderId, shares * ratio);
      for (const [holderId, shares] of diluted) diluted.set(holderId, shares * ratio);
    }

    const preRoundFd = sumMap(diluted);
    const derivedEvent = deriveEvent(event, preRoundFd, diluted);

    for (const alloc of derivedEvent.allocations) {
      const delta = resolvedValue(alloc.shares);
      if (!isDilutiveClass(alloc.shareClass)) {
        issued.set(alloc.holderId, (issued.get(alloc.holderId) ?? 0) + delta);
      }
      diluted.set(alloc.holderId, (diluted.get(alloc.holderId) ?? 0) + delta);
    }

    derivedEvents.push(derivedEvent);
  }

  return { ...plan, events: derivedEvents };
}

export interface SafeDeriveResult {
  plan: CapitalPlan;
  error?: string;
}

/**
 * Wraps deriveCapitalPlan so a mid-edit invalid input (e.g. an incomplete
 * valuation event) never crashes the UI: on derive error, returns the
 * authored plan unchanged plus a Japanese error message for display.
 */
export function safeDeriveCapitalPlan(plan: CapitalPlan): SafeDeriveResult {
  try {
    return { plan: deriveCapitalPlan(plan) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { plan, error: `資本プランの自動算出でエラーが発生しました: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// Publish eligibility
// ---------------------------------------------------------------------------

export interface PublishEligibility {
  eligible: boolean;
  blockingIssues: ValidationIssue[];
  warnings: ValidationIssue[];
}

/**
 * 設立からIPOまでの資本政策としての提出完全性を検証する。個々の数値整合性は
 * validateCapitalPlan が担うが、この関数は「VC提出/凍結できる状態か」という
 * ドキュメント全体の完全性（株主名・先頭が設立・末尾がIPO・日付/ラベル・
 * 増資イベントの主要項目が解決済みか等）を検証する。将来ラウンド（planned）は
 * 許容される。
 */
/** Strict YYYY-MM-DD check: rejects malformed strings and calendar overflow (e.g. 2024-02-30). */
function isValidIsoDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function validateSubmissionCompleteness(plan: CapitalPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const events = sortedEvents(plan);

  const unnamedHolders = plan.holders.filter((h) => !h.name || h.name.trim().length === 0);
  if (unnamedHolders.length > 0) {
    issues.push({
      severity: 'error',
      code: 'submission_no_named_holder',
      message: `氏名/名称が未入力の株主があります（株主ID: ${unnamedHolders.map((h) => h.id).join('、')}）。提出前にすべての株主の名前を入力してください。`,
    });
  }

  if (events.length === 0) {
    issues.push({
      severity: 'error',
      code: 'submission_no_events',
      message: '資本イベントが1件も登録されていません。設立からIPOまでの資本イベントを入力してください。',
    });
    return issues;
  }

  const firstEvent = events[0];
  if (firstEvent.type !== 'incorporation') {
    issues.push({
      severity: 'error',
      code: 'submission_first_event_not_incorporation',
      message: `最初のイベント（順序 ${firstEvent.order}）は"${firstEvent.label}"ですが、資本政策の起点として設立（incorporation）イベントである必要があります。`,
      eventId: firstEvent.id,
    });
  } else {
    const hasFounderAllocation = firstEvent.allocations.some(
      (a) => !isDilutiveClass(a.shareClass) && resolvedValue(a.shares) > 0,
    );
    if (!hasFounderAllocation) {
      issues.push({
        severity: 'error',
        code: 'submission_incorporation_missing_founder_allocation',
        message: `設立イベント"${firstEvent.label}"に創業株主への正の株式割当がありません。`,
        eventId: firstEvent.id,
      });
    }
  }

  const lastEvent = events[events.length - 1];
  if (lastEvent.type !== 'ipo') {
    issues.push({
      severity: 'error',
      code: 'submission_last_event_not_ipo',
      message: `最後のイベント（順序 ${lastEvent.order}）は"${lastEvent.label}"ですが、資本政策の終点としてIPOイベントである必要があります。`,
      eventId: lastEvent.id,
    });
  }

  let lastDatedEvent: { date: string; label: string; order: number } | undefined;
  for (const event of events) {
    if (!event.label || event.label.trim().length === 0) {
      issues.push({
        severity: 'error',
        code: 'submission_event_missing_label',
        message: `順序 ${event.order} のイベントにラベルが設定されていません。`,
        eventId: event.id,
      });
    }
    if (!event.date || event.date.trim().length === 0) {
      issues.push({
        severity: 'error',
        code: 'submission_event_missing_date',
        message: `イベント"${event.label}"に日付が設定されていません。`,
        eventId: event.id,
      });
    } else if (!isValidIsoDate(event.date)) {
      issues.push({
        severity: 'error',
        code: 'submission_event_invalid_date',
        message: `イベント"${event.label}"の日付（${event.date}）がYYYY-MM-DD形式の有効な暦日になっていません。`,
        eventId: event.id,
      });
    } else {
      if (lastDatedEvent && event.date < lastDatedEvent.date) {
        issues.push({
          severity: 'error',
          code: 'submission_event_date_out_of_order',
          message: `イベント"${event.label}"（順序 ${event.order}、日付 ${event.date}）が、先行するイベント"${lastDatedEvent.label}"（順序 ${lastDatedEvent.order}、日付 ${lastDatedEvent.date}）より日付が早くなっています。イベントの日付は順序どおり前後しないように設定してください（同日は許容されます）。`,
          eventId: event.id,
        });
      } else {
        lastDatedEvent = { date: event.date, label: event.label, order: event.order };
      }
    }

    if (event.type === 'equity_issue' || event.type === 'ipo') {
      if (event.allocations.length === 0) {
        issues.push({
          severity: 'error',
          code: 'submission_financing_missing_allocations',
          message: `増資イベント"${event.label}"に割当がありません。`,
          eventId: event.id,
        });
      }
      const allKeyFieldsResolved =
        resolvedValue(event.preMoneyValuation) > 0 &&
        resolvedValue(event.postMoneyValuation) > 0 &&
        resolvedValue(event.pricePerShare) > 0 &&
        resolvedValue(event.primaryRaise) > 0 &&
        resolvedValue(event.newShares) > 0;
      if (!allKeyFieldsResolved) {
        issues.push({
          severity: 'error',
          code: 'submission_financing_incomplete',
          message: `増資イベント"${event.label}"のプレマネー評価額・ポストマネー評価額・1株あたり価格・調達額・新規発行株式数のいずれかが未確定です。calculationBasisを設定してderiveを実行するか、これらの項目をすべて手動入力してから提出してください。`,
          eventId: event.id,
        });
      }
    }
  }

  return issues;
}

export function checkPublishEligibility(plan: CapitalPlan): PublishEligibility {
  const issues = [...validateCapitalPlan(plan), ...validateSubmissionCompleteness(plan)];
  const blockingIssues = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const hasEvents = plan.events.length > 0;
  const hasHolders = plan.holders.length > 0;

  if (!hasHolders) {
    blockingIssues.push({
      severity: 'error',
      code: 'no_holders',
      message: 'プランに株主が登録されていません。',
    });
  }
  if (!hasEvents) {
    blockingIssues.push({
      severity: 'error',
      code: 'no_events',
      message: 'プランに資本イベントが登録されていません。',
    });
  }

  return {
    eligible: blockingIssues.length === 0,
    blockingIssues,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Scenario comparison
// ---------------------------------------------------------------------------

export interface ScenarioHolderComparison {
  holderId: string;
  baseIssuedPercentage: number;
  scenarioIssuedPercentage: number;
  issuedPercentageDelta: number;
  baseFullyDilutedPercentage: number;
  scenarioFullyDilutedPercentage: number;
  fullyDilutedPercentageDelta: number;
}

export interface ScenarioComparison {
  baseTotalFullyDilutedShares: number;
  scenarioTotalFullyDilutedShares: number;
  holders: ScenarioHolderComparison[];
}

/** Compares final standings between two plans (e.g. a base plan and a "what-if" variant). */
export function compareScenarios(basePlan: CapitalPlan, scenarioPlan: CapitalPlan): ScenarioComparison {
  const baseSnap = latestSnapshot(recalculateCapTable(basePlan));
  const scenarioSnap = latestSnapshot(recalculateCapTable(scenarioPlan));

  const holderIds = new Set<string>([
    ...(baseSnap?.holders.map((h) => h.holderId) ?? []),
    ...(scenarioSnap?.holders.map((h) => h.holderId) ?? []),
  ]);

  const holders: ScenarioHolderComparison[] = [...holderIds].map((holderId) => {
    const base = holderStandingAt(baseSnap, holderId);
    const scenario = holderStandingAt(scenarioSnap, holderId);
    const baseIssuedPct = base?.issuedPercentage ?? 0;
    const scenarioIssuedPct = scenario?.issuedPercentage ?? 0;
    const baseDilutedPct = base?.fullyDilutedPercentage ?? 0;
    const scenarioDilutedPct = scenario?.fullyDilutedPercentage ?? 0;
    return {
      holderId,
      baseIssuedPercentage: baseIssuedPct,
      scenarioIssuedPercentage: scenarioIssuedPct,
      issuedPercentageDelta: scenarioIssuedPct - baseIssuedPct,
      baseFullyDilutedPercentage: baseDilutedPct,
      scenarioFullyDilutedPercentage: scenarioDilutedPct,
      fullyDilutedPercentageDelta: scenarioDilutedPct - baseDilutedPct,
    };
  });

  return {
    baseTotalFullyDilutedShares: baseSnap?.totalFullyDilutedShares ?? 0,
    scenarioTotalFullyDilutedShares: scenarioSnap?.totalFullyDilutedShares ?? 0,
    holders,
  };
}

// ---------------------------------------------------------------------------
// Source override metadata
// ---------------------------------------------------------------------------

const EVENT_OVERRIDE_FIELDS = [
  'preMoneyValuation',
  'postMoneyValuation',
  'pricePerShare',
  'splitRatio',
  'poolSize',
  'conversionCap',
  'conversionDiscount',
  'primaryRaise',
  'newShares',
] as const;

const ALLOCATION_OVERRIDE_FIELDS = ['shares', 'amount', 'pricePerShare', 'targetOwnershipPercentage'] as const;

export interface SourceOverrideEntry {
  eventId: string;
  eventLabel: string;
  /** Allocation id, when the override lives on an allocation rather than the event itself. */
  allocationId?: string;
  holderId?: string;
  field: string;
  value: number;
  calculatedValue?: number;
  note?: string;
}

/**
 * 手動上書き（source === 'override'）が付いているすべての値を、イベント/割当を横断して
 * 一覧化する。UI やレポートで「どの値が自動算出から上書きされたか」を確認・テストするための
 * queryable な入口。
 */
export function collectSourceOverrides(plan: CapitalPlan): SourceOverrideEntry[] {
  const entries: SourceOverrideEntry[] = [];

  for (const event of sortedEvents(plan)) {
    for (const field of EVENT_OVERRIDE_FIELDS) {
      const editable = event[field] as EditableValue | undefined;
      if (editable && editable.source === 'override') {
        entries.push({
          eventId: event.id,
          eventLabel: event.label,
          field,
          value: editable.value,
          calculatedValue: editable.calculatedValue,
          note: editable.note,
        });
      }
    }

    for (const alloc of event.allocations) {
      for (const field of ALLOCATION_OVERRIDE_FIELDS) {
        const editable = alloc[field as 'shares' | 'amount' | 'pricePerShare' | 'targetOwnershipPercentage'] as
          | EditableValue
          | undefined;
        if (editable && editable.source === 'override') {
          entries.push({
            eventId: event.id,
            eventLabel: event.label,
            allocationId: alloc.id,
            holderId: alloc.holderId,
            field,
            value: editable.value,
            calculatedValue: editable.calculatedValue,
            note: editable.note,
          });
        }
      }
    }
  }

  return entries;
}
