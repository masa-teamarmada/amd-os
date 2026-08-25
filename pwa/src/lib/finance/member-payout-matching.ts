/**
 * freee の出金をメンバーへの報酬支払いへ結び付ける照合ロジック (純粋関数のみ)。
 *
 * freee API と Supabase を触る側は `member-payout-settlements.ts`。
 * ここを分けてあるのは、照合の規則を実データなしで検査できるようにするため
 * (`scripts/check_member_payout_matching.mts`)。
 */

export type FreeeExpenseDeal = {
  id?: number | string;
  partner_id?: number | string | null;
  ref_number?: string | null;
  issue_date?: string | null;
  amount?: number | string | null;
  details?: Array<{ description?: string | null }>;
  payments?: Array<{ id?: number | string; date?: string | null; amount?: number | string | null }>;
};

export type FreeeWalletTxn = {
  id?: number | string;
  date?: string | null;
  entry_side?: string | null;
  amount?: number | string | null;
  description?: string | null;
};

export type SettlementMemberRow = {
  member_id: string;
  code_name?: string | null;
  member_name?: string | null;
  contractor_name?: string | null;
};

export type SettlementNoticeRow = {
  member_id: string;
  ym: string;
  notice_no?: string | null;
  total_yen?: number | null;
  sent_at?: string | null;
  paid_on?: string | null;
};

export type TransferAliasRow = {
  alias: string;
  member_id: string;
};

export type SettlementRow = {
  source: "freee_deal" | "freee_wallet_txn";
  sourceId: string;
  paidOn: string;
  amountYen: number;
  memberId: string | null;
  memberMatchMethod: "partner_name" | "transfer_alias" | "notice_amount" | "unmatched";
  memberMatchReason: string | null;
  partnerName: string | null;
  description: string | null;
  transferName: string | null;
  noticeYm: string | null;
  noticeNo: string | null;
  noticeTotalYen: number | null;
  amountMatch: "exact" | "within_transfer_fee" | "mismatch" | "no_notice";
  confidence: "high" | "medium" | "low";
};

const TAX_RATE = 1.1;
/** 振込手数料でこの範囲まで目減りするのは同じ支払として扱う */
const TRANSFER_FEE_TOLERANCE_YEN = 1000;
/** 支払通知書の支払月から、実際の振込がこの日数まで前後するのを許す */
const NOTICE_MATCH_WINDOW_DAYS = 75;

/** 口座明細・取引先名に出る旧字体と新字体の揺れを吸収する (宮﨑/宮崎、輕部/軽部 など) */
const VARIANT_KANJI: Record<string, string> = {
  "﨑": "崎", "濵": "浜", "髙": "高", "邊": "辺", "邉": "辺", "澤": "沢",
  "齋": "斎", "齊": "斎", "輕": "軽", "眞": "真", "曾": "曽", "德": "徳",
  "瀨": "瀬", "增": "増", "淸": "清", "硏": "研", "槇": "槙", "祥": "祥",
};

export function taxIncludedYen(netYen: number): number {
  return Math.round(netYen * TAX_RATE);
}

