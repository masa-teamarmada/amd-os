# L2データリスト

> **この章は何か**: AMD OS が中核データとして扱う L2 ①〜⑯ の正本リスト。開発に携わっていないメンバーも、まずこの章で「どのデータが何のためにあるか」を掴む。

L2 は、メール・議事録・Slack・外部ニュース・freee・予実表などの素材を、AMD OS が経営判断やPJ運営に使える形へ整理したデータ。

## L2データ16種（正本リスト）

`マシン` は、そのL2を実際に発火・生成する場所。`cron名` は、運用者が履歴や設定で探す名前。PWA cron だけでなく、Codex automation 名もここに含める。

| L2 | 名前 | 何を残すか | 主な使い道 | マシン | cron名 | タイミング |
|---|---|---|---|---|---|---|
| ① | Monthly Reports | PJごとの月次報告書 | 月次振り返り、次月方針、XRL監査の土台 | Codex / subscription automation + local applier | `AMD OS L2① 月次報告抽出` / `amd-os-l1-monthly-report-extract` | 月末最終日 |
| ② | AMD Protocol | 経営判断の型、判断材料、打ち手 | AMDの知財化、次の意思決定の参照 | Codex / subscription automation | `amd-os-l2-consolidated-evidence` | daily 08:00 JST |
| ③ | MS進捗 | マイルストーンの進捗率・月次ノート | PJ cockpit、報酬・進捗レビュー | MMOマシン Codex Desktop | `amd-os-l3-ms-progress-extract` | 毎時0分 |
| ④ | PJナレッジ | PJに関する人物・技術・組織・市場の事実 | PJ理解、引き継ぎ、提案準備 | Codex / subscription automation | `amd-os-l2-consolidated-evidence` | daily 08:00 JST |
| ⑤ | メンバーナレッジ | メンバーの強み、関心、働き方、活動傾向 | 配置、評価、mypage、メンバー理解 | Codex / subscription automation | `amd-os-l2-consolidated-evidence` | daily 08:00 JST |
| ⑥ | MTGサマリ + MTGフロー | 会議ごとの決定事項・進捗・次アクション・リスク | Cockpit、次MTG準備、タスク化 | MMOマシン Codex Desktop | `amd-os-l6-meeting-flow` | 毎日09:00-21:00 毎時 |
| ⑦ | OS台帳差分 | PJメンバー、関係先、契約、担当、期間などのOS反映候補 | 台帳の自己修復、設定漏れ検知 | Codex / subscription automation + local applier | `amd-os-l2-consolidated-evidence` / `amd-os-l7-registry-diff-extract` | daily 08:00 JST |
| ⑧ | XRLチェックリスト監査 | TRL / BRL / GRL / SRL / HRLのチェック項目充足 | AMD ScoreのXRL更新 | Codex / subscription automation + review | `L2⑧ XRL checklist audit` | 月末L2①後 |
| ⑨ | 経営ハイライト | 重要な方針転換、事業進捗、提携、リスク、次の一手 | PJ cockpit、司令塔判断 | Codex / subscription automation + local applier | `amd-os-l2-consolidated-evidence` / `amd-os-l9-strategy-signal-extract` | daily 08:00 JST |
| ⑩ | Textbook Insights | Before Zero / BZM教科書へ追記すべき実務知見 | 教科書・論文化・知財化 | Codex / subscription automation + local BZM applier | `amd-os-l2-consolidated-evidence` / `amd-os-l10-textbook-insight-extract` | daily 08:00 JST、承認後は手動applier |
| ⑪ | Atlas Signals | 外部ニュース・政策・市場・技術シグナル | Atlas、戦略判断、macro解釈 | Codex / subscription automation + Atlas outbox/applier | `amd-os-l2-consolidated-evidence` / `AMD Atlas外部シグナルレビュー` | daily 08:00-08:10 JST |
| ⑫ | Macrotrend Evidence / Index | 研究費、公募、VC投資、政策言及、外部signal countの集計 | AMD Score、Venture Map、ASPI判断 | PWA non-LLM cron + Codex evidence review | `cron/macro-aggregate-indicators` / `amd-os-l2-consolidated-evidence` | 月初04:00 JST + daily review |
| ⑬ | Member Weekly Activities | メンバーごとの週次活動 | mypage、reward、L2⑤、MS貢献レビュー | Codex / subscription automation candidate | `amd-os-l13-member-weekly-activities` candidate | weekly候補 |
| ⑭ | Finance Ops Evidence | サブスク、継続費、自動振替、領収書イベント | 月次PL、Management Score finance軸 | PWA non-LLM cron + admin review | `cron/freee-payment-sync` / `cron/payment-confirm-nudges` | daily 09:10 / 09:30 JST |
| ⑮ | VC News / Funding Signals | VCニュース、ファンド組成、投資活動、資金調達シグナル | VC inbox、fund情報、fundraising判断 | Codex / subscription automation + VC inbox | `amd-os-l2-vc-news-funding-signals` | 土曜09:00 JST |
| ⑯ | Management Monthly Signal Evaluation | 月末時点の会社経営状態を、良い/悪い/次に見ることへ翻訳した評価文 | `/management-score` の月次試算表下、経営判断、過去ログ | Codex / subscription automation + management review | `amd-os-l16-management-monthly-signal-evaluation` | 月末最終日17:00 JST |

