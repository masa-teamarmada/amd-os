/**
 * UI ヒント定数集 (= まさ #22 案 D 2026-05-24 確定、2026-05-25 実装着手)
 *
 * 各 UI 要素に「機能の存在 + 使い方」のヒントを付ける。
 * Hint コンポーネント (= `components/ui/Hint.tsx`) が id を key にここから description を引く。
 *
 * 追加方針:
 * - cockpit / admin / mypage の重要 UI を 30-50 個カバー
 * - title は 1 行 (= 機能名 + 1 文)
 * - body は markdown 風 (= リンク含む可)、長くて 200 字
 * - docHref は manual / design md への deep link (= /manual/... or /design/...)
 *
 * 将来: 数十個に増えたら `ui_hints` テーブル化 (案 D + B、ui_hint_tooltip.md 参照)
 */

export type UiHint = {
  id: string;
  title: string;
  body: string;
  docHref?: string;
};

export const UI_HINTS: Record<string, UiHint> = {
  // ──────────────────────────────────────
  // 経営ハイライト (= CockpitStrategySignals)
  // ──────────────────────────────────────
  "cockpit.strategy-signals.section": {
    id: "cockpit.strategy-signals.section",
    title: "経営ハイライト",
    body: "PJ にとって「進んだこと・起きたこと」だけを書く事象ログ。未了議題は別の TODO かんばんへ。4 分類 (🏛 経営全般 / 🚀 事業開発 / 🔬 技術開発 / 🌐 外部環境) で混ぜて時間軸順に並ぶ。",
    docHref: "/manual/03-data-and-extraction#19-経営ハイライト",
  },
  "cockpit.strategy-signals.category.management": {
    id: "cockpit.strategy-signals.category.management",
    title: "🏛 経営全般",
    body: "方針決定 / 戦略転換 / 資金 / 次の一手 を含む分類。violet の左ボーダー。",
  },
  "cockpit.strategy-signals.category.business": {
    id: "cockpit.strategy-signals.category.business",
    title: "🚀 事業開発",
    body: "事業進捗 / 商談・売上 / 提携 を含む分類。emerald の左ボーダー。",
  },
  "cockpit.strategy-signals.category.tech": {
    id: "cockpit.strategy-signals.category.tech",
    title: "🔬 技術開発",
    body: "自社特許出願 / 技術スタック進捗 (= 自社内の知財・技術活動)。sky の左ボーダー。外部規制動向とは別軸。",
  },
  "cockpit.strategy-signals.category.external": {
    id: "cockpit.strategy-signals.category.external",
    title: "🌐 外部環境",
    body: "他国規制動向 / 競合動向 / マクロ要因 (= PJ 外で起きた変化が PJ に影響する事象)。amber の左ボーダー。一覧正本は Atlas。",
  },
  "cockpit.strategy-signals.tsukuyomi-feedback": {
    id: "cockpit.strategy-signals.tsukuyomi-feedback",
    title: "⚠️ つくよみに修正依頼",
    body: "このシグナルの抽出に誤りや方向違いがあれば、つくよみ (LLM) に修正依頼を送る。`l2_feedbacks` に保存され、次回の抽出 routine に prompt として渡されるので、同種誤抽出を繰り返さない学習ループが回る。",
    docHref: "/manual/03-data-and-extraction#34-つくよみ修正依頼--学習ループ",
  },
  "cockpit.strategy-signals.past-feedbacks": {
    id: "cockpit.strategy-signals.past-feedbacks",
    title: "🌙 つくよみへの過去の修正依頼",
    body: "このシグナルに対して過去に送った修正依頼の履歴。`applied_count` がカウントアップしてれば次回抽出に反映済。0 なら次回 cron 待ち。",
  },
  "cockpit.strategy-signals.impact-chip": {
    id: "cockpit.strategy-signals.impact-chip",
    title: "影響度 (impact_level)",
    body: "critical = PJ 存続級 / high = 売上・法務・関係先 / medium = 運用上の重要事項 / low = 軽微。経営判断の優先順位付けに使う。",
  },

  // ──────────────────────────────────────
  // AMD スコアグラフ (= CockpitVentureStatus)
  // ──────────────────────────────────────
  "cockpit.amd-score.pill": {
    id: "cockpit.amd-score.pill",
    title: "PRS primary / legacy comparison",
    body: "cockpit では PRS を primary status として見せ、折れ線と大きい数値は legacy AMD comparison を保持する。P/R_net が無ければ primary score は出さない。",
    docHref: "/manual/03-data-and-extraction#18-xrl-根拠",
  },
  "cockpit.amd-score.future-dot": {
    id: "cockpit.amd-score.future-dot",
    title: "未来予測 (= 破線)",
    body: "現在の入力値から計算された PJ スコアの予測値。透明 hit area は実装済みだが、現状クリック時は該当日のイベント追加を開く。値そのものを修正する AmdScoreFutureEditModal は未実装。",
    docHref: "/manual/21-amd-score-spec#2111-未来予測修正と-alpha-feedback-loop",
  },
  "cockpit.amd-score.m-card": {
    id: "cockpit.amd-score.m-card",
    title: "M (Macrotrend)",
    body: "PJ が依存する Lane の外部マクロ追い風指標。0-30 範囲。Atlas 観測値 (= ASPI / 研究費 / 公募予算 / VC 投資) から構築。",
  },
  "cockpit.amd-score.x-card": {
    id: "cockpit.amd-score.x-card",
    title: "X (XRL)",
    body: "PJ の社内技術成熟度。TRL × BRL × GRL × SRL × HRL の幾何平均を 0-600 にスケール。",
  },
  "cockpit.amd-score.f-card": {
    id: "cockpit.amd-score.f-card",
    title: "F (FRL)",
    body: "Founder Resilience Level。creator/founder の grit (Duckworth 2007) と resilience (Markman 2005) の幾何平均。0-9 評価を 0-100 にスケール。",
  },

  // ──────────────────────────────────────
  // 経営ハイライト modify modal (= つくよみ修正依頼)
  // ──────────────────────────────────────
  "feedback.modal.purpose": {
    id: "feedback.modal.purpose",
    title: "つくよみ (LLM) への修正依頼",
    body: "ここに書いた内容は `l2_feedbacks` テーブルに保存 + 次回の経営ハイライト抽出 routine の prompt に注入される (= 即時反映ループ、まさ #34 2026-05-25)。「同じ誤抽出を繰り返さない」学習に直結する。",
  },

  // ──────────────────────────────────────
  // MTG サマリ (= CockpitMeetingSummary)
  // ──────────────────────────────────────
  "cockpit.meeting-summary.card": {
    id: "cockpit.meeting-summary.card",
    title: "MTG サマリ詳細",
    body: "クリックで詳細モーダル展開。議事録 narrative / 決定 / 進捗 / 次のアクション / リスク を表で見れる。dialogue = 提案前の論点整理セッション、notion / gmail / slack = 自動抽出。",
  },
  "cockpit.meeting-summary.source-link": {
    id: "cockpit.meeting-summary.source-link",
    title: "元 ↗",
    body: "Notion 議事録ページ / Gmail スレッド / Slack スレッド 等の原典ソースに遷移。",
  },

  // ──────────────────────────────────────
  // 月次カード (= CockpitMonthlyList)
  // ──────────────────────────────────────
  "cockpit.monthly-card": {
    id: "cockpit.monthly-card",
    title: "月次カード",
    body: "クリックで当月の月次モーダル展開。進捗バー / 月次報告書 / 請求書 / 報酬 の各タブを開ける。",
  },

  // ──────────────────────────────────────
  // PJ ステータス (= CockpitHeader)
  // ──────────────────────────────────────
  "cockpit.header.status.frozen": {
    id: "cockpit.header.status.frozen",
    title: "❄️ 凍結中",
    body: "PJ が freeze_from_ym 以降凍結状態。MS 進捗抽出停止。",
  },
  "cockpit.header.status.restart": {
    id: "cockpit.header.status.restart",
    title: "📅 再開予定",
    body: "restart_expected_ym 以降に PJ 再開予定。それまでは凍結扱い。",
  },
};

/**
 * Hint コンポーネントから引くためのヘルパー
 */
export function getHint(id: string): UiHint | null {
  return UI_HINTS[id] ?? null;
}