export function normalizeName(value: unknown): string {
  const base = String(value ?? "").normalize("NFKC");
  let out = "";
  for (const char of base) out += VARIANT_KANJI[char] ?? char;
  return out
    .toLowerCase()
    // 法人格の表記は先に落とす。括弧を消したあとだと口座明細の「カ)」形が残ってしまう
    .replace(/株式会社|合同会社|有限会社|一般社団法人|合資会社/g, "")
    .replace(/[（(]?\s*(?:カ|ｶ|ユ|ﾕ|ド|ﾄﾞ|ゆ)\s*[)）]/g, "")
    .replace(/[\s　\t\r\n・,，.．、。()（）［］[\]「」『』"'’”_＿]/g, "")
    .replace(/[ｰー－\-]/g, "")
    .trim();
}

function yen(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function daysBetween(a: string, b: string): number {
  const left = Date.parse(`${a}T00:00:00Z`);
  const right = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return Number.POSITIVE_INFINITY;
  return Math.abs(left - right) / 86_400_000;
}

/** 支払月 (YYYYMM) の月末を、通知書と振込日の近さを測る基準日にする */
function noticeAnchorDate(ym: string): string {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-${String(lastDay).padStart(2, "0")}`;
}

/** 口座明細の摘要から振込先の名義だけを取り出す。「振込 カルベ　タクマ」→「カルベタクマ」 */
export function extractTransferName(description: unknown): string | null {
  const text = String(description ?? "").normalize("NFKC").trim();
  if (!text) return null;
  if (/振込手数料/.test(text)) return null;
  const match = text.match(/^振込\s*(.+)$/);
  if (!match) return null;
  const name = normalizeName(match[1]);
  return name.length >= 2 ? name : null;
}

/** 取引先名・摘要の中にメンバーの氏名または屋号が含まれるかを見る */
export function matchMemberByName(
  text: string,
  members: SettlementMemberRow[]
): { memberId: string; reason: string } | null {
  const haystack = normalizeName(text);
  if (!haystack) return null;
  let best: { memberId: string; reason: string; length: number } | null = null;
  for (const member of members) {
    const candidates: Array<{ label: string; value: string }> = [
      { label: "契約者名", value: normalizeName(member.contractor_name) },
      { label: "氏名", value: normalizeName(member.member_name) },
    ];
    for (const candidate of candidates) {
      if (candidate.value.length < 3) continue;
      if (!haystack.includes(candidate.value)) continue;
      if (!best || candidate.value.length > best.length) {
        best = {
          memberId: member.member_id,
          reason: `${candidate.label}「${candidate.value}」が取引先名・摘要に一致`,
          length: candidate.value.length,
        };
      }
    }
  }
  return best ? { memberId: best.memberId, reason: best.reason } : null;
}

function classifyAmount(amountYen: number, notice: SettlementNoticeRow | null): SettlementRow["amountMatch"] {
  if (!notice) return "no_notice";
  const expected = taxIncludedYen(yen(notice.total_yen));
  const diff = expected - amountYen;
  if (Math.abs(diff) <= 3) return "exact";
  if (diff > 0 && diff <= TRANSFER_FEE_TOLERANCE_YEN) return "within_transfer_fee";
  return "mismatch";
}

/** 金額と時期だけで、どのメンバーのどの支払通知書かを一意に決められるかを見る */
function matchNoticeByAmount(
  amountYen: number,
  paidOn: string,
  notices: SettlementNoticeRow[]
): SettlementNoticeRow | null {
  const hits = notices.filter((notice) => {
    if (classifyAmount(amountYen, notice) !== "exact") return false;
    return daysBetween(paidOn, noticeAnchorDate(notice.ym)) <= NOTICE_MATCH_WINDOW_DAYS;
  });
  // 同額の通知書が複数ある月は、どれの振込か決められないので確定しない
  return hits.length === 1 ? hits[0] : null;
}

function pickNoticeForMember(
  amountYen: number,
  paidOn: string,
  notices: SettlementNoticeRow[]
): SettlementNoticeRow | null {
  const inWindow = notices.filter(
    (notice) => daysBetween(paidOn, noticeAnchorDate(notice.ym)) <= NOTICE_MATCH_WINDOW_DAYS
  );
  const exact = inWindow.find((notice) => classifyAmount(amountYen, notice) === "exact");
  if (exact) return exact;
  const nearly = inWindow.find((notice) => classifyAmount(amountYen, notice) === "within_transfer_fee");
  if (nearly) return nearly;
  return inWindow.sort((a, b) => a.ym.localeCompare(b.ym))[0] ?? null;
}

function confidenceOf(
  method: SettlementRow["memberMatchMethod"],
  amountMatch: SettlementRow["amountMatch"]
): SettlementRow["confidence"] {
  if (method === "unmatched") return "low";
  if (amountMatch === "exact" || amountMatch === "within_transfer_fee") return "high";
  if (method === "partner_name" || method === "transfer_alias") return "medium";
  return "low";
}

type RawOutflow = {
  source: SettlementRow["source"];
  sourceId: string;
  paidOn: string;
  amountYen: number;
  partnerName: string | null;
  description: string | null;
};

/**
 * freee の出金を1件ずつの行にする。
 *
 * 口座明細 (wallet_txn) が実際の資金の動きなので、こちらを主にする。取引 (deal) は取引先名を
 * 持っているので、同じ日付・同じ金額の口座明細へ取引先名を足すためだけに使う。
 * 同じ日に同じ金額の振込が複数あっても取りこぼさないよう、口座明細は id 単位で必ず残す。
 * クレジットカード払いのように口座明細に出ない支出は、取引の支払をそのまま1行にする。
 */
export function mergeOutflows(input: {
  deals: FreeeExpenseDeal[];
  walletTxns: FreeeWalletTxn[];
  partnerNames: Map<string, string>;
}): RawOutflow[] {
  const { deals, walletTxns, partnerNames } = input;

  type DealPayment = { key: string; sourceId: string; paidOn: string; amountYen: number; partnerName: string | null; description: string | null };
  const dealPayments: DealPayment[] = [];
  for (const deal of deals) {
    const partnerName = deal.partner_id != null ? partnerNames.get(String(deal.partner_id)) || null : null;
    const detailText = (deal.details ?? []).map((detail) => detail.description).filter(Boolean).join(" ");
    const description = [detailText, deal.ref_number].filter(Boolean).join(" ") || null;
    for (const payment of deal.payments ?? []) {
      if (!payment.date) continue;
      const amountYen = yen(payment.amount);
      if (amountYen <= 0) continue;
      dealPayments.push({
        key: `${payment.date}:${amountYen}`,
        sourceId: String(payment.id ?? `${deal.id}:${payment.date}:${amountYen}`),
        paidOn: String(payment.date),
        amountYen,
        partnerName,
        description,
      });
    }
  }

  const dealsByKey = new Map<string, DealPayment[]>();
  for (const payment of dealPayments) {
    dealsByKey.set(payment.key, [...(dealsByKey.get(payment.key) ?? []), payment]);
  }

  const rows: RawOutflow[] = [];
  const consumedDealIds = new Set<string>();

  for (const txn of walletTxns) {
    if (!txn.date) continue;
    const amountYen = yen(txn.amount);
    if (amountYen <= 0) continue;
    const key = `${txn.date}:${amountYen}`;
    const candidates = (dealsByKey.get(key) ?? []).filter((payment) => !consumedDealIds.has(payment.sourceId));
    const enrichment = candidates[0] ?? null;
    if (enrichment) consumedDealIds.add(enrichment.sourceId);
    rows.push({
      source: "freee_wallet_txn",
      sourceId: String(txn.id ?? key),
      paidOn: String(txn.date),
      amountYen,
      partnerName: enrichment?.partnerName ?? null,
      description: [txn.description, enrichment?.description].filter(Boolean).join(" ") || null,
    });
  }

  for (const payment of dealPayments) {
    if (consumedDealIds.has(payment.sourceId)) continue;
    rows.push({
      source: "freee_deal",
      sourceId: payment.sourceId,
      paidOn: payment.paidOn,
      amountYen: payment.amountYen,
      partnerName: payment.partnerName,
      description: payment.description,
    });
  }

  return rows.sort((a, b) => (a.paidOn < b.paidOn ? 1 : a.paidOn > b.paidOn ? -1 : 0));
}

/**
 * 業務委託費・報酬の支払いとして数える出金かどうか。
 *
 * freee には経費の立替精算やカード決済も同じ取引先名 (メンバー本人) で載る。摘要に本人の名前が
 * 出るだけで報酬の支払いに数えると、喫茶店の 3,440 円まで「支払った」ことになってしまう。
 * 数えるのは、口座からの振込か、支払通知書の税込額と1円単位で一致する支出だけにする。
 */
function isRewardPayoutOutflow(outflow: RawOutflow, transferName: string | null, noticeExactHit: boolean): boolean {
  if (transferName) return true;
  return noticeExactHit;
}

export function buildSettlements(input: {
  outflows: RawOutflow[];
  members: SettlementMemberRow[];
  notices: SettlementNoticeRow[];
  aliases: TransferAliasRow[];
}): { settlements: SettlementRow[]; learnedAliases: Array<{ alias: string; memberId: string; rawText: string; learnedFrom: string }> } {
  const { outflows, members, notices, aliases } = input;
  const aliasMap = new Map(aliases.map((row) => [row.alias, row.member_id]));
  const noticesByMember = new Map<string, SettlementNoticeRow[]>();
  for (const notice of notices) {
    noticesByMember.set(notice.member_id, [...(noticesByMember.get(notice.member_id) ?? []), notice]);
  }
  const usedNoticeKeys = new Set<string>();
  const learnedAliases: Array<{ alias: string; memberId: string; rawText: string; learnedFrom: string }> = [];
  const settlements: SettlementRow[] = [];

  for (const outflow of outflows) {
    const transferName = extractTransferName(outflow.description);
    const searchText = [outflow.partnerName, outflow.description].filter(Boolean).join(" ");

    let memberId: string | null = null;
    let method: SettlementRow["memberMatchMethod"] = "unmatched";
    let reason: string | null = null;

    const noticeExactHit = matchNoticeByAmount(outflow.amountYen, outflow.paidOn, notices);
    if (!isRewardPayoutOutflow(outflow, transferName, Boolean(noticeExactHit))) continue;

    const byName = matchMemberByName(searchText, members);
    if (byName) {
      memberId = byName.memberId;
      method = "partner_name";
      reason = byName.reason;
    } else if (transferName && aliasMap.has(transferName)) {
      memberId = aliasMap.get(transferName) ?? null;
      method = "transfer_alias";
      reason = `学習済みの振込名義「${transferName}」に一致`;
    } else {
      const noticeHit = noticeExactHit;
      if (noticeHit) {
        memberId = noticeHit.member_id;
        method = "notice_amount";
        reason = `支払通知書 ${noticeHit.ym} の税込額と1円単位で一致`;
        if (transferName && !aliasMap.has(transferName)) {
          aliasMap.set(transferName, noticeHit.member_id);
          learnedAliases.push({
            alias: transferName,
            memberId: noticeHit.member_id,
            rawText: String(outflow.description ?? ""),
            learnedFrom: `${outflow.source}:${outflow.sourceId}`,
          });
        }
      }
    }

    if (!memberId) continue;

    const memberNotices = (noticesByMember.get(memberId) ?? []).filter(
      (notice) => !usedNoticeKeys.has(`${notice.member_id}:${notice.ym}`)
    );
    const notice = pickNoticeForMember(outflow.amountYen, outflow.paidOn, memberNotices);
    const amountMatch = classifyAmount(outflow.amountYen, notice);
    if (notice && (amountMatch === "exact" || amountMatch === "within_transfer_fee")) {
      usedNoticeKeys.add(`${notice.member_id}:${notice.ym}`);
    }

    settlements.push({
      source: outflow.source,
      sourceId: outflow.sourceId,
      paidOn: outflow.paidOn,
      amountYen: outflow.amountYen,
      memberId,
      memberMatchMethod: method,
      memberMatchReason: reason,
      partnerName: outflow.partnerName,
      description: outflow.description,
      transferName,
      noticeYm: notice?.ym ?? null,
      noticeNo: notice?.notice_no ?? null,
      noticeTotalYen: notice ? yen(notice.total_yen) : null,
      amountMatch,
      confidence: confidenceOf(method, amountMatch),
    });
  }

  return { settlements, learnedAliases };
}

