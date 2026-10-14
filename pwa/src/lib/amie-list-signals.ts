export type AmieListTone = "progress" | "complete" | "warning" | "critical" | "neutral";

// Exact, context-independent meanings only. Unknown domain states stay neutral.
const AMIE_LIST_STATUS: Record<string, [AmieListTone, string]> = {
  active: ["progress", "稼働中"], on_track: ["progress", "順調"], running: ["progress", "実施中"], in_progress: ["progress", "進行中"],
  sales: ["progress", "営業中"], invited: ["warning", "初回ログイン待ち"], inactive: ["neutral", "休止"], suspended: ["neutral", "停止中"],
  completed: ["complete", "完了"], complete: ["complete", "完了"], done: ["complete", "完了"], paid: ["complete", "支払済み"], signed: ["complete", "締結済み"], verified: ["complete", "照合済み"], confirmed: ["complete", "確認済み"], passed: ["complete", "合格"],
  draft: ["neutral", "下書き"], planned: ["neutral", "計画"], not_started: ["neutral", "未着手"], unknown: ["neutral", "未確認"], unassessed: ["neutral", "未評価"], pending: ["neutral", "待機"], archived: ["neutral", "保管"], ended: ["neutral", "終了"], frozen: ["neutral", "凍結"], cancelled: ["neutral", "取消"],
  attention: ["warning", "注意"], at_risk: ["warning", "遅れ懸念"], overdue: ["warning", "期限超過"], needs_review: ["warning", "要確認"], awaiting_approval: ["warning", "承認待ち"],
  failed: ["critical", "失敗"], error: ["critical", "エラー"], blocked: ["critical", "停止"], lost: ["critical", "失注"],
  connected: ["progress", "接続中"], approved: ["complete", "承認済み"], rejected: ["critical", "却下"], reviewing: ["progress", "確認中"],
  ready: ["progress", "準備済み"], missing: ["neutral", "未登録"],
};
export function amieKnownListStatusLabel(value: string): boolean {
  return Object.hasOwn(AMIE_LIST_STATUS,value) || Object.hasOwn(AMIE_LIST_LABEL_TONE,value);
}
const AMIE_LIST_LABEL_TONE: Record<string, AmieListTone> = {
  "完了":"complete", "支払済み":"complete", "締結済み":"complete", "確認済み":"complete", "承認済み":"complete", "照合済み":"complete", "合格":"complete", "回答済み":"complete", "解消済み":"complete", "公開済み":"complete",
  "進行中":"progress", "稼働中":"progress", "実施中":"progress", "試験中":"progress", "順調":"progress", "営業中":"progress", "募集中":"progress", "投資中":"progress", "候補探索中":"progress", "検討中":"progress", "確認中":"progress", "作成中":"progress",
  "要確認":"warning", "注意":"warning", "遅れ懸念":"warning", "期限超過":"warning", "承認待ち":"warning", "締結版照合待ち":"warning", "初回ログイン待ち":"warning", "準備不足":"warning", "一部不足":"warning",
  "停止":"critical", "失敗":"critical", "不合格":"critical", "エラー":"critical", "却下":"critical", "失注":"critical",
  "未確認":"neutral", "未評価":"neutral", "未登録":"neutral", "進捗未登録":"neutral", "不明":"neutral", "未接触":"neutral", "見送り":"neutral", "辞退":"neutral", "対象外":"neutral",
  "未合意":"warning", "条件更新あり":"warning", "修正要望中":"warning", "未整備":"warning", "差戻し":"warning", "変更あり・再申請":"warning",
  "合意済":"complete", "着金確認":"complete", "報酬支払済":"complete", "整備済み":"complete", "投資済":"complete", "クローズ済":"complete",
  "報告済":"progress", "予算確定":"progress", "請求書送付":"progress", "実行中":"progress", "1st クローズ":"progress", "ファイナルクローズ":"progress", "ハーベスト":"progress", "ピッチ中":"progress", "DD 中":"progress", "ターム協議":"progress",
  "重大リスク":"critical", "重大":"critical", "不採択":"critical", "検算失敗":"critical", "保存不可":"critical",
  "対応中":"progress", "検証中":"progress", "双方で対応":"progress", "先方ボール":"progress", "受給中":"progress", "申請中":"progress", "コミット":"progress", "保存中":"progress", "保存前検算中":"progress",
  "AMD側ボール":"warning", "停滞":"warning", "現在地を確認":"warning", "根拠不足":"warning", "正本の鮮度要確認":"warning", "再生成待ち":"warning", "ルール再確認":"warning", "未保存あり":"warning", "検算OK・精算あり":"warning",
  "採択":"complete", "クローズ":"complete", "決定済み":"complete", "検算OK":"complete", "変更なし":"neutral", "一旦停止":"neutral", "相手待ち":"neutral", "確認待ち":"neutral", "保留":"neutral", "延期":"neutral",
};
export const AMIE_LIST_STATUS_MARK: Record<AmieListTone, string> = { progress: "▶", complete: "✓", warning: "!", critical: "×", neutral: "−" };

export function amieListStatus(value: string | null | undefined, label?: string | null, tone?: AmieListTone) {
  const known = AMIE_LIST_STATUS[value ?? ""];
  const resolvedTone = tone ?? AMIE_LIST_LABEL_TONE[label ?? value ?? ""] ?? known?.[0] ?? "neutral";
  const resolvedLabel = label ?? known?.[1] ?? (value || "未確認");
  return { tone: resolvedTone, label: resolvedLabel, mark: ["未確認","未評価","未設定","未登録"].includes(resolvedLabel) ? "?" : AMIE_LIST_STATUS_MARK[resolvedTone] };
}

export function amieListCategoryTone(value: string | null | undefined): "sky" | "violet" | "indigo" | "cyan" | "neutral" {
  if (!value || ["—", "未分類", "未設定", "未確認"].includes(value)) return "neutral";
  let hash = 0;
  for (const character of value.normalize("NFKC")) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  return (["sky", "violet", "indigo", "cyan"] as const)[hash % 4];
}

export function amieListDelta(value: number | null | undefined, positiveMeaning: "increase" | "improve" | "worsen" = "increase") {
  if (value == null || !Number.isFinite(value)) return { direction: "unknown", mark: "—", tone: "neutral" as AmieListTone };
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const tone: AmieListTone = value === 0 || positiveMeaning === "increase" ? "neutral" : (value > 0) === (positiveMeaning === "improve") ? "complete" : "warning";
  return { direction, mark: value > 0 ? "↑" : value < 0 ? "↓" : "→", tone };
}