## L2⑯の評価文ルール

L2⑯は、予実表の数字をもう一度読み上げる場所ではない。数字は上の予実表にあるので、ここでは次の形に変換する。

| 要素 | 内容 |
|---|---|
| 状態アイコン + ラベル | `🟢 良好`, `🟩 概ね良い`, `🟡 注意`, `🟠 要介入`, `🔴 危険` |
| 1行評価 | 「まあ悪くないけど、もう少し新規案件があると安心できる」のような経営判断の文章 |
| 判断理由 | 2〜3個。数字の再掲ではなく、何が効いているかを書く |
| 次に見るべきこと | 翌月に確認すべき1〜3項目 |

## source of truth

L2⑯のsource of truth tableは `company_management_signal_reviews`。修正版 `/management-score` UI の方向を正とし、数字再掲ではなく状態ラベル/アイコン、自然文評価、判断コメントを保存する。

最小payload:

```ts
type ManagementMonthlySignalEvaluation = {
  ym: string;
  version: number;
  status_label: "概ね良好" | "注意して進める" | "要介入" | "評価候補/中立";
  status_tone: "good" | "watch" | "danger" | "neutral";
  status_icon: "good" | "watch" | "danger" | "neutral";
  headline: string;
  summary: string;
  sections: Array<{ title: string; body: string; items: string[]; tone: "good" | "watch" | "danger" | "neutral" }>;
  source_refs_json: unknown[];
  source_confidence: number;
  payload_json: {
    snapshot_id?: string;
    finance_ym?: string;
    variance_summary?: unknown;
    score_axis_summary?: unknown;
    evaluation_logic_version?: string;
    omitted_numbers_policy: "do_not_repeat_budget_table_numbers";
  };
  generated_at: string;
  reviewed_at?: string | null;
  codex_thread_id?: string | null;
  automation_id?: string | null;
  is_current: boolean;
  superseded_at?: string | null;
};
```

## 更新経路

- 毎月末日 17:00 JST に Codex / subscription automation 候補を走らせる。
- 毎月末日17:00 JSTに Codex / subscription automation `amd-os-l16-management-monthly-signal-evaluation` 候補を走らせ、保存済みL2として生成/更新する。
- 入力は `amd_management_score_snapshots`, `amd_management_score_evidence`, `company_budget_actual_monthly`, `company_budget_variance_notes`, L2⑨, L2⑭, L2⑮。
- 出力は reviewable payload。新versionを保存し、旧currentを過去ログへ閉じる。
- `/management-score` では最新評価だけを展開し、古い評価は月別トグルの過去ログとして閉じる。

## 関連仕様

- 詳細仕様: [`3-1-l2-data-extraction-current-spec`](3-1-l2-data-extraction-current-spec)
- Management Score: [`4-4-management-score-company-vital-scope-plan`](4-4-management-score-company-vital-scope-plan)
- design側の詳説: [`../design/L2_DATA.md`](../design/L2_DATA.md), [`../design/management_score.md`](../design/management_score.md)
